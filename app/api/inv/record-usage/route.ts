/**
 * POST /api/inv/record-usage
 * บันทึกการใช้สินค้าสาขา — แยกจาก /api/inv/usage เดิม
 * ต่างจากเดิมตรงที่:
 *   - used_at  → วันที่เท่านั้น (DD/MM/YYYY ไม่มีเวลา)
 *   - branch_id → บันทึกลง row ด้วย (column O)
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saUpdateRow, saAppendRow, saInvalidateCache } from "@/lib/google-sa";
import { getInvAccess, genId } from "@/lib/inv-access";

function todayDateOnly(): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function todayPeriod(): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${p(d.getMonth() + 1)}/${d.getFullYear()}`; // MM/YYYY e.g. "05/2026"
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { product_id, product_name, category, unit, qty_used, doctor, note, branch_id } = body;

    if (!product_id || !qty_used)
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    const qtyNeeded = Number(qty_used);
    if (qtyNeeded <= 0)
      return NextResponse.json({ error: "qty_used must be > 0" }, { status: 400 });

    let targetSheetId = access.branchSheetId;
    let effectiveBranchId = branch_id || access.branchId || "";
    if (branch_id && access.role === "SUPER_ADMIN") {
      const b = access.allBranchSheets.find((x) => x.branchId === branch_id);
      targetSheetId = b?.sheetId ?? null;
    }

    if (!targetSheetId)
      return NextResponse.json({ error: "Branch INV not configured" }, { status: 400 });

    const bSid = targetSheetId;

    // Read INV_Stock — FIFO by expiry_date ASC
    const stockRows = await saReadRange(bSid, "INV_Stock!A:N", 0);

    type StockRow = { rowIdx: number; row: any[]; lot_id: string; expiry_date: string; qty_remaining: number; cost_per_unit: number };
    const matching: StockRow[] = stockRows
      .slice(1)
      .map((r: any[], i: number) => ({
        rowIdx: i + 1,
        row: r,
        lot_id: (r[7] ?? "").toString(),
        expiry_date: (r[10] ?? "").toString(),
        qty_remaining: Number(r[9] ?? 0),
        cost_per_unit: Number(r[13] ?? 0),
      }))
      .filter((s: StockRow) => (s.row[1] ?? "").toString() === product_id.toString() && s.qty_remaining > 0);

    matching.sort((a: StockRow, b: StockRow) => {
      if (!a.expiry_date) return 1;
      if (!b.expiry_date) return -1;
      return a.expiry_date.localeCompare(b.expiry_date);
    });

    const totalAvailable = matching.reduce((sum: number, s: StockRow) => sum + s.qty_remaining, 0);
    if (totalAvailable < qtyNeeded)
      return NextResponse.json({ error: `ไม่เพียงพอ: คงเหลือ ${totalAvailable} ${unit}` }, { status: 409 });

    const dateOnly = todayDateOnly();
    const period   = todayPeriod();
    const usageId  = await genId("USE", bSid, "INV_Usage");

    let remaining      = qtyNeeded;
    let totalCostAccum = 0;
    const usedLots: { lot_id: string; expiry_date: string; qty: number }[] = [];

    for (const s of matching) {
      if (remaining <= 0) break;
      const deduct = Math.min(remaining, s.qty_remaining);
      remaining -= deduct;
      const updatedRow = [...s.row];
      updatedRow[9] = s.qty_remaining - deduct;
      await saUpdateRow(bSid, `INV_Stock!A${s.rowIdx + 1}`, updatedRow);
      totalCostAccum += s.cost_per_unit * deduct;
      usedLots.push({ lot_id: s.lot_id, expiry_date: s.expiry_date, qty: deduct });
    }

    const avgCostPerUnit = qtyNeeded > 0 ? totalCostAccum / qtyNeeded : 0;
    const usageCostTotal = totalCostAccum;
    const firstLot = usedLots[0];

    // Append INV_Usage A:P
    // N=total_cost, O=branch_id, P=period (MM/YYYY)
    await saAppendRow(bSid, "INV_Usage!A:P", [
      usageId,
      product_id,
      product_name,
      category || "",
      unit || "",
      firstLot.lot_id,
      firstLot.expiry_date,
      qtyNeeded,
      doctor || "",
      note || "",
      email,
      dateOnly,          // L: used_at — วันที่เท่านั้น
      avgCostPerUnit,    // M: cost_per_unit
      usageCostTotal,    // N: total_cost
      effectiveBranchId, // O: branch_id
      period,            // P: period (MM/YYYY)
    ]);

    saInvalidateCache(bSid);

    // Expiry warning notification
    if (access.centralSheetId) {
      try {
        const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
        for (const lot of usedLots) {
          if (!lot.expiry_date) continue;
          const exp  = new Date(lot.expiry_date);
          const days = Math.floor((exp.getTime() - today.getTime()) / 86400000);
          if (days <= 30) {
            await saAppendRow(access.centralSheetId, "INV_Notification!A:H", [
              `NOTIF-${Date.now()}`,
              effectiveBranchId,
              effectiveBranchId,
              "expiry_warning",
              `สินค้า ${product_name} lot ${lot.lot_id} ใกล้หมดอายุ (${lot.expiry_date}) เหลือ ${days} วัน`,
              lot.lot_id,
              "FALSE",
              dateOnly,
            ]);
          }
        }
      } catch { /* non-blocking */ }
    }

    return NextResponse.json({ usage_id: usageId, lots_deducted: usedLots });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
