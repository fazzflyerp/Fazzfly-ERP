/**
 * =============================================================================
 * FILE PATH: app/api/crm/appointments/route.ts
 * =============================================================================
 *
 * GET  /api/crm/appointments?spreadsheetId=xxx&sheetName=yyy
 *      → ดึงนัดหมายทั้งหมด (หรือ filter ด้วย date=YYYY-MM-DD)
 *
 * POST /api/crm/appointments
 *      body: { spreadsheetId, sheetName, action, ... }
 *
 *      action = "append"  → เพิ่มนัดหมายใหม่   (ส่ง row: [...])
 *      action = "update"  → แก้ไขแถวที่มีอยู่   (ส่ง rowIndex, row: [...])
 *      action = "status"  → เปลี่ยน status อย่างเดียว (ส่ง rowIndex, status)
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

async function getAccessToken(request: NextRequest): Promise<string | null> {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token || (token as any).error === "RefreshAccessTokenError") return null;
  return (token as any)?.accessToken || null;
}

function authError(msg = "Unauthorized") {
  return NextResponse.json({ error: msg, code: "AUTH_REQUIRED" }, { status: 401 });
}

async function sheetsFetch(url: string, options: RequestInit = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
}

export async function GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`📅 [${requestId}] GET /api/crm/appointments`);

  const accessToken = await getAccessToken(request);
  if (!accessToken) return authError("Session expired — please sign in again");

  const { searchParams } = new URL(request.url);
  const spreadsheetId = searchParams.get("spreadsheetId");
  const sheetName     = searchParams.get("sheetName") || "appointments";
  const filterDate    = searchParams.get("date");

  if (!spreadsheetId) {
    return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });
  }

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`;
    const res = await sheetsFetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

    if (!res.ok) {
      const err = await res.text();
      console.error(`❌ [${requestId}] Sheets error ${res.status}:`, err);
      if (res.status === 401) return authError("Session expired");
      return NextResponse.json({ error: "Failed to fetch sheet", details: err }, { status: res.status });
    }

    const data   = await res.json();
    const values = (data.values || []) as string[][];
    const dataRows = values.slice(1);

    const appointments = dataRows
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
      }))
      .filter(a => a.appointment_id);

    const result = filterDate
      ? appointments.filter(a => a.appointment_date === filterDate)
      : appointments;

    console.log(`✅ [${requestId}] Fetched ${result.length} appointments`);

    return NextResponse.json({ success: true, count: result.length, appointments: result });

  } catch (error: any) {
    console.error(`❌ [${requestId}] Error:`, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`💾 [${requestId}] POST /api/crm/appointments`);

  const accessToken = await getAccessToken(request);
  if (!accessToken) return authError("Session expired — please sign in again");

  let body: any;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const { spreadsheetId, sheetName = "appointments", action, row, rowIndex, status } = body;

  if (!spreadsheetId) return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });
  if (!action) return NextResponse.json({ error: "Missing action (append | update | status)" }, { status: 400 });

  console.log(`   📋 action: ${action}, sheet: ${sheetName}`);

  try {
    if (action === "append") {
      if (!row || !Array.isArray(row))
        return NextResponse.json({ error: "action=append requires row: [...]" }, { status: 400 });

      // ✅ ระบุ !A1 เพื่อให้ append ลงมาแนวตั้ง ไม่ใช่ไปข้างๆ
      const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName + "!A1")}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

      const res = await sheetsFetch(appendUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [row] }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error(`❌ [${requestId}] Append error ${res.status}:`, err);
        if (res.status === 401) return authError("Session expired");
        return NextResponse.json({ error: "Failed to append row", details: err }, { status: res.status });
      }

      const result = await res.json();
      console.log(`✅ [${requestId}] Appended → ${result.updates?.updatedRange}`);

      return NextResponse.json({
        success: true,
        action: "append",
        updatedRange: result.updates?.updatedRange,
        updatedRows: result.updates?.updatedRows || 1,
      });
    }

    if (action === "update") {
      if (!rowIndex || !row || !Array.isArray(row))
        return NextResponse.json({ error: "action=update requires rowIndex and row: [...]" }, { status: 400 });

      const range     = `${sheetName}!A${rowIndex}`;
      const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

      const res = await sheetsFetch(updateUrl, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [row] }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error(`❌ [${requestId}] Update error ${res.status}:`, err);
        if (res.status === 401) return authError("Session expired");
        return NextResponse.json({ error: "Failed to update row", details: err }, { status: res.status });
      }

      const result = await res.json();
      console.log(`✅ [${requestId}] Updated row ${rowIndex} → ${result.updatedRange}`);

      return NextResponse.json({ success: true, action: "update", updatedRange: result.updatedRange, updatedRows: result.updatedRows || 1 });
    }

    if (action === "status") {
      if (!rowIndex || !status)
        return NextResponse.json({ error: "action=status requires rowIndex and status" }, { status: 400 });

      const range     = `${sheetName}!K${rowIndex}`;
      const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

      const res = await sheetsFetch(updateUrl, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [[status]] }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error(`❌ [${requestId}] Status update error ${res.status}:`, err);
        if (res.status === 401) return authError("Session expired");
        return NextResponse.json({ error: "Failed to update status", details: err }, { status: res.status });
      }

      console.log(`✅ [${requestId}] Status updated → row ${rowIndex} = ${status}`);
      return NextResponse.json({ success: true, action: "status", rowIndex, status });
    }

    return NextResponse.json({ error: `Unknown action "${action}". Use: append | update | status` }, { status: 400 });

  } catch (error: any) {
    console.error(`❌ [${requestId}] Unexpected error:`, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}