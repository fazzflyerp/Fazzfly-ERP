/**
 * POST /api/master/update-demo
 * DEMO version — อัปเดต/เพิ่มข้อมูลใน client spreadsheet ด้วย accessToken ของ user
 *
 * Body: { spreadsheetId, sheetName, updates: [{ rowIndex, data[], isNew }] }
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

async function sheetsRequest(url: string, method: string, body: any, accessToken: string) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheets API ${res.status}: ${text}`);
  }
  return res.json();
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const accessToken = (token as any)?.accessToken;
    if (!accessToken) return NextResponse.json({ error: "No access token" }, { status: 401 });

    const { spreadsheetId, sheetName, updates } = await request.json();
    if (!spreadsheetId || !sheetName || !Array.isArray(updates))
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    const base = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;

    // Append new rows
    const newRows = updates.filter((u: any) => u.isNew).map((u: any) => u.data);
    if (newRows.length > 0) {
      await sheetsRequest(
        `${base}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        "POST",
        { values: newRows },
        accessToken
      );
    }

    // Batch update existing rows
    const existingUpdates = updates.filter((u: any) => !u.isNew);
    if (existingUpdates.length > 0) {
      const data = existingUpdates.map((u: any) => ({
        range:  `${sheetName}!A${u.rowIndex}`,
        values: [u.data],
      }));
      await sheetsRequest(
        `${base}/values:batchUpdate`,
        "POST",
        { valueInputOption: "USER_ENTERED", data },
        accessToken
      );
    }

    return NextResponse.json({
      success: true,
      updated: existingUpdates.length,
      appended: newRows.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
