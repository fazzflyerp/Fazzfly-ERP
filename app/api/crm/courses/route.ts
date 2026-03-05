/**
 * =============================================================================
 * FILE PATH: app/api/crm/courses/route.ts
 * =============================================================================
 *
 * GET  /api/crm/courses?spreadsheetId=xxx
 *      → ดึงคอร์สทั้งหมด
 *      optional: ?customerId=CUS123 → filter เฉพาะลูกค้านั้น
 *
 * POST /api/crm/courses
 *      action = "append"  → เพิ่มคอร์สใหม่     (row: [...])
 *      action = "update"  → แก้ไขคอร์ส         (rowIndex, row: [...])
 *      action = "use"     → บันทึกการใช้ครั้ง  (rowIndex, usedSessions)
 *                           → auto คำนวณ remaining + เปลี่ยน status ถ้าครบ
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const SHEET_NAME = "courses";

async function getAccessToken(request: NextRequest): Promise<string | null> {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token || (token as any).error === "RefreshAccessTokenError") return null;
  return (token as any)?.accessToken || null;
}

async function sheetsFetch(url: string, options: RequestInit = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
}

// ─────────────────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`📦 [${requestId}] GET /api/crm/courses`);

  const accessToken = await getAccessToken(request);
  if (!accessToken) return NextResponse.json({ error: "Session expired" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const spreadsheetId = searchParams.get("spreadsheetId");
  const sheetName     = searchParams.get("sheetName") || SHEET_NAME;
  const customerId    = searchParams.get("customerId") || "";
  const statusFilter  = searchParams.get("status") || ""; // active | completed | expired

  if (!spreadsheetId) return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`;
    const res = await sheetsFetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

    if (!res.ok) {
      const err = await res.text();
      if (res.status === 401) return NextResponse.json({ error: "Session expired" }, { status: 401 });
      return NextResponse.json({ error: "Failed to fetch courses", details: err }, { status: res.status });
    }

    const data   = await res.json();
    const values = (data.values || []) as string[][];
    const dataRows = values.slice(1); // skip header

    // Map ตาม schema courses
    // Col: course_id | created_at | customer_id | customer_name | course_name | service |
    //      total_sessions | used_sessions | remaining_sessions | price_per_session |
    //      total_price | paid_amount | purchase_date | expire_date | status | notes
    let courses = dataRows
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

    // Filters
    if (customerId) courses = courses.filter(c => c.customer_id === customerId);
    if (statusFilter) courses = courses.filter(c => c.status === statusFilter);

    // Sort: active first, then by expire_date
    courses.sort((a, b) => {
      if (a.status === "active" && b.status !== "active") return -1;
      if (a.status !== "active" && b.status === "active") return 1;
      return a.expire_date.localeCompare(b.expire_date);
    });

    console.log(`✅ [${requestId}] Fetched ${courses.length} courses`);

    return NextResponse.json({ success: true, count: courses.length, courses });

  } catch (error: any) {
    console.error(`❌ [${requestId}] Error:`, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────
// POST
// ─────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`💾 [${requestId}] POST /api/crm/courses`);

  const accessToken = await getAccessToken(request);
  if (!accessToken) return NextResponse.json({ error: "Session expired" }, { status: 401 });

  let body: any;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { spreadsheetId, sheetName = SHEET_NAME, action, row, rowIndex, usedSessions, totalSessions } = body;

  if (!spreadsheetId) return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });
  if (!action)        return NextResponse.json({ error: "Missing action (append | update | use)" }, { status: 400 });

  try {

    // ── append: เพิ่มคอร์สใหม่ ──────────────────────────────
    if (action === "append") {
      if (!row || !Array.isArray(row)) return NextResponse.json({ error: "Missing row: [...]" }, { status: 400 });

      const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

      const res = await sheetsFetch(appendUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [row] }),
      });

      if (!res.ok) {
        const err = await res.text();
        if (res.status === 401) return NextResponse.json({ error: "Session expired" }, { status: 401 });
        return NextResponse.json({ error: "Failed to add course", details: err }, { status: res.status });
      }

      const result = await res.json();
      console.log(`✅ [${requestId}] Course added → ${result.updates?.updatedRange}`);
      return NextResponse.json({ success: true, action: "append", updatedRange: result.updates?.updatedRange });
    }

    // ── update: แก้ไขทั้งแถว ────────────────────────────────
    if (action === "update") {
      if (!rowIndex || !row || !Array.isArray(row)) return NextResponse.json({ error: "Missing rowIndex or row" }, { status: 400 });

      const range     = `${sheetName}!A${rowIndex}`;
      const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

      const res = await sheetsFetch(updateUrl, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [row] }),
      });

      if (!res.ok) {
        const err = await res.text();
        if (res.status === 401) return NextResponse.json({ error: "Session expired" }, { status: 401 });
        return NextResponse.json({ error: "Failed to update course", details: err }, { status: res.status });
      }

      console.log(`✅ [${requestId}] Course updated → row ${rowIndex}`);
      return NextResponse.json({ success: true, action: "update" });
    }

    // ── use: บันทึกการใช้คอร์ส (used+1, remaining-1, auto complete) ──
    if (action === "use") {
      if (!rowIndex || usedSessions === undefined || totalSessions === undefined) {
        return NextResponse.json({ error: "Missing rowIndex, usedSessions, or totalSessions" }, { status: 400 });
      }

      const newUsed      = usedSessions + 1;
      const newRemaining = Math.max(totalSessions - newUsed, 0);
      const newStatus    = newRemaining <= 0 ? "completed" : "active";

      // Update cols H (used), I (remaining), O (status) = cols 8, 9, 15
      // Easier to just update the range H:I and O separately
      const updates = [
        {
          range: `${sheetName}!H${rowIndex}:I${rowIndex}`,
          values: [[String(newUsed), String(newRemaining)]],
        },
        {
          range: `${sheetName}!O${rowIndex}`,
          values: [[newStatus]],
        },
      ];

      const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
      const res = await sheetsFetch(batchUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ valueInputOption: "USER_ENTERED", data: updates }),
      });

      if (!res.ok) {
        const err = await res.text();
        if (res.status === 401) return NextResponse.json({ error: "Session expired" }, { status: 401 });
        return NextResponse.json({ error: "Failed to record usage", details: err }, { status: res.status });
      }

      console.log(`✅ [${requestId}] Course used → row ${rowIndex}, used=${newUsed}, remaining=${newRemaining}, status=${newStatus}`);
      return NextResponse.json({ success: true, action: "use", newUsed, newRemaining, newStatus });
    }

    return NextResponse.json({ error: `Unknown action "${action}". Use: append | update | use` }, { status: 400 });

  } catch (error: any) {
    console.error(`❌ [${requestId}] Error:`, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}