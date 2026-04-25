/**
 * GET /api/user/documents
 * ดึงรายการเอกสารจาก client_receipt sheet ของ master config
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange } from "@/lib/google-sa";

const MASTER_SHEET_ID      = process.env.MASTER_SHEET_ID!;
const CLIENT_RECEIPT_SHEET = "client_receipt";

export async function GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);

  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });

    const clientId = request.nextUrl.searchParams.get("clientId");
    if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });

    const rows = await saReadRange(MASTER_SHEET_ID, `${CLIENT_RECEIPT_SHEET}!A:K`);
    if (rows.length === 0) return NextResponse.json({ success: true, clientId, documents: [], count: 0 });

    const headers = rows[0];
    const col = (name: string) => headers.findIndex((h: string) => h.toLowerCase() === name.toLowerCase());

    const idx = {
      moduleId:    col("module_id"),
      clientId:    col("client_id"),
      moduleName:  col("module_name"),
      spreadsheetId: col("spreadsheet_id"),
      sheetName:   col("sheet_name"),
      companyName: col("company_name"),
      configName:  col("config_name"),
      isActive:    col("is_active"),
      notes:       col("notes"),
      folderID:    col("folderid"),
    };

    const documents = rows.slice(1)
      .filter((r) =>
        (r[idx.clientId] ?? "").toString().trim() === clientId &&
        (r[idx.isActive] ?? "").toString().toUpperCase() === "TRUE" &&
        (r[idx.moduleId] ?? "").toString().trim() !== "" &&
        (r[idx.spreadsheetId] ?? "").toString().trim() !== "" &&
        (r[idx.configName] ?? "").toString().trim() !== ""
      )
      .map((r) => ({
        moduleId:      (r[idx.moduleId]      ?? "").toString().trim(),
        clientId:      (r[idx.clientId]      ?? "").toString().trim(),
        moduleName:    (r[idx.moduleName]    ?? "").toString().trim(),
        spreadsheetId: (r[idx.spreadsheetId] ?? "").toString().trim(),
        sheetName:     (r[idx.sheetName]     ?? "").toString().trim(),
        companyName:   (r[idx.companyName]   ?? "").toString().trim(),
        configName:    (r[idx.configName]    ?? "").toString().trim(),
        folderID:      idx.folderID >= 0 ? (r[idx.folderID] ?? "").toString().trim() : "",
        notes:         idx.notes    >= 0 ? (r[idx.notes]    ?? "").toString().trim() : "",
        isActive:      true,
      }));

    console.log(`✅ [${requestId}] documents: ${documents.length} for ${clientId}`);

    return NextResponse.json({ success: true, clientId, documents, count: documents.length });

  } catch (error: any) {
    console.error(`❌ [${requestId}] user/documents:`, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
