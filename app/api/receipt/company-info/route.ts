/**
 * Receipt Company Info API — ดึงข้อมูลบริษัทสำหรับออกใบเสร็จ
 * path: app/api/receipt/company-info/route.ts
 *
 * GET /api/receipt/company-info?spreadsheetId=&sheetName=company_info
 *   → อ่าน sheet company_info (format: A=key | B=value) แล้วคืน object { key: value }
 *   → เช่น { company_name: "บริษัท X", tax_id: "0123456789", address: "..." }
 *   → ใช้พิมพ์ header บนใบเสร็จ
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
    const sheetName = searchParams.get("sheetName") || "company_info";

    if (!spreadsheetId) {
      return NextResponse.json({ error: "Missing required parameter: spreadsheetId", code: "MISSING_PARAMS" }, { status: 400 });
    }

    const rows = await saReadRange(spreadsheetId, `${sheetName}!A:Z`);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Company info sheet is empty", code: "EMPTY_SHEET" }, { status: 404 });
    }

    const companyInfo: Record<string, string> = {};
    rows.forEach((row: string[]) => {
      if (row.length >= 2) {
        const key   = row[0]?.toString().trim();
        const value = row[1]?.toString().trim();
        if (key && value) companyInfo[key] = value;
      }
    });

    console.log(`✅ [${requestId}] receipt/company-info loaded`);

    return NextResponse.json({ success: true, spreadsheetId, sheetName, companyInfo });

  } catch (error: any) {
    console.error(`❌ [${requestId}] receipt/company-info:`, error.message);
    return NextResponse.json({ error: "Internal server error", message: error.message }, { status: 500 });
  }
}
