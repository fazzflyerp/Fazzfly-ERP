/**
 * POST /api/inv/record-usage
 * บันทึกการใช้สินค้าสาขา — รองรับ 3 modes:
 *
 *   mode = "direct"     (default) — ตัดหน่วยใหญ่ FIFO เดิม
 *   mode = "conversion" — ตัดหน่วยย่อย เปิด lot ใหม่ถ้าจำเป็น
 *   mode = "protocol"   — วนตัดทุก ingredient ของ protocol (bulk)
 *
 * INV_Stock cols A:Q
 *   A(0)=stock_id  B(1)=product_id  C(2)=product_name  D(3)=category  E(4)=brand
 *   F(5)=unit      G(6)=unit_pkg    H(7)=lot_id        I(8)=qty_received  J(9)=qty_remaining
 *   K(10)=expiry_date  L(11)=transfer_id  M(12)=received_at  N(13)=cost_per_unit
 *   O(14)=parent_stock_id  P(15)=is_opened  Q(16)=opened_at
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saUpdateRow, saAppendRow, saInvalidateCache } from "@/lib/google-sa";
import { getInvAccess, genId } from "@/lib/inv-access";

// ── Date helpers ───────────────────────────────────────────────────────────────
function todayDateOnly(): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function todayPeriod(): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function todayISO(): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** แปลง string เป็น Date — รองรับ YYYY-MM-DD และ DD/MM/YYYY */
function parseDate(s: string): Date | null {
  if (!s || s === "—") return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s); return isNaN(d.getTime()) ? null : d;
  }
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const d = new Date(+m[3], +m[2] - 1, +m[1]); return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** min(a, b) แบบ nullable — ถ้าฝั่งใดเป็น null ให้ใช้อีกฝั่ง */
function minDate(a: Date | null, b: Date | null): Date | null {
  if (!a) return b; if (!b) return a;
  return a < b ? a : b;
}

