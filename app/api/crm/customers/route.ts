/**
 * FILE PATH: app/api/crm/customers/route.ts
 *
 * GET  /api/crm/customers?spreadsheetId=xxx&sheetName=Customers
 * POST /api/crm/customers  { spreadsheetId, sheetName, action, row, rowIndex? }
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

async function getAccessToken(req: NextRequest): Promise<string | null> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || (token as any).error === "RefreshAccessTokenError") return null;
  return (token as any)?.accessToken || null;
}

// ─────────────────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  console.log("👥 GET /api/crm/customers");

  const accessToken = await getAccessToken(request);
  if (!accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const spreadsheetId = searchParams.get("spreadsheetId");
  const sheetName     = searchParams.get("sheetName") || "Customers";

  if (!spreadsheetId) return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const err = await res.text();
      if (res.status === 401) return NextResponse.json({ error: "Session expired" }, { status: 401 });
      return NextResponse.json({ error: "Failed to fetch customers", details: err }, { status: res.status });
    }

    const data   = await res.json();
    const values = (data.values || []) as string[][];

    if (values.length === 0) return NextResponse.json({ success: true, count: 0, customers: [] });

    // ใช้ header row เป็น key — ไม่ hardcode schema
    const header    = values[0];
    const firstCol  = header[0]; // คอลัมน์แรก = รหัสลูกค้า
    const customers = values.slice(1)
      .map((row, i) => {
        const obj: any = { rowIndex: i + 2 };
        header.forEach((col, j) => { obj[col] = row[j] || ""; });
        // map alias ให้ frontend ใช้ได้ — ตาม column จริงของ sheet
        obj.customer_id     = row[0]  || "";
        obj.full_name       = row[1]  || "";
        obj.phone_number    = row[2]  || "";
        obj.address         = row[3]  || "";
        obj.nickname        = row[5]  || "";
        obj.line_id         = row[6]  || "";
        obj.gender          = row[8]  || "";
        obj.birthdate       = row[9]  || "";
        obj.allergy         = row[10] || "";
        obj.medical_history = row[11] || "";
        obj.source          = row[12] || "";
        obj.member_level    = row[13] || "";
        obj.notes           = row[14] || "";
        obj.tax_id          = row[4]  || "";
        obj.email           = row[7]  || "";
        obj.skin_type       = "";
        return obj;
      })
      .filter(c => c.customer_id);

    console.log(`   ✅ Fetched ${customers.length} customers`);
    return NextResponse.json({ success: true, count: customers.length, customers });

  } catch (error: any) {
    console.error("❌ customers GET:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────
// POST
// ─────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const accessToken = await getAccessToken(request);
  if (!accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { spreadsheetId, sheetName = "Customers", action, row, rowIndex } = body;
  if (!spreadsheetId) return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });

  try {
    if (action === "append") {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName + "!A1")}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [row] }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return NextResponse.json({ error: "Append failed" }, { status: 500 });
      return NextResponse.json({ success: true, action: "append" });
    }

    if (action === "update") {
      const range = `${sheetName}!A${rowIndex}`;
      const url   = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
      const res   = await fetch(url, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [row] }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return NextResponse.json({ error: "Update failed" }, { status: 500 });
      return NextResponse.json({ success: true, action: "update" });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}