/**
 * GET   /api/inv/purchase  — รายการ PO ทั้งหมด (Super Admin only)
 * POST  /api/inv/purchase  — สร้าง PO ใหม่ + สร้าง Lot อัตโนมัติ (Super Admin only)
 * PATCH /api/inv/purchase  — แก้ไข PO + sync INV_Lots (Super Admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saAppendRow, saUpdateRow, saInvalidateCache, saGetSheetMeta, saStructuralBatchUpdate } from "@/lib/google-sa";
import { getInvAccess, genId, thaiTimestamp } from "@/lib/inv-access";

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access || access.role !== "SUPER_ADMIN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (!access.centralSheetId)
      return NextResponse.json({ error: "Central INV not configured" }, { status: 400 });

    const rows = await saReadRange(access.centralSheetId, "INV_Purchase!A:T", 0);
    const purchases = rows.slice(1).map((r: any[]) => ({
      purchase_id:   r[0] ?? "",
      product_id:    r[1] ?? "",
      product_name:  r[2] ?? "",
      category:      r[3] ?? "",
      brand:         r[4] ?? "",
      unit:          r[5] ?? "",
      unit_pkg:      r[6] ?? "",
      qty_per_pkg:   r[7] ?? "",
      qty_ordered:   r[8] ?? "",
      qty_unit:      r[9] ?? "",
      cost_per_pkg:  r[10] ?? "",
      cost_total:    r[11] ?? "",
      supplier:      r[12] ?? "",
      purchase_date: r[13] ?? "",
      expiry_date:   r[14] ?? "",
      lot_id:        r[15] ?? "",
      status:        r[16] ?? "",
      note:          r[17] ?? "",
      created_by:    r[18] ?? "",
      created_at:    r[19] ?? "",
    }));

    return NextResponse.json({ purchases });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access || access.role !== "SUPER_ADMIN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (!access.centralSheetId)
      return NextResponse.json({ error: "Central INV not configured" }, { status: 400 });

    const body = await request.json();
    const {
      product_id, product_name, category, brand, unit, unit_pkg,
      qty_per_pkg, qty_ordered, cost_total, supplier,
      purchase_date, expiry_date, note,
    } = body;

    if (!product_name || !qty_ordered || !purchase_date || !expiry_date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const sid = access.centralSheetId;
    const ts  = thaiTimestamp();

    const [purchaseId, lotId] = await Promise.all([
      genId("PO",  sid, "INV_Purchase"),
      genId("LOT", sid, "INV_Lots"),
    ]);

    const qtyOrdered = Number(qty_ordered);
    const qtyPerPkg  = Number(qty_per_pkg) || 1;
    const qtyUnit    = qtyOrdered * qtyPerPkg;
    const costTotal  = Number(cost_total) || 0;
    const costPkg    = qtyOrdered > 0 ? costTotal / qtyOrdered : 0;

    // Append to INV_Purchase
    await saAppendRow(sid, "INV_Purchase!A:T", [
      purchaseId, product_id, product_name, category, brand, unit, unit_pkg,
      qty_per_pkg, qtyOrdered, qtyUnit, costPkg, costTotal,
      supplier, purchase_date, expiry_date, lotId,
      "received", note || "", email, ts,
    ]);

    const costPerUnit = qtyUnit > 0 ? costTotal / qtyUnit : 0;

    // Append to INV_Lots (A:P — col P = cost_per_unit)
    await saAppendRow(sid, "INV_Lots!A:P", [
      lotId, product_id, product_name, category, brand, unit, unit_pkg,
      qty_per_pkg, qtyUnit, qtyUnit, // qty_original + qty_remaining
      expiry_date, purchase_date, purchaseId, supplier, ts, costPerUnit,
    ]);

    saInvalidateCache(sid);

    return NextResponse.json({ purchase_id: purchaseId, lot_id: lotId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access || access.role !== "SUPER_ADMIN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (!access.centralSheetId)
      return NextResponse.json({ error: "Central INV not configured" }, { status: 400 });

    const { purchase_id } = await request.json();
    if (!purchase_id) return NextResponse.json({ error: "purchase_id required" }, { status: 400 });

    const sid = access.centralSheetId;

    const poRows   = await saReadRange(sid, "INV_Purchase!A:T", 0);
    const poRowIdx = poRows.findIndex((r, i) => i > 0 && (r[0] ?? "").toString() === purchase_id);
    if (poRowIdx < 1) return NextResponse.json({ error: "PO not found" }, { status: 404 });

    const lotId = (poRows[poRowIdx][15] ?? "").toString();

    // Delete PO row
    const { sheetId: poSheetId } = await saGetSheetMeta(sid, "INV_Purchase");
    await saStructuralBatchUpdate(sid, [{
      deleteDimension: { range: { sheetId: poSheetId, dimension: "ROWS", startIndex: poRowIdx, endIndex: poRowIdx + 1 } },
    }]);

    // Delete linked lot if it has no outgoing transfers
    if (lotId) {
      const tfrRows = await saReadRange(sid, "INV_Transfer!A:L", 0);
      const hasTransfer = tfrRows.slice(1).some((r) => (r[7] ?? "").toString() === lotId);
      if (!hasTransfer) {
        const lotsRows  = await saReadRange(sid, "INV_Lots!A:O", 0);
        const lotRowIdx = lotsRows.findIndex((r, i) => i > 0 && (r[0] ?? "").toString() === lotId);
        if (lotRowIdx >= 1) {
          const { sheetId: lotSheetId } = await saGetSheetMeta(sid, "INV_Lots");
          await saStructuralBatchUpdate(sid, [{
            deleteDimension: { range: { sheetId: lotSheetId, dimension: "ROWS", startIndex: lotRowIdx, endIndex: lotRowIdx + 1 } },
          }]);
        }
      }
    }

    saInvalidateCache(sid);
    return NextResponse.json({ ok: true, purchase_id, lot_deleted: !!lotId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access || access.role !== "SUPER_ADMIN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (!access.centralSheetId)
      return NextResponse.json({ error: "Central INV not configured" }, { status: 400 });

    const { purchase_id, qty_ordered, cost_total, supplier, purchase_date, expiry_date, note } = await request.json();
    if (!purchase_id) return NextResponse.json({ error: "purchase_id required" }, { status: 400 });

    const sid = access.centralSheetId;

    // Find PO row
    const poRows   = await saReadRange(sid, "INV_Purchase!A:T", 0);
    const poRowIdx = poRows.findIndex((r, i) => i > 0 && (r[0] ?? "").toString() === purchase_id);
    if (poRowIdx < 1) return NextResponse.json({ error: "PO not found" }, { status: 404 });

    const poRow      = poRows[poRowIdx];
    const lotId      = (poRow[15] ?? "").toString();
    const oldQtyOrd  = Number(poRow[8] ?? 0);
    const qtyPerPkg  = Number(poRow[7] ?? 1);

    const newQtyOrd  = qty_ordered !== undefined ? Number(qty_ordered) : oldQtyOrd;
    const newQtyUnit = newQtyOrd * qtyPerPkg;
    const newCostTotal = cost_total !== undefined ? Number(cost_total) : Number(poRow[11] ?? 0);
    const newCostPkg   = newQtyOrd > 0 ? newCostTotal / newQtyOrd : 0;

    // Update INV_Purchase row
    const updatedPO = [...poRow];
    updatedPO[8]  = newQtyOrd;
    updatedPO[9]  = newQtyUnit;
    updatedPO[10] = newCostPkg;
    updatedPO[11] = newCostTotal;
    if (supplier    !== undefined) updatedPO[12] = supplier;
    if (purchase_date !== undefined) updatedPO[13] = purchase_date;
    if (expiry_date !== undefined) updatedPO[14] = expiry_date;
    if (note        !== undefined) updatedPO[17] = note;
    await saUpdateRow(sid, `INV_Purchase!A${poRowIdx + 1}`, updatedPO);

    // Sync INV_Lots if qty or expiry changed
    if (lotId && (qty_ordered !== undefined || expiry_date !== undefined)) {
      const lotsRows  = await saReadRange(sid, "INV_Lots!A:O", 0);
      const lotRowIdx = lotsRows.findIndex((r, i) => i > 0 && (r[0] ?? "").toString() === lotId);
      if (lotRowIdx >= 1) {
        const lotRow       = lotsRows[lotRowIdx];
        const oldQtyUnit   = Number(lotRow[8] ?? 0);
        const oldRemaining = Number(lotRow[9] ?? 0);
        const delta        = newQtyUnit - oldQtyUnit;
        const newRemaining = Math.max(0, oldRemaining + delta);

        const newCostPerUnit = newQtyUnit > 0 ? newCostTotal / newQtyUnit : 0;

        const updatedLot = [...lotRow];
        updatedLot[8]  = newQtyUnit;
        updatedLot[9]  = newRemaining;
        if (expiry_date !== undefined) updatedLot[10] = expiry_date;
        updatedLot[15] = newCostPerUnit;
        await saUpdateRow(sid, `INV_Lots!A${lotRowIdx + 1}`, updatedLot);
      }
    }

    saInvalidateCache(sid);
    return NextResponse.json({ ok: true, purchase_id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
