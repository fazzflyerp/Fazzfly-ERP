/**
 * GET  /api/crm-demo/appointments?spreadsheetId=xxx&sheetName=yyy
 * POST /api/crm-demo/appointments  { spreadsheetId, sheetName, action, row, rowIndex?, status? }
 *
 * Demo version — same logic as /api/crm/appointments but under (demo) route group.
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saAppendRow, saWriteRange, saInvalidateCache } from "@/lib/google-sa";

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const spreadsheetId = searchParams.get("spreadsheetId");
  const sheetName     = searchParams.get("sheetName") || "appointments";
  const filterDate    = searchParams.get("date");

  if (!spreadsheetId) return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });

  try {
    const values = await saReadRange(spreadsheetId, sheetName);
    let appointments = values.slice(1)
      .map((row, i) => ({
        rowIndex:         i + 2,
        appointment_id:   row[0]  || "",
        created_at:       row[1]  || "",
        customer_id:      row[2]  || "",
        customer_name:    row[3]  || "",
        customer_phone:   row[4]  || "",
        appointment_date: row[5]  || "",
        appointment_time: row[6]  || "",
        end_time:         row[7]  || "",
        service:          row[8]  || "",
        doctor:           row[9]  || "",
        status:           row[10] || "pending",
        course_id:        row[11] || "",
        price:            Number(row[12]) || 0,
        deposit:          Number(row[13]) || 0,
        notes:            row[14] || "",
        reminded_at:      row[15] || "",
        created_by:       row[16] || "",
        branch_id:        row[19] || "",
      }))
      .filter(a => a.appointment_id);

    if (filterDate) appointments = appointments.filter(a => a.appointment_date === filterDate);
    return NextResponse.json({ success: true, count: appointments.length, appointments });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const { spreadsheetId, sheetName = "appointments", action, row, rowIndex, status } = body;
  if (!spreadsheetId) return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });
  if (!action)        return NextResponse.json({ error: "Missing action" },        { status: 400 });

  try {
    if (action === "append") {
      if (!row || !Array.isArray(row)) return NextResponse.json({ error: "Missing row" }, { status: 400 });
      await saAppendRow(spreadsheetId, `${sheetName}!A1`, row);
      saInvalidateCache(spreadsheetId);
      return NextResponse.json({ success: true, action: "append" });
    }
    if (action === "update") {
      if (!rowIndex || !row) return NextResponse.json({ error: "Missing rowIndex or row" }, { status: 400 });
      await saWriteRange(spreadsheetId, `${sheetName}!A${rowIndex}`, [row]);
      saInvalidateCache(spreadsheetId);
      return NextResponse.json({ success: true, action: "update" });
    }
    if (action === "status") {
      if (!rowIndex || !status) return NextResponse.json({ error: "Missing rowIndex or status" }, { status: 400 });
      await saWriteRange(spreadsheetId, `${sheetName}!K${rowIndex}`, [[status]]);
      saInvalidateCache(spreadsheetId);
      return NextResponse.json({ success: true, action: "status", rowIndex, status });
    }
    return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
