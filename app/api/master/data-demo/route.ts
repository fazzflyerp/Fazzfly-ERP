/**
 * GET /api/master/data-demo
 * DEMO version — อ่านข้อมูลจาก client spreadsheet
 * ใช้ accessToken ของ user (Google OAuth) แทน SA เพราะ SA อาจไม่มีสิทธิ์อ่าน client sheet
 *
 * Query: spreadsheetId, sheetName
 * Response: { success, count, rows, allRows (ถ้า includeHeader=true) }
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const accessToken = (token as any)?.accessToken;
    if (!accessToken) return NextResponse.json({ error: "No access token — please sign out and sign in again" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const spreadsheetId  = searchParams.get("spreadsheetId");
    const sheetName      = searchParams.get("sheetName");
    const includeHeader  = searchParams.get("includeHeader") === "true";

    if (!spreadsheetId || !sheetName)
      return NextResponse.json({ error: "Missing spreadsheetId or sheetName" }, { status: 400 });

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const message = errJson?.error?.message || "";
      console.error(`❌ [data-demo] Sheets ${res.status}:`, message);

      // ถ้า sheet ไม่พบ → ดึงรายชื่อ sheet จริงมาแสดง
      if (res.status === 400 && message.includes("Unable to parse range")) {
        try {
          const metaRes = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (metaRes.ok) {
            const meta = await metaRes.json();
            const available = (meta.sheets || []).map((s: any) => s.properties?.title).filter(Boolean);
            return NextResponse.json(
              { error: `ไม่พบ sheet ชื่อ "${sheetName}" — sheet ที่มีจริง: ${available.join(", ")}`, available },
              { status: 404 }
            );
          }
        } catch { /* ignore */ }
      }

      return NextResponse.json(
        { error: message || `Sheets API ${res.status}` },
        { status: res.status >= 400 && res.status < 500 ? res.status : 500 }
      );
    }

    const data = await res.json();
    const allRows: any[][] = data.values || [];
    const rows = allRows.slice(1);

    return NextResponse.json({
      success: true,
      count: rows.length,
      rows,
      ...(includeHeader ? { allRows } : {}),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch data" }, { status: 500 });
  }
}
