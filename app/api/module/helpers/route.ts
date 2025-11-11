/**
 * Helper/Dropdown Options API
 * Location: app/api/module/helpers/route.ts
 * 
 * GET /api/module/helpers?spreadsheetId=xxx&helperName=yyy
 * 
 * ทำหน้าที่:
 * 1. ตรวจสอบ token
 * 2. ดึง helper sheet จาก Google Sheets
 * 3. Parse column A (value), B (name), C (detail)
 * 4. Return options สำหรับ dropdown/select
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function GET(request: NextRequest) {
  try {
    // ✅ ใช้ getToken
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessToken = (token as any)?.accessToken;
    if (!accessToken) {
      return NextResponse.json({ error: "No access token" }, { status: 401 });
    }

    // ดึง query params
    const searchParams = request.nextUrl.searchParams;
    const spreadsheetId = searchParams.get("spreadsheetId");
    const helperName = searchParams.get("helperName");

    if (!spreadsheetId || !helperName) {
      return NextResponse.json(
        { error: "Missing spreadsheetId or helperName" },
        { status: 400 }
      );
    }

    // ดึงข้อมูล columns A:C จาก Google Sheets
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${helperName}!A:C`;

    const response = await fetch(sheetsUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`⚠️ Helper sheet not found: ${helperName}`);
      // ✅ Return empty options แทนที่ 404
      return NextResponse.json({
        success: true,
        helperName,
        options: [],
        totalOptions: 0,
        warning: `Helper sheet "${helperName}" not found`,
      });
    }

    const data = await response.json();
    const rows = data.values || [];

    if (rows.length === 0) {
      console.warn(`⚠️ Helper sheet is empty: ${helperName}`);
      // ✅ Return empty options แทนที่ 404
      return NextResponse.json({
        success: true,
        helperName,
        options: [],
        totalOptions: 0,
        warning: `Helper sheet "${helperName}" is empty`,
      });
    }

    // ข้าม row 1 (header)
    const dataRows = rows.slice(1);
    
    const options = dataRows
      .filter((row: any[]) => row[0])
      .map((row: any[]) => ({
        value: row[0]?.toString() || "",
        label: `${row[1]?.toString() || ""} - ${row[2]?.toString() || ""}`,
      }));

    return NextResponse.json({
      success: true,
      helperName,
      options,
      totalOptions: options.length,
    });
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}