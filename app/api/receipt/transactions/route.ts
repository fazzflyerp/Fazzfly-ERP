/**
 * Receipt Transactions API — ดึงรายการ transaction สำหรับออกใบเสร็จ
 * path: app/api/receipt/transactions/route.ts
 *
 * GET /api/receipt/transactions?spreadsheetId=&sheetName=
 *   → อ่าน sheet ทั้งหมดแล้วคืน transactions[] พร้อม rowIndex
 *   → ใช้เลือกรายการที่จะพิมพ์เป็นใบเสร็จ
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange } from "@/lib/google-sa";

export async function GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);

  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const spreadsheetId = searchParams.get("spreadsheetId");
    const sheetName = searchParams.get("sheetName");

    if (!spreadsheetId || !sheetName) {
      return NextResponse.json({ error: "Missing required parameters", code: "MISSING_PARAMS" }, { status: 400 });
    }

    const rows = await saReadRange(spreadsheetId, `${sheetName}!A:AZ`);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Transaction sheet is empty", code: "EMPTY_SHEET" }, { status: 404 });
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    const transactions = dataRows.map((row: any[], index: number) => ({
      rowIndex: index + 2,
      data: row,
    }));

    console.log(`✅ [${requestId}] receipt/transactions — ${transactions.length} rows`);

    return NextResponse.json({ success: true, spreadsheetId, sheetName, headers, transactions, count: transactions.length });

  } catch (error: any) {
    console.error(`❌ [${requestId}] receipt/transactions:`, error.message);
    return NextResponse.json({ error: "Internal server error", message: error.message }, { status: 500 });
  }
}
