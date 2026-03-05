/**
 * =============================================================================
 * FILE PATH: app/api/master/update/route.ts
 * =============================================================================
 * 
 * API: POST /api/master/update
 * 
 * Purpose: อัปเดตข้อมูลกลับไป Google Sheets
 * รองรับ: Add new rows, Edit existing rows, Delete rows
 * 
 * Request Body:
 * {
 *   spreadsheetId: string,
 *   sheetName: string,
 *   updates: [
 *     {
 *       rowIndex: number,  // -1 for new rows
 *       data: any[],
 *       isNew: boolean
 *     }
 *   ]
 * }
 * 
 * Returns:
 * {
 *   success: true,
 *   message: string,
 *   updatedRows: number,
 *   updatedCells: number
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function POST(request: NextRequest) {
  try {
    console.log("=".repeat(60));
    console.log("💾 [API] POST /api/master/update");
    console.log("=".repeat(60));

    // ✅ Auth
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

    // ✅ Parse body
    const body = await request.json();
    const { spreadsheetId, sheetName, updates } = body;

    if (!spreadsheetId || !sheetName || !updates) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    console.log(`📁 Spreadsheet: ${spreadsheetId}`);
    console.log(`📄 Sheet: ${sheetName}`);
    console.log(`📊 Updates: ${updates.length} rows`);

    // ✅ 1. อ่านข้อมูลปัจจุบัน
    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`;
    
    const getResponse = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!getResponse.ok) {
      throw new Error("Failed to fetch current data");
    }

    const currentData = await getResponse.json();
    const currentValues = currentData.values || [];
    
    console.log(`   Current rows: ${currentValues.length}`);

    // ✅ 2. เตรียมข้อมูลใหม่
    const newValues = [...currentValues];
    
    // แยก updates เป็น new rows และ existing rows
    const newRows = updates.filter((u: any) => u.isNew);
    const existingRows = updates.filter((u: any) => !u.isNew);
    
    console.log(`   New rows: ${newRows.length}`);
    console.log(`   Existing rows: ${existingRows.length}`);

    // อัปเดต existing rows
    existingRows.forEach((update: any) => {
      const arrayIndex = update.rowIndex - 1; // rowIndex is 1-based
      if (arrayIndex >= 0 && arrayIndex < newValues.length) {
        newValues[arrayIndex] = update.data;
        console.log(`   ✏️  Updated row ${update.rowIndex}`);
      }
    });

    // เพิ่ม new rows
    newRows.forEach((update: any) => {
      newValues.push(update.data);
      console.log(`   ➕ Added new row`);
    });

    // ✅ 3. ลบแถวที่ถูก filter ออก (ถ้ามีการลบ)
    const allRowIndices = updates.map((u: any) => u.rowIndex);
    const deletedIndices: number[] = [];
    
    for (let i = 1; i < currentValues.length; i++) { // เริ่มที่ 1 เพราะ 0 คือ header
      const rowIndex = i + 1; // rowIndex is 1-based
      if (!allRowIndices.includes(rowIndex) && !newRows.some((r: any) => r.rowIndex === rowIndex)) {
        deletedIndices.push(i);
      }
    }

    // ลบจากท้ายไปหน้า เพื่อไม่ให้ index เปลี่ยน
    deletedIndices.sort((a, b) => b - a).forEach((idx) => {
      newValues.splice(idx, 1);
      console.log(`   🗑️  Deleted row ${idx + 1}`);
    });

    console.log(`   Final rows: ${newValues.length}`);

    // ✅ 4. เขียนข้อมูลกลับ
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}?valueInputOption=USER_ENTERED`;
    
    const updateResponse = await fetch(updateUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: newValues,
      }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error("❌ Update error:", errorText);
      throw new Error("Failed to update data");
    }

    const result = await updateResponse.json();
    
    console.log("✅ Update successful!");
    console.log(`   Updated cells: ${result.updatedCells}`);
    console.log(`   Updated rows: ${result.updatedRows}`);
    console.log("=".repeat(60));

    return NextResponse.json({
      success: true,
      message: "Data updated successfully",
      updatedRows: result.updatedRows,
      updatedCells: result.updatedCells,
    });

  } catch (error: any) {
    console.error("❌ [API] Error:", error.message);
    console.error(error.stack);
    
    return NextResponse.json(
      { error: error.message || "Failed to update data" },
      { status: 500 }
    );
  }
}