function dateToStr(d: Date): string {
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ── Stock row type ─────────────────────────────────────────────────────────────
type StockRow = {
  rowIdx:        number;
  row:           any[];
  stock_id:      string;
  lot_id:        string;
  unit:          string;
  expiry_date:   string;
  qty_remaining: number;
  cost_per_unit: number;
  is_opened:     boolean;
  parent_stock_id: string;
};

function buildStockRows(rawRows: any[][]): StockRow[] {
  return rawRows.slice(1).map((r, i) => ({
    rowIdx:          i + 1,
    row:             r,
    stock_id:        (r[0]  ?? "").toString(),
    lot_id:          (r[7]  ?? "").toString(),
    unit:            (r[5]  ?? "").toString(),
    expiry_date:     (r[10] ?? "").toString(),
    qty_remaining:   Number(r[9]  ?? 0),
    cost_per_unit:   Number(r[13] ?? 0),
    is_opened:       (r[15] ?? "").toString().toLowerCase() === "true",
    parent_stock_id: (r[14] ?? "").toString(),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Core deduction: direct mode (FIFO by expiry, all lots for a product)
// ─────────────────────────────────────────────────────────────────────────────
async function deductDirect(
  bSid: string,
  allRows: StockRow[],
  product_id: string,
  qtyNeeded: number,
  unit: string,
): Promise<{ usedLots: { lot_id: string; expiry_date: string; qty: number }[]; totalCost: number }> {
  const matching = allRows
    .filter((s) => (s.row[1] ?? "").toString() === product_id.toString() && s.qty_remaining > 0)
    .sort((a, b) => {
      if (!a.expiry_date) return 1; if (!b.expiry_date) return -1;
      return a.expiry_date.localeCompare(b.expiry_date);
    });

  const totalAvailable = matching.reduce((sum, s) => sum + s.qty_remaining, 0);
  if (totalAvailable < qtyNeeded)
    throw new Error(`ไม่เพียงพอ: คงเหลือ ${totalAvailable} ${unit}`);

  let remaining = qtyNeeded;
  let totalCost = 0;
  const usedLots: { lot_id: string; expiry_date: string; qty: number }[] = [];

  for (const s of matching) {
    if (remaining <= 0) break;
    const deduct     = Math.min(remaining, s.qty_remaining);
    remaining       -= deduct;
    const updatedRow = [...s.row];
    updatedRow[9]    = s.qty_remaining - deduct;
    await saUpdateRow(bSid, `INV_Stock!A${s.rowIdx + 1}`, updatedRow);
    totalCost += s.cost_per_unit * deduct;
    usedLots.push({ lot_id: s.lot_id, expiry_date: s.expiry_date, qty: deduct });
  }
  return { usedLots, totalCost };
}

// ─────────────────────────────────────────────────────────────────────────────
// Core deduction: conversion mode
// Prefers opened lots → opens new lot from unopened if needed
// ─────────────────────────────────────────────────────────────────────────────
async function deductConversion(
  bSid:            string,
  allRows:         StockRow[],
  product_id:      string,
  qtyNeeded:       number,         // in dispense_unit
  dispenseUnit:    string,
  unitsPerStock:   number,
  openExpiryDays:  number | null,
): Promise<{ usedLots: { lot_id: string; expiry_date: string; qty: number }[]; totalCost: number; newStockId?: string }> {

  let remaining = qtyNeeded;
  let totalCost = 0;
  const usedLots: { lot_id: string; expiry_date: string; qty: number }[] = [];
  let newStockId: string | undefined;

  const todayStr = todayISO();

  // ── Step 1: drain opened lots (is_opened=true) in FIFO order ────────────────
  const openedLots = allRows
    .filter((s) => (s.row[1] ?? "").toString() === product_id.toString()
      && s.is_opened && s.qty_remaining > 0)
    .sort((a, b) => {
      if (!a.expiry_date) return 1; if (!b.expiry_date) return -1;
      return a.expiry_date.localeCompare(b.expiry_date);
    });

  for (const s of openedLots) {
    if (remaining <= 0) break;
    const deduct     = Math.min(remaining, s.qty_remaining);
    remaining       -= deduct;
    const updatedRow = [...s.row];
    updatedRow[9]    = s.qty_remaining - deduct;
    await saUpdateRow(bSid, `INV_Stock!A${s.rowIdx + 1}`, updatedRow);
    totalCost += s.cost_per_unit * deduct;
    usedLots.push({ lot_id: s.lot_id, expiry_date: s.expiry_date, qty: deduct });
  }

  if (remaining <= 0) return { usedLots, totalCost };

  // ── Step 2: open new lots from unopened stock ────────────────────────────────
  const unopened = allRows
    .filter((s) => (s.row[1] ?? "").toString() === product_id.toString()
      && !s.is_opened && s.qty_remaining > 0)
    .sort((a, b) => {
      if (!a.expiry_date) return 1; if (!b.expiry_date) return -1;
      return a.expiry_date.localeCompare(b.expiry_date);
    });

  for (const src of unopened) {
    if (remaining <= 0) break;

    // Deduct 1 stock unit from source lot
    const updatedSrc = [...src.row];
    updatedSrc[9]    = src.qty_remaining - 1;
    await saUpdateRow(bSid, `INV_Stock!A${src.rowIdx + 1}`, updatedSrc);

    // Compute expiry for opened lot
    const originalExpiry = parseDate(src.expiry_date);
    let openedExpiry: Date | null = null;
    if (openExpiryDays !== null && openExpiryDays > 0) {
      const openLimit = new Date(todayStr);
      openLimit.setDate(openLimit.getDate() + openExpiryDays);
      openedExpiry = minDate(originalExpiry, openLimit);
    } else {
      openedExpiry = originalExpiry;
    }
    const openedExpiryStr = openedExpiry ? dateToStr(openedExpiry) : src.expiry_date;

    // How much from this new opened lot?
    const deductFromOpened = Math.min(remaining, unitsPerStock);
    const openedQtyRemain  = unitsPerStock - deductFromOpened;
    remaining             -= deductFromOpened;

    const costPerDispense = src.cost_per_unit / unitsPerStock; // pro-rated cost
    totalCost += costPerDispense * deductFromOpened;

    // Create new opened lot row
    const openedStockId = await genId("STK", bSid, "INV_Stock");
    newStockId = openedStockId;

    const newRow = [
      openedStockId,               // A stock_id
      (src.row[1] ?? ""),          // B product_id
      (src.row[2] ?? ""),          // C product_name
      (src.row[3] ?? ""),          // D category
      (src.row[4] ?? ""),          // E brand
      dispenseUnit,                // F unit (dispense_unit)
      "opened",                    // G unit_pkg
      src.lot_id,                  // H lot_id
      unitsPerStock,               // I qty_received
      openedQtyRemain,             // J qty_remaining
      openedExpiryStr,             // K expiry_date
      (src.row[11] ?? ""),         // L transfer_id
      todayStr,                    // M received_at
      costPerDispense,             // N cost_per_unit
      src.stock_id,                // O parent_stock_id
      "true",                      // P is_opened
      todayStr,                    // Q opened_at
    ];
    await saAppendRow(bSid, "INV_Stock!A:Q", newRow);

    usedLots.push({ lot_id: src.lot_id, expiry_date: openedExpiryStr, qty: deductFromOpened });

    // If new opened lot still has remaining qty AND we still need more → deduct more
    // (already accounted above; if remaining > 0 and openedQtyRemain < remaining → loop continues to next src)
  }

  if (remaining > 0)
    throw new Error(`ไม่เพียงพอ: ต้องการ ${qtyNeeded} ${dispenseUnit} แต่สต๊อคไม่พอ`);

  return { usedLots, totalCost, newStockId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Append INV_Usage row
// ─────────────────────────────────────────────────────────────────────────────
async function appendUsage(
  bSid:            string,
  usageId:         string,
  product_id:      string,
  product_name:    string,
  category:        string,
  unit:            string,
  qtyUsed:         number,
  firstLot:        { lot_id: string; expiry_date: string },
  doctor:          string,
  note:            string,
  email:           string,
  avgCostPerUnit:  number,
  totalCost:       number,
  effectiveBranchId: string,
) {
  const dateOnly = todayDateOnly();
  const period   = todayPeriod();
  await saAppendRow(bSid, "INV_Usage!A:P", [
    usageId, product_id, product_name, category || "", unit,
    firstLot.lot_id, firstLot.expiry_date,
    qtyUsed, doctor || "", note || "",
    email, dateOnly, avgCostPerUnit, totalCost,
    effectiveBranchId, period,
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const {
      mode = "direct",
      product_id, product_name, category, unit, qty_used, doctor, note, branch_id,
      // conversion mode extras
      dispense_unit, units_per_stock, open_expiry_days, qty_dispense,
      // protocol mode
      protocol_id, ingredients,
    } = body;

    let targetSheetId     = access.branchSheetId;
    let effectiveBranchId = branch_id || access.branchId || "";
    if (branch_id && access.role === "SUPER_ADMIN") {
      const b = access.allBranchSheets.find((x) => x.branchId === branch_id);
      targetSheetId = b?.sheetId ?? null;
    }
    if (!targetSheetId)
      return NextResponse.json({ error: "Branch INV not configured" }, { status: 400 });

    const bSid = targetSheetId;

    // ── MODE: protocol ────────────────────────────────────────────────────────
    if (mode === "protocol") {
      if (!Array.isArray(ingredients) || ingredients.length === 0)
        return NextResponse.json({ error: "ingredients ต้องมีค่า" }, { status: 400 });

      const stockRows = buildStockRows(await saReadRange(bSid, "INV_Stock!A:Q", 0));
      const results: any[] = [];

      for (const ing of ingredients) {
        const qtyNeeded = Number(ing.qty_used ?? ing.qty ?? 0);
        if (!ing.product_id || qtyNeeded <= 0) continue;

        const usageId = await genId("USE", bSid, "INV_Usage");

        if (ing.mode === "conversion" && ing.units_per_stock) {
          const { usedLots, totalCost } = await deductConversion(
            bSid, stockRows, ing.product_id, qtyNeeded,
            ing.dispense_unit || ing.unit || "",
            Number(ing.units_per_stock),
            ing.open_expiry_days != null ? Number(ing.open_expiry_days) : null,
          );
          const avg = qtyNeeded > 0 ? totalCost / qtyNeeded : 0;
          await appendUsage(bSid, usageId, ing.product_id, ing.product_name || "",
            ing.category || "", ing.dispense_unit || ing.unit || "", qtyNeeded,
            usedLots[0], doctor || "", note || "", email, avg, totalCost, effectiveBranchId);
          results.push({ usage_id: usageId, product_id: ing.product_id, lots: usedLots });
        } else {
          const { usedLots, totalCost } = await deductDirect(
            bSid, stockRows, ing.product_id, qtyNeeded, ing.unit || "");
          const avg = qtyNeeded > 0 ? totalCost / qtyNeeded : 0;
          await appendUsage(bSid, usageId, ing.product_id, ing.product_name || "",
            ing.category || "", ing.unit || "", qtyNeeded,
            usedLots[0], doctor || "", note || "", email, avg, totalCost, effectiveBranchId);
          results.push({ usage_id: usageId, product_id: ing.product_id, lots: usedLots });
        }
      }

      saInvalidateCache(bSid);
      return NextResponse.json({ mode: "protocol", protocol_id: protocol_id || "", results });
    }

    // ── MODE: direct / conversion ─────────────────────────────────────────────
    if (!product_id)
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    const qtyNeeded = mode === "conversion"
      ? Number(qty_dispense ?? qty_used ?? 0)
      : Number(qty_used ?? 0);

    if (qtyNeeded <= 0)
      return NextResponse.json({ error: "qty must be > 0" }, { status: 400 });

    const stockRows = buildStockRows(await saReadRange(bSid, "INV_Stock!A:Q", 0));
    const usageId   = await genId("USE", bSid, "INV_Usage");

    let usedLots: { lot_id: string; expiry_date: string; qty: number }[];
    let totalCostAccum: number;
    let effectiveUnit: string;
    let newStockId: string | undefined;

    if (mode === "conversion") {
      const ups         = Number(units_per_stock ?? 0);
      const oed         = open_expiry_days != null ? Number(open_expiry_days) : null;
      const dUnit       = dispense_unit || unit || "";
      effectiveUnit     = dUnit;

      if (!ups || ups <= 0)
        return NextResponse.json({ error: "units_per_stock ต้องมีค่า > 0" }, { status: 400 });

      const res = await deductConversion(bSid, stockRows, product_id, qtyNeeded, dUnit, ups, oed);
      usedLots       = res.usedLots;
      totalCostAccum = res.totalCost;
      newStockId     = res.newStockId;
    } else {
      effectiveUnit = unit || "";
      const res = await deductDirect(bSid, stockRows, product_id, qtyNeeded, effectiveUnit);
      usedLots       = res.usedLots;
      totalCostAccum = res.totalCost;
    }

    const avgCostPerUnit = qtyNeeded > 0 ? totalCostAccum / qtyNeeded : 0;
    const firstLot       = usedLots[0];

    await appendUsage(bSid, usageId, product_id, product_name || "", category || "",
      effectiveUnit, qtyNeeded, firstLot, doctor || "", note || "",
      email, avgCostPerUnit, totalCostAccum, effectiveBranchId);

    saInvalidateCache(bSid);

    // Expiry warning notification (non-blocking)
    if (access.centralSheetId) {
      const dateOnly = todayDateOnly();
      const today    = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
      try {
        for (const lot of usedLots) {
          if (!lot.expiry_date) continue;
          const exp  = new Date(lot.expiry_date);
          const days = Math.floor((exp.getTime() - today.getTime()) / 86400000);
          if (days <= 30) {
            await saAppendRow(access.centralSheetId, "INV_Notification!A:H", [
              `NOTIF-${Date.now()}`, effectiveBranchId, effectiveBranchId, "expiry_warning",
              `สินค้า ${product_name} lot ${lot.lot_id} ใกล้หมดอายุ (${lot.expiry_date}) เหลือ ${days} วัน`,
              lot.lot_id, "FALSE", dateOnly,
            ]);
          }
        }
      } catch { /* non-blocking */ }
    }

    return NextResponse.json({
      usage_id:    usageId,
      mode,
      lots_deducted: usedLots,
      ...(newStockId ? { opened_lot_id: newStockId } : {}),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
