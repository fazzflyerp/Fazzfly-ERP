/**
 * POST /api/rental/return
 * อัปเดต status → "คืนแล้ว" สำหรับ row ที่ระบุ
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saBatchUpdate, saInvalidateCache } from "@/lib/google-sa";

function colLetter(n: number): string {
  let s = "";
  for (let c = n + 1; c > 0; ) { c--; s = String.fromCharCode(65 + (c % 26)) + s; c = Math.floor(c / 26); }
  return s;
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { spreadsheetId, sheetName, rowIndex, statusColIdx } = await request.json();

    if (!spreadsheetId || !sheetName || rowIndex == null || statusColIdx == null)
      return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const col = colLetter(statusColIdx);
    await saBatchUpdate(spreadsheetId, [{
      range:  `${sheetName}!${col}${rowIndex}`,
      values: [["คืนแล้ว"]],
    }]);
    saInvalidateCache(spreadsheetId);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
