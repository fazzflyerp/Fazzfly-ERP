/**
 * GET /api/sales-dashboard-demo?spreadsheetId=&configName=&sheetName=
 *
 * Demo-only API สำหรับ Sales Dashboard หน้าใหม่
 * — อ่าน config sheet → map field names by order
 * — อ่าน data sheet → parse ตาม config
 * — คืน { config, rows } ให้ client aggregate เอง
 * — Auth: JWT session cookie (ไม่ใช้ Bearer)
 * — ห้ามแตะ /api/dashboard/data เดิม
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange } from "@/lib/google-sa";
import { verifySheetAccess } from "@/lib/verify-sheet-access";

interface ConfigField {
  fieldName: string;
  label: string;
  type: string;
  order: number;
}

function parseConfigSheet(rows: any[][]): ConfigField[] {
  if (!rows || rows.length < 2) throw new Error("Config sheet ต้องมีอย่างน้อย 2 แถว");

  const header = rows[0].map((h) => (h ?? "").toString().toLowerCase().trim());
  const fieldCol = header.findIndex((h) => h.includes("field") || h === "fieldname" || h === "field_name");
  const labelCol = header.findIndex((h) => h.includes("label") || h.includes("ชื่อ"));
  const typeCol  = header.findIndex((h) => h.includes("type") || h.includes("ประเภท"));
  const orderCol = header.findIndex((h) => h.includes("order") || h.includes("ลำดับ"));

  if (fieldCol === -1 || labelCol === -1 || typeCol === -1)
    throw new Error("Config sheet ขาด columns: field_name, label, type");

  return rows
    .slice(1)
    .filter((r) => r[fieldCol])
    .map((r, i) => ({
      fieldName: (r[fieldCol] ?? "").toString(),
      label:     (r[labelCol] ?? "").toString(),
      type:      (r[typeCol]  ?? "").toString(),
      order:     orderCol >= 0 ? Number(r[orderCol] || i + 1) : i + 1,
    }));
}

function parseRows(rows: any[][], fields: ConfigField[]): any[] {
  if (!rows || rows.length < 2) return [];
  return rows
    .slice(1)
    .filter((r) => r.some((c) => c !== null && c !== undefined && c !== ""))
    .map((r) => {
      const rec: any = {};
      fields.forEach((f) => {
        const idx = f.order - 1;
        rec[f.fieldName] = idx >= 0 && idx < r.length ? (r[idx] ?? "") : "";
      });
      return rec;
    });
}

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if ((token as any).error === "RefreshAccessTokenError")
      return NextResponse.json({ error: "Session expired" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const configName    = searchParams.get("configName");
    const sheetName     = searchParams.get("sheetName");
    const rawSid        = searchParams.get("spreadsheetId") || "";

    // Normalize: client_dashboard col D may store a full URL; extract just the ID
    const spreadsheetId = (() => {
      let id = rawSid.trim();
      if (id.includes("/edit")) id = id.split("/edit")[0];
      if (id.includes("?")) id = id.split("?")[0];
      const m = id.match(/\/d\/([a-zA-Z0-9_-]+)/);
      return m ? m[1] : id;
    })();

    if (!spreadsheetId || !configName || !sheetName)
      return NextResponse.json({ error: "Missing: spreadsheetId, configName, sheetName" }, { status: 400 });

    const email = (token.email as string).toLowerCase().trim();

    // Super admin bypass — check role from client_user
    const MASTER_SHEET_ID = process.env.MASTER_SHEET_ID!;
    let isSuperAdmin = false;
    try {
      const userRows = await saReadRange(MASTER_SHEET_ID, "client_user!A:H");
      const userRow = userRows.slice(1).find(
        (r) => (r[1] ?? "").toString().toLowerCase().trim() === email
      );
      if (userRow) {
        // client_user: A=client_id, B=email, C=role, D=is_active
        const role = (userRow[2] ?? "").toString().toUpperCase().trim();
        isSuperAdmin = role === "SUPER_ADMIN";
      }
    } catch { /* non-blocking */ }

    if (!isSuperAdmin) {
      const access = await verifySheetAccess(email, spreadsheetId);
      if (!access.allowed)
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [configRows, dataRows] = await Promise.all([
      saReadRange(spreadsheetId, `${configName}!A:K`),
      saReadRange(spreadsheetId, `${sheetName}!A:ZZ`),
    ]);

    let config: ConfigField[];
    try {
      config = parseConfigSheet(configRows);
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }

    const rows = parseRows(dataRows, config);

    return NextResponse.json(
      { config, rows },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
