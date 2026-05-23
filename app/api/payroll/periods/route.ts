/**
 * GET /api/payroll/periods?spreadsheetId=&sheetName=Helper
 * คืน distinct period values จาก col AD ของ Helper sheet เรียงล่าสุดก่อน
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange } from "@/lib/google-sa";
import { verifySheetAccess } from "@/lib/verify-sheet-access";

const THAI_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

function periodToNum(p: string): number {
  const parts = p.trim().split(/\s+/);
  const mIdx = THAI_MONTHS.indexOf(parts[0]);
  const year  = parseInt(parts[1] || "0");
  return year * 12 + mIdx;
}

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const spreadsheetId = searchParams.get("spreadsheetId");
    const sheetName     = searchParams.get("sheetName") || "Helper";

    if (!spreadsheetId) return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });

    const userEmail = ((token as any)?.email as string || "").toLowerCase();
    const access = await verifySheetAccess(userEmail, spreadsheetId);
    if (!access.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const rows = await saReadRange(spreadsheetId, `${sheetName}!AD:AD`);

    const seen = new Set<string>();
    rows.slice(1).forEach((row) => {
      const val = (row[0] || "").toString().trim();
      if (val) seen.add(val);
    });

    const periods = Array.from(seen).sort((a, b) => periodToNum(b) - periodToNum(a));

    return NextResponse.json({ periods });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
