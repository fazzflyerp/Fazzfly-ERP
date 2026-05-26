/**
 * GET    /api/inv/po — list all POs (Super Admin only)
 * POST   /api/inv/po — create PO
 * PATCH  /api/inv/po — action: approve | cancel | stock-in
 * DELETE /api/inv/po — delete PENDING or CANCELLED PO
 *
 * Payment methods:
 *   FULL    — ชำระเต็มจำนวนทันที
 *   NET     — เครดิต (ชำระครั้งเดียว + กำหนดวันครบ เช่น Net30)
 *   EQUAL   — ผ่อนเท่าๆ กัน (WAC standard)
 *   DEPOSIT — มัดจำ % ทันที + ส่วนที่เหลือหลัง n เดือน
 *   CUSTOM  — กำหนดจำนวนเงิน + วันครบกำหนดเองแต่ละงวด
 *
 * payment_config (JSON) stored at column AC (index 28):
 *   NET:     { net_days: 30 }
 *   EQUAL:   { installments: 6, interval_months: 1 }
 *   DEPOSIT: { deposit_pct: 30, interval_months: 1 }
 *   CUSTOM:  { installments: [{due_date, amount, note?}, ...] }
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
const PO_RANGE = "PO!A:AC"; // 29 columns (A–AC)
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
    payment_method:         String(r[13] ?? "FULL"),
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
  "created_by","created_at","approved_by","approved_at","payment_config",
];

async function ensurePoSheet(sid: string): Promise<void> {
  try {
    await saReadRange(sid, `${PO_SHEET}!A1`, 0);
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    if (!msg.includes("Unable to parse range") && !msg.includes("not found")) throw err;
    // Sheet doesn't exist — create it with header row
    await saStructuralBatchUpdate(sid, [{ addSheet: { properties: { title: PO_SHEET } } }]);
    await saUpdateRow(sid, `${PO_SHEET}!A1:AC1`, PO_HEADERS);
    saInvalidateCache(sid);
  }
}

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
      // Sheet not yet created — return empty list
    }
    const pos = rows.slice(1).filter((r) => r[0]).map(parsePoRow);
    return NextResponse.json({ pos });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await auth(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const {
      product_id, product_name, category, brand, unit, unit_pkg, qty_per_pkg,
      qty_ordered, cost_total, supplier_name,
      payment_method    = "FULL",
      net_days          = 30,
      installments_count = 3,
      interval_months   = 1,
      deposit_pct       = 30,
      custom_installments = [],
      expected_delivery, note,
    } = body;

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

    // ── Build payment_config + effective installments ─────────────
    let paymentConfig: any    = {};
    let effectiveInstCount    = 0;
    let effectiveAmtPerInst   = 0;

    switch (payment_method) {
      case "NET": {
        const nd = Math.max(1, Number(net_days) || 30);
        paymentConfig         = { net_days: nd };
        effectiveInstCount    = 1;
        effectiveAmtPerInst   = costTotal;
        break;
      }
      case "EQUAL":
      case "INSTALLMENT": {
        const ic = Math.max(1, Number(installments_count) || 1);
        const im = Math.max(1, Number(interval_months)    || 1);
        paymentConfig         = { installments: ic, interval_months: im };
        effectiveInstCount    = ic;
        effectiveAmtPerInst   = Math.round((costTotal / ic) * 100) / 100;
        break;
      }
      case "DEPOSIT": {
        const dp = Math.min(99, Math.max(1, Number(deposit_pct)   || 30));
        const im = Math.max(1,              Number(interval_months) || 1);
        paymentConfig         = { deposit_pct: dp, interval_months: im };
        effectiveInstCount    = 2;
        effectiveAmtPerInst   = Math.round((costTotal * dp / 100) * 100) / 100;
        break;
      }
      case "CUSTOM":
      case "PARTIAL": {
        const schedule        = Array.isArray(custom_installments) ? custom_installments : [];
        paymentConfig         = { installments: schedule };
        effectiveInstCount    = schedule.length;
        effectiveAmtPerInst   = schedule.length > 0 ? Number(schedule[0].amount) : 0;
        break;
      }
      default: // FULL
        break;
    }

    await saAppendRow(sid, `${PO_SHEET}!A:AC`, [
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
      payment_method,
      effectiveInstCount,
      effectiveAmtPerInst,
      0,          // paid_amount
      costTotal,  // outstanding_amount
      expected_delivery ?? "",
      "",         // received_date
      "",         // lot_id
      "",         // expiry_date
      "PENDING",
      note ?? "",
      ctx.email,
      ts,
      "",         // approved_by
      "",         // approved_at
      Object.keys(paymentConfig).length > 0 ? JSON.stringify(paymentConfig) : "",
    ]);

    saInvalidateCache(sid);
    return NextResponse.json({ po_id: poId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await auth(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { po_id, action, expiry_date, note } = body;
    if (!po_id || !action) return NextResponse.json({ error: "po_id and action required" }, { status: 400 });

    const sid = ctx.sid;
    const ts  = thaiTimestamp();

    const rows   = await saReadRange(sid, PO_RANGE, 0);
    const rowIdx = rows.findIndex((r, i) => i > 0 && String(r[0] ?? "") === po_id);
    if (rowIdx < 1) return NextResponse.json({ error: "PO not found" }, { status: 404 });

    const row = [...rows[rowIdx]];
    while (row.length < 29) row.push("");
    const currentStatus = String(row[22] ?? "");

    // ─── APPROVE ──────────────────────────────────────────────────
    if (action === "approve") {
      if (currentStatus !== "PENDING")
        return NextResponse.json({ error: "PO ต้องมีสถานะ PENDING เพื่ออนุมัติ" }, { status: 400 });

      row[22] = "APPROVED";
      row[26] = ctx.email;
      row[27] = ts;
      await saUpdateRow(sid, `${PO_SHEET}!A${rowIdx + 1}`, row);

      const paymentMethod = String(row[13] ?? "FULL");
      const costTotal     = Number(row[11] ?? 0);
      const supplierName  = String(row[12] ?? "");
      const now           = bangkokNow();
      const cfg           = parseConfig(String(row[28] ?? ""));
      const liabRows: any[][] = [];

      switch (paymentMethod) {
        case "NET": {
          const netDays = Number(cfg.net_days ?? 30);
          const liaId   = await genId("LIA", sid, LIA_SHEET);
          liabRows.push([
            liaId, po_id, supplierName, 1,
            addDays(now, netDays),
            costTotal,
            "", "PENDING", `Net ${netDays} วัน`, ts,
          ]);
          break;
        }
        case "EQUAL":
        case "INSTALLMENT": {
          const count      = Math.max(1, Number(cfg.installments ?? row[14] ?? 1));
          const intervalMo = Math.max(1, Number(cfg.interval_months ?? 1));
          const normalAmt  = Math.round((costTotal / count) * 100) / 100;
          const lastAmt    = Math.round((costTotal - normalAmt * (count - 1)) * 100) / 100;
          const baseId     = await genId("LIA", sid, LIA_SHEET);
          const liaIds     = nextLiaIds(baseId, count);
          liaIds.forEach((lid, i) => liabRows.push([
            lid, po_id, supplierName, i + 1,
            addMonths(now, (i + 1) * intervalMo),
            i === count - 1 ? lastAmt : normalAmt,
            "", "PENDING", "", ts,
          ]));
          break;
        }
        case "DEPOSIT": {
          const depositPct = Number(cfg.deposit_pct   ?? 30);
          const intervalMo = Number(cfg.interval_months ?? 1);
          const depositAmt = Math.round((costTotal * depositPct / 100) * 100) / 100;
          const remainAmt  = Math.round((costTotal - depositAmt) * 100) / 100;
          const baseId     = await genId("LIA", sid, LIA_SHEET);
          const [lid1, lid2] = nextLiaIds(baseId, 2);
          liabRows.push([lid1, po_id, supplierName, 1, bangkokToday(), depositAmt, "", "PENDING", `มัดจำ ${depositPct}%`, ts]);
          liabRows.push([lid2, po_id, supplierName, 2, addMonths(now, intervalMo), remainAmt, "", "PENDING", "ส่วนที่เหลือ", ts]);
          break;
        }
        case "CUSTOM":
        case "PARTIAL": {
          const schedule: any[] = cfg.installments ?? [];
          if (schedule.length > 0) {
            const baseId = await genId("LIA", sid, LIA_SHEET);
            const liaIds = nextLiaIds(baseId, schedule.length);
            schedule.forEach((item: any, i: number) => liabRows.push([
              liaIds[i], po_id, supplierName, i + 1,
              item.due_date, Number(item.amount),
              "", "PENDING", item.note || "", ts,
            ]));
          } else {
            // fallback: equal installments from row[14]
            const count = Number(row[14] ?? 0);
            if (count > 0) {
              const normalAmt = Math.round((costTotal / count) * 100) / 100;
              const lastAmt   = Math.round((costTotal - normalAmt * (count - 1)) * 100) / 100;
              const baseId    = await genId("LIA", sid, LIA_SHEET);
              const liaIds    = nextLiaIds(baseId, count);
              liaIds.forEach((lid, i) => liabRows.push([
                lid, po_id, supplierName, i + 1,
                addMonths(now, i + 1),
                i === count - 1 ? lastAmt : normalAmt,
                "", "PENDING", "", ts,
              ]));
            }
          }
          break;
        }
        // FULL: ไม่สร้าง Liabilities
      }

      if (liabRows.length > 0) await saAppendRows(sid, `${LIA_SHEET}!A:J`, liabRows);

      saInvalidateCache(sid);
      return NextResponse.json({ ok: true, po_id, status: "APPROVED", liabilities_created: liabRows.length });
    }

    // ─── CANCEL ───────────────────────────────────────────────────
    if (action === "cancel") {
      if (!["PENDING", "APPROVED"].includes(currentStatus))
        return NextResponse.json({ error: "ยกเลิกได้เฉพาะ PENDING หรือ APPROVED" }, { status: 400 });

      row[22] = "CANCELLED";
      if (note) row[23] = note;
      await saUpdateRow(sid, `${PO_SHEET}!A${rowIdx + 1}`, row);
      saInvalidateCache(sid);
      return NextResponse.json({ ok: true, po_id, status: "CANCELLED" });
    }

    // ─── STOCK-IN ─────────────────────────────────────────────────
    if (action === "stock-in") {
      if (currentStatus !== "APPROVED")
        return NextResponse.json({ error: "PO ต้องมีสถานะ APPROVED เพื่อรับสินค้า" }, { status: 400 });
      if (!expiry_date)
        return NextResponse.json({ error: "กรุณาระบุวันหมดอายุ (expiry_date)" }, { status: 400 });

      const productId     = String(row[1]  ?? "");
      const productName   = String(row[2]  ?? "");
      const category      = String(row[3]  ?? "");
      const brand         = String(row[4]  ?? "");
      const unit          = String(row[5]  ?? "");
      const unitPkg       = String(row[6]  ?? "");
      const qtyPerPkg     = Number(row[7]  ?? 1);
      const qtyUnit       = Number(row[9]  ?? 0);
      const costTotal     = Number(row[11] ?? 0);
      const supplierName  = String(row[12] ?? "");
      const paymentMethod = String(row[13] ?? "FULL");
      const costPerUnit   = qtyUnit > 0 ? costTotal / qtyUnit : 0;
      const today         = bangkokToday();
      const lotId         = await genId("LOT", sid, "INV_Lots");

      await saAppendRow(sid, "INV_Lots!A:P", [
        lotId, productId, productName, category, brand, unit, unitPkg,
        qtyPerPkg, qtyUnit, qtyUnit,   // qty_original, qty_remaining
        expiry_date, today, po_id, supplierName, ts, costPerUnit,
      ]);

      row[19] = today;
      row[20] = lotId;
      row[21] = expiry_date;
      row[22] = "RECEIVED";
      if (note) row[23] = note;

      if (paymentMethod === "FULL") {
        row[16] = costTotal; // paid_amount
        row[17] = 0;         // outstanding_amount
      }

      await saUpdateRow(sid, `${PO_SHEET}!A${rowIdx + 1}`, row);

      await recordStockLedger({
        sid, productName, category, brand, unit,
        txnType: "IN", qty: qtyUnit, unitCost: costPerUnit,
        referenceId: po_id,
        note: note || `รับเข้า Lot ${lotId}`,
        createdBy: ctx.email,
      });

      saInvalidateCache(sid);
      return NextResponse.json({ ok: true, po_id, lot_id: lotId, status: "RECEIVED" });
    }

    return NextResponse.json({ error: "action ไม่ถูกต้อง: approve | cancel | stock-in" }, { status: 400 });
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
