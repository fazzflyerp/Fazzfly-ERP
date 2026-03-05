/**
 * FILE PATH: app/api/crm/followups/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const SHEET_NAME = "followup_tasks";

async function getAccessToken(req: NextRequest): Promise<string | null> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || (token as any).error === "RefreshAccessTokenError") return null;
  return (token as any)?.accessToken || null;
}

async function sheetsFetch(url: string, options: RequestInit = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
}

export async function GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`📋 [${requestId}] GET /api/crm/followups`);

  const accessToken = await getAccessToken(request);
  if (!accessToken) return NextResponse.json({ error: "Session expired" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const spreadsheetId = searchParams.get("spreadsheetId");
  const sheetName     = searchParams.get("sheetName") || SHEET_NAME;
  const customerId    = searchParams.get("customerId") || "";
  const statusFilter  = searchParams.get("status")     || "";
  const dueDateFilter = searchParams.get("dueDate")    || "";

  if (!spreadsheetId) return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`;
    const res = await sheetsFetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

    if (!res.ok) {
      const err = await res.text();
      if (res.status === 401) return NextResponse.json({ error: "Session expired" }, { status: 401 });
      return NextResponse.json({ error: "Failed to fetch follow ups", details: err }, { status: res.status });
    }

    const data   = await res.json();
    const values = (data.values || []) as string[][];
    const rows   = values.slice(1);

    // Schema: col A=task_id | B=created_at | C=customer_id | D=customer_name | E=customer_phone |
    //         F=due_date | G=task_type | H=description | I=status | J=appointment_id |
    //         K=notes | L=reminded_at | M=created_by
    let tasks = rows
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
        status:         (row[8] || "pending") as "pending"|"done"|"skipped",
        appointment_id: row[9]  || "",
        notes:          row[10] || "",
        reminded_at:    row[11] || "",   // ← L
        created_by:     row[12] || "",   // ← M
      }))
      .filter(t => t.task_id);

    if (customerId)    tasks = tasks.filter(t => t.customer_id === customerId);
    if (statusFilter)  tasks = tasks.filter(t => t.status      === statusFilter);
    if (dueDateFilter) tasks = tasks.filter(t => t.due_date    === dueDateFilter);

    tasks.sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      if (a.status === "pending") return a.due_date.localeCompare(b.due_date);
      return b.due_date.localeCompare(a.due_date);
    });

    console.log(`✅ [${requestId}] Fetched ${tasks.length} follow-up tasks`);
    return NextResponse.json({ success: true, count: tasks.length, tasks });

  } catch (error: any) {
    console.error(`❌ [${requestId}] Error:`, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`💾 [${requestId}] POST /api/crm/followups`);

  const accessToken = await getAccessToken(request);
  if (!accessToken) return NextResponse.json({ error: "Session expired" }, { status: 401 });

  let body: any;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { spreadsheetId, sheetName = SHEET_NAME, action, row, rowIndex, status } = body;

  if (!spreadsheetId) return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });
  if (!action)        return NextResponse.json({ error: "Missing action" }, { status: 400 });

  try {
    if (action === "append") {
      if (!row || !Array.isArray(row)) return NextResponse.json({ error: "Missing row" }, { status: 400 });

      // ✅ ระบุ !A1 ให้ append ลงมาแนวตั้ง
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName + "!A1")}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
      const res = await sheetsFetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [row] }),
      });

      if (!res.ok) {
        const err = await res.text();
        if (res.status === 401) return NextResponse.json({ error: "Session expired" }, { status: 401 });
        return NextResponse.json({ error: "Failed to add task", details: err }, { status: res.status });
      }

      const result = await res.json();
      console.log(`✅ [${requestId}] Task added → ${result.updates?.updatedRange}`);
      return NextResponse.json({ success: true, action: "append" });
    }

    if (action === "update") {
      if (!rowIndex || !row) return NextResponse.json({ error: "Missing rowIndex or row" }, { status: 400 });

      const range = `${sheetName}!A${rowIndex}`;
      const url   = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
      const res   = await sheetsFetch(url, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [row] }),
      });

      if (!res.ok) {
        const err = await res.text();
        if (res.status === 401) return NextResponse.json({ error: "Session expired" }, { status: 401 });
        return NextResponse.json({ error: "Failed to update task", details: err }, { status: res.status });
      }

      console.log(`✅ [${requestId}] Task updated → row ${rowIndex}`);
      return NextResponse.json({ success: true, action: "update" });
    }

    // status อยู่ col I (index 8) → ไม่เปลี่ยน
    if (action === "status") {
      if (!rowIndex || !status) return NextResponse.json({ error: "Missing rowIndex or status" }, { status: 400 });

      const range = `${sheetName}!I${rowIndex}`;
      const url   = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
      const res   = await sheetsFetch(url, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [[status]] }),
      });

      if (!res.ok) {
        const err = await res.text();
        if (res.status === 401) return NextResponse.json({ error: "Session expired" }, { status: 401 });
        return NextResponse.json({ error: "Failed to update status", details: err }, { status: res.status });
      }

      console.log(`✅ [${requestId}] Task status → row ${rowIndex} = ${status}`);
      return NextResponse.json({ success: true, action: "status", rowIndex, status });
    }

    return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 });

  } catch (error: any) {
    console.error(`❌ [${requestId}] Error:`, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}