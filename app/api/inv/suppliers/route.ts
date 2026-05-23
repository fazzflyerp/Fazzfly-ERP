/**
 * GET /api/inv/suppliers
 * ดึงรายการ suppliers จาก Central INV spreadsheet → sheet "Suppliers"
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

    if (!access.centralSheetId)
      return NextResponse.json({ error: "Central INV not configured" }, { status: 400 });

    const rows = await saReadRange(access.centralSheetId, "Suppliers!A:Z");
    if (rows.length < 2) return NextResponse.json({ suppliers: [] });

    const headers = rows[0].map((h: any) => (h ?? "").toString().toLowerCase().trim());

    let nameCol = headers.findIndex((h: string) =>
      h === "supplier_name" || h === "supplier" || h === "name"
    );
    if (nameCol < 0) nameCol = 0;

    const suppliers = rows.slice(1)
      .map((row: any[]) => (row[nameCol] ?? "").toString().trim())
      .filter(Boolean);

    return NextResponse.json({ suppliers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
