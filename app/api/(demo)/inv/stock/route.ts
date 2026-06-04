/**
 * GET   /api/inv/stock — อ่าน stock (central = INV_Lots, branch = INV_Stock)
 * PATCH /api/inv/stock — แก้ไข qty_remaining ของ branch stock entry (SA only)
 * DELETE /api/inv/stock — ลบ branch stock entry (SA only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saUpdateRow, saGetSheetMeta, saStructuralBatchUpdate, saInvalidateCache } from "@/lib/google-sa";
import { getInvAccess } from "@/lib/inv-access";

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = request.nextUrl;
    const type       = searchParams.get("type") || "branch";
    const branchIdQ  = searchParams.get("branchId") || "";

    // Return branch list for SA (used to populate branch switcher)
    if (type === "branchList") {
      if (access.role !== "SUPER_ADMIN")
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      return NextResponse.json({ branches: access.allBranchSheets.map((b) => ({ branchId: b.branchId, branchName: b.branchName })) });
    }

    if (type === "central") {
      if (access.role !== "SUPER_ADMIN")
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (!access.centralSheetId)
        return NextResponse.json({ error: "Central INV not configured" }, { status: 400 });

      const rows = await saReadRange(access.centralSheetId, "INV_Lots!A:O");
      const lots = rows.slice(1).map((r: any[]) => ({
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
      })).filter((l) => l.lot_id);

      return NextResponse.json({ type: "central", stock: lots });
    }

    // Branch stock
    let targetSheetId = access.branchSheetId;

    if (branchIdQ && access.role === "SUPER_ADMIN") {
      const branchSheet = access.allBranchSheets.find((b) => b.branchId === branchIdQ);
      if (!branchSheet)
        return NextResponse.json({ error: "Branch not found" }, { status: 404 });
      targetSheetId = branchSheet.sheetId;
    }

    if (!targetSheetId)
      return NextResponse.json({ error: "Branch INV not configured" }, { status: 400 });

    const rows = await saReadRange(targetSheetId, "INV_Stock!A:Q");
    const stock = rows.slice(1).map((r: any[]) => ({
      stock_id:        (r[0]  ?? "").toString(),
      product_id:      (r[1]  ?? "").toString(),
      product_name:    (r[2]  ?? "").toString(),
      category:        (r[3]  ?? "").toString(),
      brand:           (r[4]  ?? "").toString(),
      unit:            (r[5]  ?? "").toString(),
      unit_pkg:        (r[6]  ?? "").toString(),
      lot_id:          (r[7]  ?? "").toString(),
      qty_received:    Number(r[8] ?? 0),
      qty_remaining:   Number(r[9] ?? 0),
      expiry_date:     (r[10] ?? "").toString(),
      transfer_id:     (r[11] ?? "").toString(),
      received_at:     (r[12] ?? "").toString(),
      cost_per_unit:   Number(r[13] ?? 0),
      parent_stock_id: (r[14] ?? "").toString(),
      is_opened:       (r[15] ?? "").toString().toLowerCase() === "true",
      opened_at:       (r[16] ?? "").toString(),
    })).filter((s) => s.stock_id);

    // Warning: expiry ≤ 30 days
    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    const warn30 = new Date(today);
    warn30.setDate(today.getDate() + 30);

    const stockWithWarning = stock.map((s) => {
      let expiryWarning = false;
      if (s.expiry_date) {
        const exp = new Date(s.expiry_date);
        expiryWarning = exp <= warn30;
      }
      return { ...s, expiry_warning: expiryWarning };
    });

    return NextResponse.json({ type: "branch", stock: stockWithWarning });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function resolveBranchSheet(access: any, branchIdQ: string) {
  if (branchIdQ && access.role === "SUPER_ADMIN") {
    const b = access.allBranchSheets.find((x: any) => x.branchId === branchIdQ);
    return b?.sheetId ?? null;
  }
  return access.branchSheetId;
}

export async function PATCH(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access || access.role !== "SUPER_ADMIN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { stock_id, qty_remaining, branch_id } = await request.json();
    if (!stock_id) return NextResponse.json({ error: "stock_id required" }, { status: 400 });

    const targetSheetId = await resolveBranchSheet(access, branch_id || "");
    if (!targetSheetId) return NextResponse.json({ error: "Branch INV not configured" }, { status: 400 });

    const rows   = await saReadRange(targetSheetId, "INV_Stock!A:Q", 0);
    const rowIdx = rows.findIndex((r, i) => i > 0 && (r[0] ?? "").toString() === stock_id);
    if (rowIdx < 1) return NextResponse.json({ error: "Stock entry not found" }, { status: 404 });

    const updated = [...rows[rowIdx]];
    if (qty_remaining !== undefined) updated[9] = Number(qty_remaining);
    await saUpdateRow(targetSheetId, `INV_Stock!A${rowIdx + 1}`, updated);

    saInvalidateCache(targetSheetId);
    return NextResponse.json({ ok: true, stock_id });
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

    const { stock_id, branch_id } = await request.json();
    if (!stock_id) return NextResponse.json({ error: "stock_id required" }, { status: 400 });

    const targetSheetId = await resolveBranchSheet(access, branch_id || "");
    if (!targetSheetId) return NextResponse.json({ error: "Branch INV not configured" }, { status: 400 });

    const rows   = await saReadRange(targetSheetId, "INV_Stock!A:Q", 0);
    const rowIdx = rows.findIndex((r, i) => i > 0 && (r[0] ?? "").toString() === stock_id);
    if (rowIdx < 1) return NextResponse.json({ error: "Stock entry not found" }, { status: 404 });

    const { sheetId } = await saGetSheetMeta(targetSheetId, "INV_Stock");
    await saStructuralBatchUpdate(targetSheetId, [{
      deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: rowIdx, endIndex: rowIdx + 1 } },
    }]);

    saInvalidateCache(targetSheetId);
    return NextResponse.json({ ok: true, stock_id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
