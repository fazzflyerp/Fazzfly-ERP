/**
 * GET /api/helpers-branch?spreadsheetId=&helperName=&branchId=
 *
 * Helper API สำหรับ branch form
 * โครงสร้าง helper sheet:
 *   A = value/id
 *   B = branch_id (ถ้ามีค่า → กรองเฉพาะสาขานั้น, ถ้าว่าง → แสดงทุกสาขา)
 *   C = label/ชื่อ
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange } from "@/lib/google-sa";
import { verifySheetAccess } from "@/lib/verify-sheet-access";

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const spreadsheetId = searchParams.get("spreadsheetId");
    const helperName    = searchParams.get("helperName");
    const branchId      = (searchParams.get("branchId") || "").trim().toLowerCase();
    const fresh         = searchParams.get("fresh") === "1";

    if (!spreadsheetId || !helperName)
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });

    const userEmail = ((token as any)?.email as string || "").toLowerCase();
    const access = await verifySheetAccess(userEmail, spreadsheetId);
    if (!access.allowed)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    let rows: any[][];
    try {
      rows = await saReadRange(spreadsheetId, `${helperName}!A:C`, fresh ? 0 : undefined);
    } catch {
      return NextResponse.json({ success: true, helperName, options: [], totalOptions: 0 });
    }

    if (!rows || rows.length === 0)
      return NextResponse.json({ success: true, helperName, options: [], totalOptions: 0 });

    // detect header row
    const HEADER_KEYWORDS = ["id", "value", "name", "label", "branch", "สาขา", "ชื่อ", "รหัส"];
    const firstRow = rows[0] || [];
    const hasHeader = firstRow.some((cell: any) =>
      HEADER_KEYWORDS.includes(cell?.toString().trim().toLowerCase())
    );
    const dataRows = hasHeader ? rows.slice(1) : rows;

    // กรอง: col B = branch_id
    //   - ว่าง → แสดงทุกสาขา
    //   - มีค่า → แสดงเฉพาะสาขาที่ตรงกับ branchId ที่ส่งมา
    const filteredRows = dataRows.filter((row) => {
      const rowBranch = (row[1] ?? "").toString().trim().toLowerCase();
      if (!rowBranch) return true;  // ว่าง = แสดงทุกสาขา
      if (!branchId) return true;   // ไม่ได้ส่ง branchId = แสดงหมด
      return rowBranch === branchId;
    });

    // A = value, C = label (B ถูกใช้เป็น branch_id แล้ว)
    const options = filteredRows
      .filter((row) => row[0])
      .map((row) => {
        const value = row[0]?.toString().trim() || "";
        const label = row[2]?.toString().trim() || value;
        return { value, label };
      });

    return NextResponse.json(
      { success: true, helperName, options, totalOptions: options.length },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" } }
    );

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
