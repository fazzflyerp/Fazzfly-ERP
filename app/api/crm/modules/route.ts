/**
 * GET /api/crm/modules?clientId=xxx
 * ดึง CRM module config จาก sheet "client_crm" ใน Master Spreadsheet
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange } from "@/lib/google-sa";

const MASTER_SHEET_ID  = process.env.MASTER_SHEET_ID!;
const CLIENT_CRM_SHEET = "client_crm";

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const clientId = request.nextUrl.searchParams.get("clientId");
    if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });

    const rows = await saReadRange(MASTER_SHEET_ID, CLIENT_CRM_SHEET);
    if (rows.length < 2) return NextResponse.json({ hasCRM: false, modules: [] });

    const headers = rows[0].map((h: string) => h.toLowerCase().trim());
    const idx = (names: string[]) => headers.findIndex((h: string) => names.includes(h));

    const crmIdIdx       = idx(["crm_id"]);
    const clientIdIdx    = idx(["client_id"]);
    const moduleNameIdx  = idx(["module_name"]);
    const spreadsheetIdx = idx(["spreadsheet_id"]);
    const sheetNameIdx   = idx(["sheet_name"]);
    const configNameIdx  = idx(["config_name"]);
    const isActiveIdx    = idx(["is_active"]);

    const modules = rows.slice(1)
      .filter(row => {
        const rowClientId = row[clientIdIdx]?.toString().trim();
        const isActive    = row[isActiveIdx]?.toString().toUpperCase() === "TRUE";
        return rowClientId === clientId && isActive;
      })
      .map(row => ({
        crmId:         row[crmIdIdx]?.toString()      || "",
        moduleName:    row[moduleNameIdx]?.toString()  || "",
        spreadsheetId: row[spreadsheetIdx]?.toString() || "",
        sheetName:     row[sheetNameIdx]?.toString()   || "",
        configName:    row[configNameIdx]?.toString()  || "",
      }));

    if (modules.length === 0) return NextResponse.json({ hasCRM: false, modules: [] });

    const moduleMap: Record<string, typeof modules[0]> = {};
    modules.forEach(m => { moduleMap[m.moduleName] = m; });

    return NextResponse.json({
      hasCRM: true,
      modules,
      moduleMap,
      appointments:  moduleMap["appointments"]  || null,
      treatments:    moduleMap["treatments"]    || null,
      courses:       moduleMap["courses"]       || null,
      followup:      moduleMap["followup"]      || null,
      Master:        moduleMap["Master"]        || null,
      transaction:   moduleMap["transaction"]   || null,
    });

  } catch (error: any) {
    console.error("❌ crm/modules:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
