/**
 * =============================================================================
 * FILE PATH: app/api/module/data/route.ts
 * =============================================================================
 * 
 * API: GET /api/module/data
 * 
 * Purpose: ดึงข้อมูล Transaction/Module ทั้งหมดจาก Google Sheets
 * 
 * Query Parameters:
 * - spreadsheetId: Google Sheets ID
 * - sheetName: ชื่อ sheet
 * 
 * Returns:
 * {
 *   success: true,
 *   count: number,
 *   rows: array of arrays
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function GET(request: NextRequest) {
  try {
    console.log("📊 [API] GET /api/transaction/data");

    // ✅ Auth
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const accessToken = (token as any)?.accessToken;
    if (!accessToken) {
      return NextResponse.json(
        { error: "No access token" },
        { status: 401 }
      );
    }

    // ✅ Get params
    const { searchParams } = new URL(request.url);
    const spreadsheetId = searchParams.get("spreadsheetId");
    const sheetName = searchParams.get("sheetName");

    if (!spreadsheetId || !sheetName) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    console.log(`   📁 Spreadsheet: ${spreadsheetId}`);
    console.log(`   📄 Sheet: ${sheetName}`);

    // ✅ Fetch data from Google Sheets
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`;
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Sheets API error:", errorText);
      throw new Error(`Failed to fetch data: ${response.status}`);
    }

    const data = await response.json();
    const values = data.values || [];

    console.log(`   ✅ Rows fetched: ${values.length}`);

    // ✅ Remove header row
    const rows = values.slice(1);

    return NextResponse.json({
      success: true,
      count: rows.length,
      rows: rows,
    });

  } catch (error: any) {
    console.error("❌ [API] Error:", error.message);
    return NextResponse.json(
      { error: error.message || "Failed to fetch data" },
      { status: 500 }
    );
  }
}