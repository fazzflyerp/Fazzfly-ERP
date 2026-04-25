/**
 * Module Data API — ดึงข้อมูลทั้งหมดจาก sheet ของ module
 * path: app/api/module/data/route.ts
 *
 * GET /api/module/data?spreadsheetId=&sheetName=&includeHeader=true|false
 *   → คืน rows[] ทุกแถวใน sheet (ข้าม header แถวแรก)
 *   → ถ้า includeHeader=true คืน allRows[] รวม header ด้วย
 *   → ใช้ใน edit page เพื่อแสดงข้อมูลในตาราง
 *
 * ✅ ตรวจสิทธิ์ verifySheetAccess ก่อนอ่าน
 * ✅ Cache 60 วิ (stale-while-revalidate 30 วิ)
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { withLogger } from "@/lib/with-logger";
import { saReadRange } from "@/lib/google-sa";
import { verifySheetAccess } from "@/lib/verify-sheet-access";

async function _GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const spreadsheetId = searchParams.get("spreadsheetId");
    const sheetName     = searchParams.get("sheetName");
    const includeHeader = searchParams.get("includeHeader") === "true";

    if (!spreadsheetId || !sheetName)
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });

    const userEmail = ((token as any)?.email as string || "").toLowerCase();
    const access = await verifySheetAccess(userEmail, spreadsheetId);
    if (!access.allowed)
      return NextResponse.json({ error: "Forbidden: sheet not owned by your client", code: "FORBIDDEN" }, { status: 403 });

    const values = await saReadRange(spreadsheetId, sheetName);
    const rows   = values.slice(1);

    return NextResponse.json(
      {
        success: true,
        count: rows.length,
        rows,
        ...(includeHeader ? { allRows: values } : {}),
      },
      { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=30" } }
    );

  } catch (error: any) {
    console.error("❌ [module/data] Error:", error.message);
    return NextResponse.json({ error: error.message || "Failed to fetch data" }, { status: 500 });
  }
}
export const GET = withLogger("/api/module/data", _GET);
