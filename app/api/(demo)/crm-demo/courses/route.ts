/**
 * GET  /api/crm-demo/courses?spreadsheetId=xxx&sheetName=courses
 * POST /api/crm-demo/courses  { spreadsheetId, sheetName, action, ... }
 *
 * Demo version of CRM courses API.
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saAppendRow, saWriteRange, saInvalidateCache } from "@/lib/google-sa";

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const spreadsheetId = searchParams.get("spreadsheetId");
  const sheetName     = searchParams.get("sheetName") || "courses";
  const customerId    = searchParams.get("customerId") || "";

  if (!spreadsheetId) return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });

  try {
    const values = await saReadRange(spreadsheetId, sheetName).catch(() => [] as any[][]);
    if (!values || values.length < 2) return NextResponse.json({ success: true, count: 0, courses: [] });
    let courses = values.slice(1)
      .map((row, i) => ({
        rowIndex:           i + 2,
        course_id:          row[0]  || "",
        created_at:         row[1]  || "",
        customer_id:        row[2]  || "",
        customer_name:      row[3]  || "",
        course_name:        row[4]  || "",
        service:            row[5]  || "",
        total_sessions:     Number(row[6])  || 0,
        used_sessions:      Number(row[7])  || 0,
        remaining_sessions: Number(row[8])  || 0,
        price_per_session:  Number(row[9])  || 0,
        total_price:        Number(row[10]) || 0,
        paid_amount:        Number(row[11]) || 0,
        purchase_date:      row[12] || "",
        expire_date:        row[13] || "",
        status:             row[14] || "active",
        notes:              row[15] || "",
      }))
      .filter(c => c.course_id);

    if (customerId) courses = courses.filter(c => c.customer_id === customerId);

    return NextResponse.json({ success: true, count: courses.length, courses });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { spreadsheetId, sheetName = "courses", action, row, rowIndex } = body;
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
    return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
