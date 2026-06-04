/**
 * GET    /api/inv/po — list all POs (Super Admin only)
 * POST   /api/inv/po — create PO (สินค้า + จำนวน + ราคารวม เท่านั้น → PENDING)
 * PATCH  /api/inv/po — action: approve | confirm | cancel | stock-in
 *
 * Flow: PENDING → (approve) → APPROVED → (confirm: payment+delivery) → ORDERED → (stock-in: expiry) → RECEIVED
 *
 * "confirm" action sets payment method + config + expected_delivery + optional signed_po_url
 * and creates liabilities at that point.
 *
 * payment_config (JSON) stored at column AC (index 28):
 *   NET:     { net_days: 30 }
 *   EQUAL:   { installments: 6, interval_months: 1 }
 *   DEPOSIT: { deposit_pct: 30, interval_months: 1 }
 *   CUSTOM:  { installments: [{due_date, amount, note?}, ...] }
 *
 * Column AD (index 29) = signed_po_url
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  saReadRange, saAppendRow, saAppendRows, saUpdateRow,
  saInvalidateCache, saGetSheetMeta, saStructuralBatchUpdate,
} from "@/lib/google-sa";
import { getInvAccess, genId, thaiTimestamp } from "@/lib/inv-access";
import { recordStockLedger } from "@/lib/inv-stock-ledger";

const PO_SHEET = "PO";
const PO_RANGE = "PO!A:AD"; // 30 columns (A–AD)
const LIA_SHEET = "Liabilities";

function parsePoRow(r: any[]) {
  return {
    po_id:                  String(r[0]  ?? ""),
    product_id:             String(r[1]  ?? ""),
    product_name:           String(r[2]  ?? ""),
    category:               String(r[3]  ?? ""),
    brand:                  String(r[4]  ?? ""),
    unit:                   String(r[5]  ?? ""),
    unit_pkg:               String(r[6]  ?? ""),
    qty_per_pkg:            String(r[7]  ?? ""),
    qty_ordered:            String(r[8]  ?? ""),
    qty_unit:               String(r[9]  ?? ""),
    cost_per_unit:          String(r[10] ?? ""),
    cost_total:             String(r[11] ?? ""),
    supplier_name:          String(r[12] ?? ""),
    payment_method:         String(r[13] ?? ""),
    installments_count:     String(r[14] ?? "0"),
    amount_per_installment: String(r[15] ?? "0"),
    paid_amount:            String(r[16] ?? "0"),
    outstanding_amount:     String(r[17] ?? "0"),
    expected_delivery:      String(r[18] ?? ""),
    received_date:          String(r[19] ?? ""),
    lot_id:                 String(r[20] ?? ""),
    expiry_date:            String(r[21] ?? ""),
    status:                 String(r[22] ?? ""),
    note:                   String(r[23] ?? ""),
    created_by:             String(r[24] ?? ""),
    created_at:             String(r[25] ?? ""),
    approved_by:            String(r[26] ?? ""),
    approved_at:            String(r[27] ?? ""),
    payment_config:         String(r[28] ?? ""),
    signed_po_url:          String(r[29] ?? ""),
  };
}

function nextLiaIds(baseId: string, count: number): string[] {
  const parts = baseId.split("-");
  const base  = parseInt(parts[parts.length - 1], 10);
  return Array.from({ length: count }, (_, i) => {
    const copy = [...parts];
    copy[copy.length - 1] = String(base + i).padStart(3, "0");
    return copy.join("-");
  });
}

function bangkokNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
}

function bangkokToday(): string {
  const d = bangkokNow();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function addMonths(base: Date, months: number): string {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function parseConfig(raw: string): any {
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}

const PO_HEADERS = [
  "po_id","product_id","product_name","category","brand","unit","unit_pkg","qty_per_pkg",
  "qty_ordered","qty_unit","cost_per_unit","cost_total","supplier_name","payment_method",
  "installments_count","amount_per_installment","paid_amount","outstanding_amount",
  "expected_delivery","received_date","lot_id","expiry_date","status","note",
  "created_by","created_at","approved_by","approved_at","payment_config","signed_po_url",
];

const LIA_HEADERS = [
  "lia_id","po_id","supplier_name","installment_no","due_date",
  "amount","paid_date","status","note","created_at",
];

const LOTS_SHEET = "INV_Lots";
const LOTS_HEADERS = [
  "lot_id","product_id","product_name","category","brand","unit","unit_pkg",
  "qty_per_pkg","qty_original","qty_remaining",
  "expiry_date","received_date","po_id","supplier_name","created_at","cost_per_unit",
];

async function ensureSheet(sid: string, sheetName: string, headers: string[], lastCol: string): Promise<void> {
  try {
    await saReadRange(sid, `${sheetName}!A1`, 0);
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    if (!msg.includes("Unable to parse range") && !msg.includes("not found")) throw err;
    await saStructuralBatchUpdate(sid, [{ addSheet: { properties: { title: sheetName } } }]);
    await saUpdateRow(sid, `${sheetName}!A1:${lastCol}1`, headers);
    saInvalidateCache(sid);
  }
}

const ensurePoSheet   = (sid: string) => ensureSheet(sid, PO_SHEET,   PO_HEADERS,   "AD");
const ensureLiaSheet  = (sid: string) => ensureSheet(sid, LIA_SHEET,  LIA_HEADERS,  "J");
const ensureLotsSheet = (sid: string) => ensureSheet(sid, LOTS_SHEET, LOTS_HEADERS, "P");

async function auth(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.email) return null;
  const email  = (token.email as string).toLowerCase().trim();
  const access = await getInvAccess(email);
  if (!access || access.role !== "SUPER_ADMIN") return null;
  const sid = access.centralSheetId;
  if (!sid) return null;
  return { email, sid };
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await auth(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let rows: any[][] = [];
    try {
      rows = await saReadRange(ctx.sid, PO_RANGE, 0);
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      if (!msg.includes("Unable to parse range") && !msg.includes("not found")) throw err;
    }
    const pos = rows.slice(1).filter((r) => r[0]).map(parsePoRow);
    return NextResponse.json({ pos });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── POST: create PO (minimal fields only) ───────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const ctx = await auth(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { product_id, product_name, category, brand, unit, unit_pkg, qty_per_pkg,
            qty_ordered, cost_total, supplier_name, note } = body;

    if (!product_name || !qty_ordered || !cost_total)
      return NextResponse.json({ error: "กรุณากรอก: product_name, qty_ordered, cost_total" }, { status: 400 });

    const sid = ctx.sid;
    await ensurePoSheet(sid);
    const ts  = thaiTimestamp();
    const poId = await genId("PO", sid, PO_SHEET);

    const qtyOrdered  = Number(qty_ordered);
    const qtyPerPkg   = Number(qty_per_pkg) || 1;
    const qtyUnit     = qtyOrdered * qtyPerPkg;
    const costTotal   = Number(cost_total);
    const costPerUnit = qtyUnit > 0 ? costTotal / qtyUnit : 0;

    await saAppendRow(sid, `${PO_SHEET}!A:AD`, [
      poId,
      product_id       ?? "",
      product_name,
      category         ?? "",
      brand            ?? "",
      unit             ?? "",
      unit_pkg         ?? "",
      qtyPerPkg,
      qtyOrdered,
      qtyUnit,
      costPerUnit,
      costTotal,
      supplier_name    ?? "",
      "",   // payment_method (set at confirm)
      0,    // installments_count
      0,    // amount_per_installment
      0,    // paid_amount
      costTotal, // outstanding_amount
      "",   // expected_delivery (set at confirm)
      "",   // received_date
      "",   // lot_id
      "",   // expiry_date
      "PENDING",
      note ?? "",
      ctx.email,
      ts,
      "",   // approved_by
      "",   // approved_at
      "",   // payment_config (set at confirm)
      "",   // signed_po_url (set at confirm)
    ]);

    saInvalidateCache(sid);
    return NextResponse.json({ po_id: poId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── PATCH: approve | confirm | cancel | stock-in ────────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const ctx = await auth(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { po_id, action } = body;
    if (!po_id || !action) return NextResponse.json({ error: "po_id and action required" }, { status: 400 });

    const sid = ctx.sid;
    const ts  = thaiTimestamp();

    const rows   = await saReadRange(sid, PO_RANGE, 0);
    const rowIdx = rows.findIndex((r, i) => i > 0 && String(r[0] ?? "") === po_id);
    if (rowIdx < 1) return NextResponse.json({ error: "PO not found" }, { status: 404 });

    const row = [...rows[rowIdx]];
    while (row.length < 30) row.push("");
    const currentStatus = String(row[22] ?? "");

    // ─── APPROVE: PENDING → APPROVED ─────────────────────────────────────
    if (action === "approve") {
      if (currentStatus !== "PENDING")
        return NextResponse.json({ error: "PO ต้องมีสถานะ PENDING เพื่ออนุมัติ" }, { status: 400 });

      row[22] = "APPROVED";
      row[26] = ctx.email;
      row[27] = ts;
      await saUpdateRow(sid, `${PO_SHEET}!A${rowIdx + 1}`, row);
      saInvalidateCache(sid);
      return NextResponse.json({ ok: true, po_id, status: "APPROVED" });
    }

    // ─── CONFIRM: APPROVED → ORDERED (ตั้งวิธีชำระ + สร้าง Liabilities) ──
    if (action === "confirm") {
      if (currentStatus !== "APPROVED")
        return NextResponse.json({ error: "PO ต้องมีสถานะ APPROVED เพื่อยืนยันการสั่งซื้อ" }, { status: 400 });

      const {
        payment_method    = "FULL",
        net_days          = 30,
        installments_count = 3,
        interval_months   = 1,
        deposit_pct       = 30,
        custom_installments = [],
        expected_delivery = "",
        signed_po_url     = "",
      } = body;

      const costTotal    = Number(row[11] ?? 0);
      const supplierName = String(row[12] ?? "");
      const now          = bangkokNow();

      // Build payment_config
      let paymentConfig: any = {};
      let effectiveInstCount   = 0;
      let effectiveAmtPerInst  = 0;

      switch (payment_method) {
        case "NET": {
          const nd = Math.max(1, Number(net_days) || 30);
          paymentConfig        = { net_days: nd };
          effectiveInstCount   = 1;
          effectiveAmtPerInst  = costTotal;
          break;
        }
        case "EQUAL":
        case "INSTALLMENT": {
          const ic = Math.max(1, Number(installments_count) || 1);
          const im = Math.max(1, Number(interval_months) || 1);
          paymentConfig        = { installments: ic, interval_months: im };
          effectiveInstCount   = ic;
          effectiveAmtPerInst  = Math.round((costTotal / ic) * 100) / 100;
          break;
        }
        case "DEPOSIT": {
          const dp = Math.min(99, Math.max(1, Number(deposit_pct) || 30));
          const im = Math.max(1, Number(interval_months) || 1);
          paymentConfig        = { deposit_pct: dp, interval_months: im };
          effectiveInstCount   = 2;
          effectiveAmtPerInst  = Math.round((costTotal * dp / 100) * 100) / 100;
          break;
        }
        case "CUSTOM":
        case "PARTIAL": {
          const schedule       = Array.isArray(custom_installments) ? custom_installments : [];
          paymentConfig        = { installments: schedule };
          effectiveInstCount   = schedule.length;
          effectiveAmtPerInst  = schedule.length > 0 ? Number(schedule[0].amount) : 0;
          break;
        }
        default: // FULL
          break;
      }

      // Create liabilities
      await ensureLiaSheet(sid);
      const liabRows: any[][] = [];

      switch (payment_method) {
        case "NET": {
          const liaId = await genId("LIA", sid, LIA_SHEET);
          liabRows.push([liaId, po_id, supplierName, 1, addDays(now, Number(net_days) || 30), costTotal, "", "PENDING", `Net ${net_days} วัน`, ts]);
          break;
        }
        case "EQUAL":
        case "INSTALLMENT": {
          const count = Math.max(1, Number(installments_count) || 1);
          const im    = Math.max(1, Number(interval_months) || 1);
          const base  = Math.round((costTotal / count) * 100) / 100;
          const last  = Math.round((costTotal - base * (count - 1)) * 100) / 100;
          const baseId = await genId("LIA", sid, LIA_SHEET);
          nextLiaIds(baseId, count).forEach((lid, i) =>
            liabRows.push([lid, po_id, supplierName, i + 1, addMonths(now, (i + 1) * im), i === count - 1 ? last : base, "", "PENDING", "", ts])
          );
          break;
        }
        case "DEPOSIT": {
          const dp = Number(deposit_pct) || 30;
          const im = Number(interval_months) || 1;
          const dAmt = Math.round((costTotal * dp / 100) * 100) / 100;
          const remain = Math.round((costTotal - dAmt) * 100) / 100;
          const baseId = await genId("LIA", sid, LIA_SHEET);
          const [l1, l2] = nextLiaIds(baseId, 2);
          liabRows.push([l1, po_id, supplierName, 1, bangkokToday(), dAmt, "", "PENDING", `มัดจำ ${dp}%`, ts]);
          liabRows.push([l2, po_id, supplierName, 2, addMonths(now, im), remain, "", "PENDING", "ส่วนที่เหลือ", ts]);
          break;
        }
        case "CUSTOM":
        case "PARTIAL": {
          const schedule: any[] = Array.isArray(custom_installments) ? custom_installments : [];
          if (schedule.length > 0) {
            const baseId = await genId("LIA", sid, LIA_SHEET);
            nextLiaIds(baseId, schedule.length).forEach((lid, i) =>
              liabRows.push([lid, po_id, supplierName, i + 1, schedule[i].due_date, Number(schedule[i].amount), "", "PENDING", schedule[i].note || "", ts])
            );
          }
          break;
        }
        // FULL: ไม่สร้าง Liabilities
      }

      if (liabRows.length > 0) await saAppendRows(sid, `${LIA_SHEET}!A:J`, liabRows);

      // Update PO row
      row[13] = payment_method;
      row[14] = effectiveInstCount;
      row[15] = effectiveAmtPerInst;
      row[18] = expected_delivery;
      row[22] = "ORDERED";
      row[28] = Object.keys(paymentConfig).length > 0 ? JSON.stringify(paymentConfig) : "";
      row[29] = signed_po_url;
      await saUpdateRow(sid, `${PO_SHEET}!A${rowIdx + 1}`, row);

      saInvalidateCache(sid);
      return NextResponse.json({ ok: true, po_id, status: "ORDERED", liabilities_created: liabRows.length });
    }

    // ─── CANCEL ───────────────────────────────────────────────────────────
    if (action === "cancel") {
      if (!["PENDING", "APPROVED", "ORDERED"].includes(currentStatus))
        return NextResponse.json({ error: "ยกเลิกได้เฉพาะ PENDING, APPROVED หรือ ORDERED" }, { status: 400 });
      row[22] = "CANCELLED";
      if (body.note) row[23] = body.note;
      await saUpdateRow(sid, `${PO_SHEET}!A${rowIdx + 1}`, row);
      saInvalidateCache(sid);
      return NextResponse.json({ ok: true, po_id, status: "CANCELLED" });
    }

    // ─── STOCK-IN: ORDERED → RECEIVED ────────────────────────────────────
    if (action === "stock-in") {
      if (currentStatus !== "ORDERED")
        return NextResponse.json({ error: "PO ต้องมีสถานะ ORDERED เพื่อรับสินค้า" }, { status: 400 });
      if (!body.expiry_date)
        return NextResponse.json({ error: "กรุณาระบุวันหมดอายุ (expiry_date)" }, { status: 400 });

      const productId    = String(row[1]  ?? "");
      const productName  = String(row[2]  ?? "");
      const category     = String(row[3]  ?? "");
      const brand        = String(row[4]  ?? "");
      const unit         = String(row[5]  ?? "");
      const unitPkg      = String(row[6]  ?? "");
      const qtyPerPkg    = Number(row[7]  ?? 1);
      const qtyUnit      = Number(row[9]  ?? 0);
      const costTotal    = Number(row[11] ?? 0);
      const supplierName = String(row[12] ?? "");
      const paymentMethod = String(row[13] ?? "FULL");
      const costPerUnit  = qtyUnit > 0 ? costTotal / qtyUnit : 0;
      const today        = bangkokToday();

      await ensureLotsSheet(sid);
      const lotId = await genId("LOT", sid, LOTS_SHEET);

      await saAppendRow(sid, `${LOTS_SHEET}!A:P`, [
        lotId, productId, productName, category, brand, unit, unitPkg,
        qtyPerPkg, qtyUnit, qtyUnit,
        body.expiry_date, today, po_id, supplierName, ts, costPerUnit,
      ]);

      await recordStockLedger({
        sid, productName, category, brand, unit,
        txnType: "IN", qty: qtyUnit, unitCost: costPerUnit,
        referenceId: po_id,
        note: body.note || `รับเข้า Lot ${lotId}`,
        createdBy: ctx.email,
      });

      row[19] = today;
      row[20] = lotId;
      row[21] = body.expiry_date;
      row[22] = "RECEIVED";
      if (body.note) row[23] = body.note;
      if (paymentMethod === "FULL") { row[16] = costTotal; row[17] = 0; }

      await saUpdateRow(sid, `${PO_SHEET}!A${rowIdx + 1}`, row);
      saInvalidateCache(sid);
      return NextResponse.json({ ok: true, po_id, lot_id: lotId, status: "RECEIVED" });
    }

    return NextResponse.json({ error: "action ไม่ถูกต้อง: approve | confirm | cancel | stock-in" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ctx = await auth(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { po_id } = await request.json();
    if (!po_id) return NextResponse.json({ error: "po_id required" }, { status: 400 });

    const sid  = ctx.sid;
    const rows = await saReadRange(sid, PO_RANGE, 0);
    const rowIdx = rows.findIndex((r, i) => i > 0 && String(r[0] ?? "") === po_id);
    if (rowIdx < 1) return NextResponse.json({ error: "PO not found" }, { status: 404 });

    const status = String(rows[rowIdx][22] ?? "");
    if (!["PENDING", "CANCELLED"].includes(status))
      return NextResponse.json({ error: "ลบได้เฉพาะ PENDING หรือ CANCELLED" }, { status: 400 });

    const { sheetId } = await saGetSheetMeta(sid, PO_SHEET);
    await saStructuralBatchUpdate(sid, [{
      deleteDimension: {
        range: { sheetId, dimension: "ROWS", startIndex: rowIdx, endIndex: rowIdx + 1 },
      },
    }]);

    saInvalidateCache(sid);
    return NextResponse.json({ ok: true, po_id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
