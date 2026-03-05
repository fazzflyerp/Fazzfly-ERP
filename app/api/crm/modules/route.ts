// app/api/crm/modules/route.ts
//
// GET /api/crm/modules?clientId=xxx
//
// ดึง CRM module config จาก sheet "client_crm" ใน Master Spreadsheet
// columns: crm_id, client_id, module_name, spreadsheet_id, sheet_name, config_name, is_active
//
// Returns:
// {
//   modules: [{ crmId, moduleName, spreadsheetId, sheetName, configName }],
//   spreadsheetId: string,   ← ของ module แรก (appointments) สำหรับ CRM boot
//   hasCRM: true,
// }

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// Master Spreadsheet ที่เก็บ client_crm sheet
// ใส่ ID ของ Master Sheet ที่มี sheet "client_crm"
const MASTER_SPREADSHEET_ID = process.env.MASTER_SHEET_ID!;
const CLIENT_CRM_SHEET = "client_crm";

export async function GET(request: NextRequest) {
  try {
    // ✅ Auth
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if ((token as any).error === "RefreshAccessTokenError") {
      return NextResponse.json({ error: "Session expired", code: "TOKEN_EXPIRED" }, { status: 401 });
    }

    const accessToken = (token as any)?.accessToken;
    if (!accessToken) {
      return NextResponse.json({ error: "No access token" }, { status: 401 });
    }

    // ✅ ดึง clientId จาก query param หรือจาก token
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get("clientId") || (token as any)?.clientId;

    if (!clientId) {
      return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
    }

    // ✅ ดึงข้อมูลจาก client_crm sheet
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${MASTER_SPREADSHEET_ID}/values/${encodeURIComponent(CLIENT_CRM_SHEET)}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("❌ Sheets error:", err);
      return NextResponse.json({ error: "Failed to fetch client_crm", details: err }, { status: 500 });
    }

    const data = await res.json();
    const rows: string[][] = data.values || [];

    if (rows.length < 2) {
      return NextResponse.json({ hasCRM: false, modules: [] });
    }

    // ✅ Parse header row
    const headers = rows[0].map((h: string) => h.toLowerCase().trim());
    const idx = (names: string[]) => headers.findIndex(h => names.includes(h));

    const crmIdIdx       = idx(["crm_id"]);
    const clientIdIdx    = idx(["client_id"]);
    const moduleNameIdx  = idx(["module_name"]);
    const spreadsheetIdx = idx(["spreadsheet_id"]);
    const sheetNameIdx   = idx(["sheet_name"]);
    const configNameIdx  = idx(["config_name"]);
    const isActiveIdx    = idx(["is_active"]);

    // ✅ Filter rows ของ clientId นี้ที่ active
    const modules = rows.slice(1)
      .filter(row => {
        const rowClientId = row[clientIdIdx]?.toString().trim();
        const isActive    = row[isActiveIdx]?.toString().toUpperCase() === "TRUE";
        return rowClientId === clientId && isActive;
      })
      .map(row => ({
        crmId:         row[crmIdIdx]?.toString()       || "",
        moduleName:    row[moduleNameIdx]?.toString()   || "",
        spreadsheetId: row[spreadsheetIdx]?.toString()  || "",
        sheetName:     row[sheetNameIdx]?.toString()    || "",
        configName:    row[configNameIdx]?.toString()   || "",
      }));

    if (modules.length === 0) {
      return NextResponse.json({ hasCRM: false, modules: [] });
    }

    // ✅ สร้าง map: moduleName → { spreadsheetId, sheetName, configName }
    const moduleMap: Record<string, typeof modules[0]> = {};
    modules.forEach(m => { moduleMap[m.moduleName] = m; });

    return NextResponse.json({
      hasCRM: true,
      modules,
      moduleMap,
      // shortcut สำหรับ boot sequence
      appointments: moduleMap["appointments"] || null,
      treatments:   moduleMap["treatments"]   || null,
      courses:      moduleMap["courses"]      || null,
      followup:     moduleMap["followup"]     || null,
      Master:       moduleMap["Master"]       || null,
    });

  } catch (error: any) {
    console.error("❌ /api/crm/modules error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}