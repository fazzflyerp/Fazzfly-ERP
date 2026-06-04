/**
 * GET  /api/crm-demo/followups?spreadsheetId=xxx&sheetName=followup_tasks
 * POST /api/crm-demo/followups  { spreadsheetId, sheetName, action, ... }
 *
 * Demo version of CRM followups API.
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saAppendRow, saWriteRange, saInvalidateCache } from "@/lib/google-sa";

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const spreadsheetId = searchParams.get("spreadsheetId");
  const sheetName     = searchParams.get("sheetName") || "followup_tasks";
  const customerId    = searchParams.get("customerId") || "";
  const statusFilter  = searchParams.get("status")     || "";

  if (!spreadsheetId) return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });

  try {
    const values = await saReadRange(spreadsheetId, sheetName);
    let tasks = values.slice(1)
      .map((row, i) => ({
        rowIndex:       i + 2,
        task_id:        row[0]  || "",
        created_at:     row[1]  || "",
        customer_id:    row[2]  || "",
        customer_name:  row[3]  || "",
        customer_phone: row[4]  || "",
        due_date:       row[5]  || "",
        task_type:      row[6]  || "",
        description:    row[7]  || "",
        status:         (row[8] || "pending") as "pending" | "done" | "skipped",
        appointment_id: row[9]  || "",
        notes:          row[10] || "",
        reminded_at:    row[11] || "",
        created_by:     row[12] || "",
        branch_id:      row[13] || "",
      }))
      .filter(t => t.task_id);

    if (customerId)   tasks = tasks.filter(t => t.customer_id === customerId);
    if (statusFilter) tasks = tasks.filter(t => t.status      === statusFilter);

    tasks.sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      if (a.status === "pending") return a.due_date.localeCompare(b.due_date);
      return b.due_date.localeCompare(a.due_date);
    });

    return NextResponse.json({ success: true, count: tasks.length, tasks });
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

  const { spreadsheetId, sheetName = "followup_tasks", action, row, rowIndex, status } = body;
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
      await saWriteRange(spreadsheetId, `${sheetName}!I${rowIndex}`, [[status]]);
      saInvalidateCache(spreadsheetId);
      return NextResponse.json({ success: true, action: "status", rowIndex, status });
    }
    return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
