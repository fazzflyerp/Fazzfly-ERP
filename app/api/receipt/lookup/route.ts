/**
 * GET /api/receipt/lookup?spreadsheetId=
 * อ่าน client_receipt จาก admin sheet แล้วหา entry ที่ตรงกับ spreadsheetId
 * คืน: type, configName, sheetName, companySheetName, folderID
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange } from "@/lib/google-sa";

const MASTER_SHEET_ID = process.env.MASTER_SHEET_ID!;

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const spreadsheetId = request.nextUrl.searchParams.get("spreadsheetId");
    if (!spreadsheetId) return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });

    const rows = await saReadRange(MASTER_SHEET_ID, "client_receipt!A:L", 0); // bypass cache
    if (!rows.length) return NextResponse.json({ error: "client_receipt sheet empty" }, { status: 404 });

    const headers = rows[0].map((h: any) => (h ?? "").toString().toLowerCase().trim().replace(/\s+/g, "_"));
    const col = (name: string) => {
      const idx = headers.indexOf(name);
      if (idx >= 0) return idx;
      return headers.findIndex((h: string) => h.includes(name) || name.includes(h));
    };

    const match = rows.slice(1).find((r: any[]) => {
      const sid    = (r[col("spreadsheet_id")] ?? "").toString().trim();
      const active = (r[col("is_active")]      ?? "").toString().trim().toUpperCase();
      return sid === spreadsheetId && (active === "TRUE" || active === "1" || active === "YES");
    });

    if (!match) {
      const allRows = rows.slice(1).map((r: any[]) => ({
        spreadsheet_id: (r[col("spreadsheet_id")] ?? "").toString().trim(),
        is_active:      (r[col("is_active")]      ?? "").toString().trim(),
      }));
      return NextResponse.json({
        error: "ไม่พบ receipt config สำหรับ spreadsheet นี้",
        debug: { headers, spreadsheetId, rows: allRows },
      }, { status: 404 });
    }

    return NextResponse.json({
      moduleId:         (match[col("module_id")]    ?? "").toString().trim(),
      moduleName:       (match[col("module_name")]  ?? "").toString().trim(),
      configName:       (match[col("config_name")]  ?? "").toString().trim(),
      sheetName:        (match[col("sheet_name")]   ?? "").toString().trim(),
      companySheetName: (match[col("company_name")] ?? "").toString().trim() || "company_info",
      folderID:         (match[col("folderid")]     ?? "").toString().trim(),
      type:             parseInt((match[col("type")] ?? "1").toString().trim()) || 1,
      catalogName:      (match[col("catalog_name")] ?? "").toString().trim() || null,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
