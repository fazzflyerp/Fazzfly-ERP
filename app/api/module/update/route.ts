/**
 * =============================================================================
 * FILE PATH: app/api/module/update/route.ts
 * =============================================================================
 * 
 * API: POST /api/module/update
 * 
 * Purpose: บันทึกข้อมูล Module/Transaction กลับ Google Sheets (Update/Delete)
 * 
 * Body:
 * {
 *   spreadsheetId: string,
 *   sheetName: string,
 *   updates: Array<{
 *     rowIndex: number,
 *     data: any[],
 *     isNew: boolean
 *   }>
 * }
 * 
 * Returns:
 * {
 *   success: true,
 *   updated: number
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function POST(request: NextRequest) {
  try {
    console.log("💾 [API] POST /api/transaction/update");

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

    // ✅ Get body
    const body = await request.json();
    const { spreadsheetId, sheetName, updates } = body;

    if (!spreadsheetId || !sheetName || !updates) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    console.log(`   📁 Spreadsheet: ${spreadsheetId}`);
    console.log(`   📄 Sheet: ${sheetName}`);
    console.log(`   📝 Updates: ${updates.length} rows`);

    // ✅ Prepare batch update requests
    const batchData = updates
      .filter((update: any) => !update.isNew) // ข้าม new rows (ควรใช้ append แทน)
      .map((update: any) => ({
        range: `${sheetName}!A${update.rowIndex}`,
        values: [update.data],
      }));

    if (batchData.length === 0) {
      return NextResponse.json({
        success: true,
        updated: 0,
        message: "No rows to update",
      });
    }

    // ✅ Update to Google Sheets
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;

    const response = await fetch(updateUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        valueInputOption: "USER_ENTERED",
        data: batchData,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Sheets API error:", errorText);
      throw new Error(`Failed to update data: ${response.status}`);
    }

    const result = await response.json();
    console.log(`   ✅ Updated: ${result.totalUpdatedRows} rows`);

    // ✅ Handle new rows (append)
    const newRows = updates.filter((update: any) => update.isNew);
    
    if (newRows.length > 0) {
      const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}:append`;

      const appendResponse = await fetch(appendUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          valueInputOption: "USER_ENTERED",
          values: newRows.map((row: any) => row.data),
        }),
      });

      if (!appendResponse.ok) {
        console.error("❌ Failed to append new rows");
      } else {
        console.log(`   ✅ Appended: ${newRows.length} new rows`);
      }
    }

    return NextResponse.json({
      success: true,
      updated: result.totalUpdatedRows || 0,
      appended: newRows.length,
    });

  } catch (error: any) {
    console.error("❌ [API] Error:", error.message);
    return NextResponse.json(
      { error: error.message || "Failed to update data" },
      { status: 500 }
    );
  }
}