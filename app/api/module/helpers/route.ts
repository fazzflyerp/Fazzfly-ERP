/**
 * Helper / Dropdown Options API — ดึงตัวเลือก dropdown จาก helper sheet
 * path: app/api/module/helpers/route.ts
 *
 * GET /api/module/helpers?spreadsheetId=&helperName=
 *   → อ่านชีท helperName (เช่น Helper_OPD, Helper_Doctor) แล้วคืน options[]
 *   → ใช้ render dropdown ในฟอร์มกรอกข้อมูล ERP
 *
 * helper sheet: A=id | B=label | C=extra (optional)
 * ✅ ถ้าไม่พบ sheet → คืน options=[] แทน error (ไม่ block UI)
 * ✅ ตรวจสิทธิ์ verifySheetAccess ก่อนอ่าน
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { withLogger } from "@/lib/with-logger";
import { saReadRange } from "@/lib/google-sa";
import { verifySheetAccess } from "@/lib/verify-sheet-access";

async function _GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);

  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
    if ((token as any).error === "RefreshAccessTokenError")
      return NextResponse.json({ error: "Session expired", code: "TOKEN_EXPIRED" }, { status: 401 });

    const spreadsheetId = request.nextUrl.searchParams.get("spreadsheetId");
    const helperName    = request.nextUrl.searchParams.get("helperName");

    if (!spreadsheetId || !helperName)
      return NextResponse.json({ error: "Missing parameters", code: "MISSING_PARAMS" }, { status: 400 });

    const userEmail = ((token as any)?.email as string || "").toLowerCase();
    const access = await verifySheetAccess(userEmail, spreadsheetId);
    if (!access.allowed)
      return NextResponse.json({ error: "Forbidden: sheet not owned by your client", code: "FORBIDDEN" }, { status: 403 });

    let rows: any[][];
    try {
      rows = await saReadRange(spreadsheetId, `${helperName}!A:C`);
    } catch (error: any) {
      // Sheet not found → return empty (ไม่ error)
      return NextResponse.json(
        { success: true, helperName, options: [], totalOptions: 0, warning: `Helper sheet "${helperName}" not found` },
        { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" } }
      );
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { success: true, helperName, options: [], totalOptions: 0, warning: `Helper sheet "${helperName}" is empty` },
        { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" } }
      );
    }

    // detect ว่าแถวแรกเป็น header จริงมั้ย
    // ถ้า cell ใดใน row 1 ตรงกับ keyword → มี header → slice(1)
    // ถ้าไม่ตรง → ไม่มี header → ใช้ทั้งหมด
    const HEADER_KEYWORDS = ["id","value","name","label","detail","ชื่อ","รหัส","หมายเหตุ","รายละเอียด"];
    const firstRow = rows[0] || [];
    const hasHeader = firstRow.some((cell: any) =>
      HEADER_KEYWORDS.includes(cell?.toString().trim().toLowerCase())
    );
    const dataRows = hasHeader ? rows.slice(1) : rows;

    const options = dataRows
      .filter((row: any[]) => row[0])
      .map((row: any[]) => {
        const value  = row[0]?.toString() || "";
        const name   = row[1]?.toString() || value;
        const detail = row[2]?.toString() || "";
        return { value, label: detail ? `${name} - ${detail}` : name };
      });

    console.log(`✅ [${requestId}] Loaded ${options.length} options`);

    return NextResponse.json(
      { success: true, helperName, options, totalOptions: options.length },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" } }
    );

  } catch (error: any) {
    console.error(`❌ [${requestId}] ERROR:`, error.message);
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR", message: error.message }, { status: 500 });
  }
}
export const GET = withLogger("/api/module/helpers", _GET);
