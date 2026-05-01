/**
 * GET  /api/crm/schedule
 * POST /api/crm/schedule { action, row | rowIndex }
 *
 * Auto-discovers spreadsheetId จาก client_modules (หา module ที่ชื่อมี "payroll")
 * Sheet: employee_schedule ใน HR Payroll spreadsheet
 * Columns: A=id | B=date | C=employee_name | D=type | E=notes | F=created_at | G=created_by
 */
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saAppendRow, saWriteRange, saInvalidateCache } from "@/lib/google-sa";

const MASTER_SHEET_ID = process.env.MASTER_SHEET_ID!;
const SCHED_SHEET     = "employee_schedule";
const EMPTY_ROW       = ["", "", "", "", "", "", ""];

async function getPayrollSpreadsheetId(clientId: string): Promise<string | null> {
  const rows = await saReadRange(MASTER_SHEET_ID, "client_modules!A:H");
  if (!rows || rows.length < 2) return null;

  const row = rows.slice(1).find(r => {
    const rowClient   = (r[1] ?? "").toString().trim();
    const moduleName  = (r[2] ?? "").toString().toLowerCase();
    const isActive    = (r[6] ?? "").toString().toUpperCase() === "TRUE";
    return rowClient === clientId && isActive && moduleName.includes("payroll");
  });

  if (!row) return null;
  let sid = (row[3] ?? "").toString().trim();
  if (sid.includes("/edit")) sid = sid.split("/edit")[0];
  if (sid.includes("?"))    sid = sid.split("?")[0];
  return sid || null;
}

async function getClientId(token: any): Promise<string | null> {
  const userEmail = ((token as any)?.email as string || "").toLowerCase().trim();
  const userRows  = await saReadRange(MASTER_SHEET_ID, "client_user!A:E");
  const row       = userRows.slice(1).find(r => (r[1] ?? "").toString().toLowerCase().trim() === userEmail);
  return row ? (row[0] ?? "").toString().trim() : null;
}

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const clientId = await getClientId(token);
    if (!clientId) return NextResponse.json({ schedule: [] });

    const sid = await getPayrollSpreadsheetId(clientId);
    if (!sid) return NextResponse.json({ schedule: [], noModule: true });

    const values = await saReadRange(sid, SCHED_SHEET);
    const schedule = (values || []).slice(1)
      .map((row, i) => ({
        rowIndex:      i + 2,
        id:            (row[0] || "").toString(),
        date:          (row[1] || "").toString(),
        employee_name: (row[2] || "").toString(),
        type:          (row[3] || "work").toString(),
        notes:         (row[4] || "").toString(),
        created_at:    (row[5] || "").toString(),
        created_by:    (row[6] || "").toString(),
      }))
      .filter(s => s.id && s.date && s.employee_name);

    return NextResponse.json({ success: true, schedule });

  } catch (err: any) {
    if (err.message?.includes("Unable to parse range") || err.message?.includes("not found") || err.message?.includes("badRequest")) {
      return NextResponse.json({ success: true, schedule: [] });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { action, row, rowIndex } = body;

  try {
    const clientId = await getClientId(token);
    if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    const sid = await getPayrollSpreadsheetId(clientId);
    if (!sid) return NextResponse.json({ error: "HR Payroll module ไม่ได้ config ใน client_modules" }, { status: 404 });

    if (action === "append") {
      if (!row || !Array.isArray(row)) return NextResponse.json({ error: "Missing row" }, { status: 400 });
      await saAppendRow(sid, `${SCHED_SHEET}!A1`, row);
      saInvalidateCache(sid);
      return NextResponse.json({ success: true, action: "append" });
    }

    if (action === "delete") {
      if (!rowIndex) return NextResponse.json({ error: "Missing rowIndex" }, { status: 400 });
      await saWriteRange(sid, `${SCHED_SHEET}!A${rowIndex}`, [EMPTY_ROW]);
      saInvalidateCache(sid);
      return NextResponse.json({ success: true, action: "delete" });
    }

    return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
