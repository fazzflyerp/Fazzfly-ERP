/**
 * GET /api/inv/branch-log
 * อ่าน INV_BranchLog จากสาขา (LOST / TRANSFER_OUT / TRANSFER_IN / RETURN_CENTRAL)
 * Params: branchId (SA only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange } from "@/lib/google-sa";
import { getInvAccess } from "@/lib/inv-access";

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = request.nextUrl;
    const branchIdQ = searchParams.get("branchId") || "";

    // Resolve sheet
    let sheetId = access.branchSheetId;
    if (branchIdQ && access.role === "SUPER_ADMIN") {
      const b = (access.allBranchSheets as any[]).find((x) => x.branchId === branchIdQ);
      sheetId = b?.sheetId ?? null;
    }
    if (!sheetId) return NextResponse.json({ error: "Branch INV not configured" }, { status: 400 });

    // Read INV_BranchLog — return empty if sheet not yet created
    let rows: any[][] = [];
    try {
      rows = await saReadRange(sheetId, "INV_BranchLog!A:J", 0);
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      if (msg.includes("Unable to parse range") || msg.includes("not found")) {
        return NextResponse.json({ logs: [] });
      }
      throw err;
    }

    // columns: A=log_id B=log_date C=action_type D=product_name E=lot_id F=stock_id G=qty H=context I=note J=recorded_by
    const logs = rows.slice(1).map((r) => ({
      log_id:       (r[0] ?? "").toString(),
      log_date:     (r[1] ?? "").toString(),
      action_type:  (r[2] ?? "").toString(),
      product_name: (r[3] ?? "").toString(),
      lot_id:       (r[4] ?? "").toString(),
      stock_id:     (r[5] ?? "").toString(),
      qty:          Number(r[6] ?? 0),
      context:      (r[7] ?? "").toString(),
      note:         (r[8] ?? "").toString(),
      recorded_by:  (r[9] ?? "").toString(),
    })).filter((l) => l.log_id).reverse(); // newest first

    return NextResponse.json({ logs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
