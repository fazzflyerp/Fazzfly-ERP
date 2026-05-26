/**
 * GET    /api/inv/po — list all POs (Super Admin only)
 * POST   /api/inv/po — create PO with status=PENDING (no lot yet)
 * PATCH  /api/inv/po — action: approve | cancel | stock-in
 * DELETE /api/inv/po — delete PENDING or CANCELLED PO
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  saReadRange, saAppendRow, saAppendRows, saUpdateRow,
  saInvalidateCache, saGetSheetMeta, saStructuralBatchUpdate,
} from "@/lib/google-sa";
import { getInvAccess, genId, thaiTimestamp } from "@/lib/inv-access";

const PO_SHEET = "PO";
const PO_RANGE = "PO!A:AB";
const LIA_SHEET = "Liabilities";

function parsePoRow(r: any[]) {
  return {
    po_id:                  String(r[0] ?? ""),
    product_id:             String(r[1] ?? ""),
    product_name:           String(r[2] ?? ""),
    category:               String(r[3] ?? ""),
    brand:                  String(r[4] ?? ""),
    unit:                   String(r[5] ?? ""),
    unit_pkg:               String(r[6] ?? ""),
    qty_per_pkg:            String(r[7] ?? ""),
    qty_ordered:            String(r[8] ?? ""),
    qty_unit:               String(r[9] ?? ""),
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
  };
}

function nextLiaIds(baseId: string, count: number): string[] {
  const parts = baseId.split("-");
  const base = parseInt(parts[parts.length - 1], 10);
  return Array.from({ length: count }, (_, i) => {
    const copy = [...parts];
    copy[copy.length - 1] = String(base + i).padStart(3, "0");
    return copy.join("-");
  });
}

function bangkokToday(): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function addMonths(base: Date, months: number): string {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

async function auth(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.email) return null;
  const email = (token.email as string).toLowerCase().trim();
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

    const rows = await saReadRange(ctx.sid, PO_RANGE, 0);
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
      payment_method = "FULL",
      installments_count = 0,
      expected_delivery, note,
    } = body;

    if (!product_name || !qty_ordered || !cost_total) {
      return NextResponse.json({ error: "กรุณากรอก: product_name, qty_ordered, cost_total" }, { status: 400 });
    }

    const sid = ctx.sid;
    const ts = thaiTimestamp();
    const poId = await genId("PO", sid, PO_SHEET);

    const qtyOrdered = Number(qty_ordered);
    const qtyPerPkg = Number(qty_per_pkg) || 1;
    const qtyUnit = qtyOrdered * qtyPerPkg;
    const costTotal = Number(cost_total);
    const costPerUnit = qtyUnit > 0 ? costTotal / qtyUnit : 0;
    const instCount = Number(installments_count) || 0;
    const amtPerInst = instCount > 0 ? Math.round((costTotal / instCount) * 100) / 100 : 0;

    await saAppendRow(sid, `${PO_SHEET}!A:AB`, [
      poId,
      product_id ?? "",
      product_name,
      category ?? "",
      brand ?? "",
      unit ?? "",
      unit_pkg ?? "",
      qtyPerPkg,
      qtyOrdered,
      qtyUnit,
      costPerUnit,
      costTotal,
      supplier_name ?? "",
      payment_method,
      instCount,
      amtPerInst,
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
    const ts = thaiTimestamp();

    const rows = await saReadRange(sid, PO_RANGE, 0);
    const rowIdx = rows.findIndex((r, i) => i > 0 && String(r[0] ?? "") === po_id);
    if (rowIdx < 1) return NextResponse.json({ error: "PO not found" }, { status: 404 });

    const row = [...rows[rowIdx]];
    // Pad row to 28 columns
    while (row.length < 28) row.push("");
    const currentStatus = String(row[22] ?? "");

    // ─── APPROVE ──────────────────────────────────────────────
    if (action === "approve") {
      if (currentStatus !== "PENDING")
        return NextResponse.json({ error: "PO ต้องมีสถานะ PENDING เพื่ออนุมัติ" }, { status: 400 });

      row[22] = "APPROVED";
      row[26] = ctx.email;
      row[27] = ts;
      await saUpdateRow(sid, `${PO_SHEET}!A${rowIdx + 1}`, row);

      const paymentMethod = String(row[13] ?? "FULL");
      const instCount = Number(row[14] ?? 0);
      const amtPerInst = Number(row[15] ?? 0);
      const supplierName = String(row[12] ?? "");
      const costTotal = Number(row[11] ?? 0);

      // Create liability rows for INSTALLMENT / PARTIAL
      if ((paymentMethod === "INSTALLMENT" || paymentMethod === "PARTIAL") && instCount > 0) {
        const baseId = await genId("LIA", sid, LIA_SHEET);
        const liaIds = nextLiaIds(baseId, instCount);
        const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));

        // Calculate last installment to absorb rounding difference
        const normalAmt = Math.round((costTotal / instCount) * 100) / 100;
        const lastAmt = Math.round((costTotal - normalAmt * (instCount - 1)) * 100) / 100;

        const liabRows: any[][] = liaIds.map((lid, i) => [
          lid,
          po_id,
          supplierName,
          i + 1,
          addMonths(now, i + 1),
          i === instCount - 1 ? lastAmt : normalAmt,
          "",         // paid_date
          "PENDING",
          "",         // note
          ts,
        ]);

        await saAppendRows(sid, `${LIA_SHEET}!A:J`, liabRows);
      }

      saInvalidateCache(sid);
      return NextResponse.json({ ok: true, po_id, status: "APPROVED" });
    }

    // ─── CANCEL ───────────────────────────────────────────────
    if (action === "cancel") {
      if (!["PENDING", "APPROVED"].includes(currentStatus))
        return NextResponse.json({ error: "ยกเลิกได้เฉพาะ PENDING หรือ APPROVED" }, { status: 400 });

      row[22] = "CANCELLED";
      if (note) row[23] = note;
      await saUpdateRow(sid, `${PO_SHEET}!A${rowIdx + 1}`, row);

      saInvalidateCache(sid);
      return NextResponse.json({ ok: true, po_id, status: "CANCELLED" });
    }

    // ─── STOCK-IN ─────────────────────────────────────────────
    if (action === "stock-in") {
      if (currentStatus !== "APPROVED")
        return NextResponse.json({ error: "PO ต้องมีสถานะ APPROVED เพื่อรับสินค้า" }, { status: 400 });
      if (!expiry_date)
        return NextResponse.json({ error: "กรุณาระบุวันหมดอายุ (expiry_date)" }, { status: 400 });

      const productId    = String(row[1] ?? "");
      const productName  = String(row[2] ?? "");
      const category     = String(row[3] ?? "");
      const brand        = String(row[4] ?? "");
      const unit         = String(row[5] ?? "");
      const unitPkg      = String(row[6] ?? "");
      const qtyPerPkg    = Number(row[7] ?? 1);
      const qtyUnit      = Number(row[9] ?? 0);
      const costTotal    = Number(row[11] ?? 0);
      const supplierName = String(row[12] ?? "");
      const paymentMethod = String(row[13] ?? "FULL");
      const costPerUnit  = qtyUnit > 0 ? costTotal / qtyUnit : 0;
      const today        = bangkokToday();

      const lotId = await genId("LOT", sid, "INV_Lots");

      await saAppendRow(sid, "INV_Lots!A:P", [
        lotId, productId, productName, category, brand, unit, unitPkg,
        qtyPerPkg,
        qtyUnit,    // qty_original
        qtyUnit,    // qty_remaining
        expiry_date,
        today,      // purchase_date
        po_id,      // purchase_id (references PO)
        supplierName,
        ts,
        costPerUnit,
      ]);

      row[19] = today;       // received_date
      row[20] = lotId;       // lot_id
      row[21] = expiry_date; // expiry_date
      row[22] = "RECEIVED";
      if (note) row[23] = note;

      // Mark FULL payment as fully paid on stock-in
      if (paymentMethod === "FULL") {
        row[16] = costTotal; // paid_amount
        row[17] = 0;         // outstanding_amount
      }

      await saUpdateRow(sid, `${PO_SHEET}!A${rowIdx + 1}`, row);
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

    const sid = ctx.sid;

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
