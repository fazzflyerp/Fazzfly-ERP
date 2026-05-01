/**
 * GET  /api/crm/offdays?spreadsheetId=xxx
 * POST /api/crm/offdays  { spreadsheetId, action, row | rowIndex }
 *   action="append"  → append new row
 *   action="delete"  → clear row by rowIndex
 */
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saAppendRow, saWriteRange, saInvalidateCache } from "@/lib/google-sa";

const SHEET = "employee_offdays";

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sid = request.nextUrl.searchParams.get("spreadsheetId");
  if (!sid) return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });

  try {
    const values = await saReadRange(sid, SHEET);
    const offdays = (values || []).slice(1)
      .map((row, i) => ({
        rowIndex:      i + 2,
        id:            row[0] || "",
        date:          row[1] || "",
        employee_name: row[2] || "",
        reason:        row[3] || "",
        created_at:    row[4] || "",
        created_by:    row[5] || "",
      }))
      .filter(o => o.id && o.date && o.employee_name);
    return NextResponse.json({ success: true, offdays });
  } catch (err: any) {
    // Sheet not yet created → return empty
    if (err.message?.includes("Unable to parse range") || err.message?.includes("not found")) {
      return NextResponse.json({ success: true, offdays: [] });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { spreadsheetId, action, row, rowIndex } = body;
  if (!spreadsheetId) return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });

  try {
    if (action === "append") {
      if (!row || !Array.isArray(row)) return NextResponse.json({ error: "Missing row" }, { status: 400 });
      await saAppendRow(spreadsheetId, `${SHEET}!A1`, row);
      saInvalidateCache(spreadsheetId);
      return NextResponse.json({ success: true, action: "append" });
    }

    if (action === "delete") {
      if (!rowIndex) return NextResponse.json({ error: "Missing rowIndex" }, { status: 400 });
      await saWriteRange(spreadsheetId, `${SHEET}!A${rowIndex}`, [["", "", "", "", "", ""]]);
      saInvalidateCache(spreadsheetId);
      return NextResponse.json({ success: true, action: "delete" });
    }

    return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
