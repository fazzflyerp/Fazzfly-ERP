/**
 * GET /api/master/data-demo
 * DEMO version — อ่านข้อมูลจาก client spreadsheet ด้วย Service Account
 *
 * เปลี่ยนจาก OAuth accessToken → SA เพราะ accessToken หมดอายุได้ ทำให้ลูกค้าเห็น 401
 * ต้องการ: spreadsheet ถูก share ให้ SA email (เช่นเดียวกับ payroll / finance ที่ใช้ SA อยู่แล้ว)
 *
 * Query: spreadsheetId, sheetName, includeHeader
 * Response: { success, count, rows, allRows (ถ้า includeHeader=true) }
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange } from "@/lib/google-sa";

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const spreadsheetId = searchParams.get("spreadsheetId") || "";
    const sheetName     = searchParams.get("sheetName")     || "";
    const includeHeader = searchParams.get("includeHeader") === "true";

    if (!spreadsheetId || !sheetName)
      return NextResponse.json({ error: "Missing spreadsheetId or sheetName" }, { status: 400 });

    let allRows: any[][];
    try {
      allRows = await saReadRange(spreadsheetId, sheetName);
    } catch (err: any) {
      const msg = (err?.message || "").toLowerCase();
      if (msg.includes("unable to parse range") || msg.includes("not found") || msg.includes("404")) {
        return NextResponse.json(
          { error: `ไม่พบ sheet ชื่อ "${sheetName}" — กรุณาตรวจสอบชื่อ sheet ในไฟล์ Google Sheets` },
          { status: 404 }
        );
      }
      throw err;
    }

    const rows = allRows.slice(1);

    return NextResponse.json({
      success: true,
      count: rows.length,
      rows,
      ...(includeHeader ? { allRows } : {}),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "โหลดข้อมูลไม่สำเร็จ" }, { status: 500 });
  }
}
