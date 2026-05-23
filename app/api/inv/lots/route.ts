/**
 * GET    /api/inv/lots — รายการ lots (central)
 * DELETE /api/inv/lots — ลบ Lot (Super Admin only, ลบแถวจริงออกจาก INV_Lots)
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saGetSheetMeta, saStructuralBatchUpdate, saUpdateRow, saInvalidateCache } from "@/lib/google-sa";
import { getInvAccess } from "@/lib/inv-access";

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (!access.centralSheetId)
      return NextResponse.json({ error: "Central INV not configured" }, { status: 400 });

    const { searchParams } = request.nextUrl;
    const productIdFilter = searchParams.get("productId") || "";
    const availableOnly   = searchParams.get("available") === "true";

    const rows = await saReadRange(access.centralSheetId, "INV_Lots!A:P");

    let lots = rows.slice(1).map((r: any[]) => ({
      lot_id:        (r[0]  ?? "").toString(),
      product_id:    (r[1]  ?? "").toString(),
      product_name:  (r[2]  ?? "").toString(),
      category:      (r[3]  ?? "").toString(),
      brand:         (r[4]  ?? "").toString(),
      unit:          (r[5]  ?? "").toString(),
      unit_pkg:      (r[6]  ?? "").toString(),
      qty_per_pkg:   Number(r[7] ?? 1),
      qty_original:  Number(r[8] ?? 0),
      qty_remaining: Number(r[9] ?? 0),
      expiry_date:   (r[10] ?? "").toString(),
      purchase_date: (r[11] ?? "").toString(),
      purchase_id:   (r[12] ?? "").toString(),
      supplier:      (r[13] ?? "").toString(),
      created_at:    (r[14] ?? "").toString(),
      cost_per_unit: Number(r[15] ?? 0),
    })).filter((l) => l.lot_id);

    if (productIdFilter)
      lots = lots.filter((l) => l.product_id.toString() === productIdFilter);

    if (availableOnly)
      lots = lots.filter((l) => l.qty_remaining > 0);

    // Sort by expiry_date ASC (FIFO)
    lots.sort((a, b) => {
      if (!a.expiry_date) return 1;
      if (!b.expiry_date) return -1;
      return a.expiry_date.localeCompare(b.expiry_date);
    });

    return NextResponse.json({ lots });
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

    const { lot_id, qty_remaining, expiry_date, supplier, cost_per_unit } = await request.json();
    if (!lot_id) return NextResponse.json({ error: "lot_id required" }, { status: 400 });

    const sid   = access.centralSheetId;
    const rows  = await saReadRange(sid, "INV_Lots!A:P", 0);
    const rowIdx = rows.findIndex((r, i) => i > 0 && (r[0] ?? "").toString() === lot_id);
    if (rowIdx < 1) return NextResponse.json({ error: "Lot not found" }, { status: 404 });

    const updated = [...rows[rowIdx]];
    if (qty_remaining !== undefined) updated[9]  = Number(qty_remaining);
    if (expiry_date   !== undefined) updated[10] = expiry_date;
    if (supplier      !== undefined) updated[13] = supplier;
    if (cost_per_unit !== undefined) updated[15] = Number(cost_per_unit);

    await saUpdateRow(sid, `INV_Lots!A${rowIdx + 1}`, updated);
    saInvalidateCache(sid);

    return NextResponse.json({ ok: true, lot_id });
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

    const { lot_id } = await request.json();
    if (!lot_id) return NextResponse.json({ error: "lot_id required" }, { status: 400 });

    const sid = access.centralSheetId;

    // Find lot row (1-based index in sheet)
    const rows     = await saReadRange(sid, "INV_Lots!A:P", 0);
    const rowIdx   = rows.findIndex((r, i) => i > 0 && (r[0] ?? "").toString() === lot_id);
    if (rowIdx < 1) return NextResponse.json({ error: "Lot not found" }, { status: 404 });

    const lotRow       = rows[rowIdx];
    const qtyOriginal  = Number(lotRow[8] ?? 0);
    const qtyRemaining = Number(lotRow[9] ?? 0);
    const purchaseId   = (lotRow[12] ?? "").toString();

    // Delete the row using deleteDimension (0-based: rowIdx is already 1-based data index → sheet row = rowIdx+1, 0-based = rowIdx)
    const { sheetId } = await saGetSheetMeta(sid, "INV_Lots");
    await saStructuralBatchUpdate(sid, [{
      deleteDimension: {
        range: {
          sheetId,
          dimension: "ROWS",
          startIndex: rowIdx,       // 0-based: row 0 = header, rowIdx = correct data row
          endIndex:   rowIdx + 1,
        },
      },
    }]);

    // Clear lot_id reference in linked INV_Purchase row (non-blocking)
    if (purchaseId) {
      try {
        const poRows  = await saReadRange(sid, "INV_Purchase!A:T", 0);
        const poIdx   = poRows.findIndex((r, i) => i > 0 && (r[0] ?? "").toString() === purchaseId);
        if (poIdx >= 1) {
          const updated = [...poRows[poIdx]];
          updated[15] = ""; // lot_id column
          await saUpdateRow(sid, `INV_Purchase!A${poIdx + 1}`, updated);
        }
      } catch { /* non-blocking */ }
    }

    saInvalidateCache(sid);

    return NextResponse.json({
      ok: true,
      lot_id,
      was_partial: qtyRemaining < qtyOriginal,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
