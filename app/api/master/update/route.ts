/**
 * FILE PATH: app/api/master/update/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { withLogger } from "@/lib/with-logger";

async function _POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const accessToken = (token as any)?.accessToken;
    const body = await request.json();
    const { spreadsheetId, sheetName, updates, config } = body;

    if (!spreadsheetId || !sheetName || !updates || !config) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // 1. อ่านข้อมูลทั้งหมดจาก Sheet (รวม header และทุก column)
    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`;
    const getResponse = await fetch(getUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!getResponse.ok) throw new Error("Failed to fetch current data");

    const currentData = await getResponse.json();
    const currentValues: any[][] = currentData.values || [];

    const headerRow = currentValues[0] || [];
    const oldDataRows = currentValues.slice(1); // ข้อมูลเดิมทุกแถว (ไม่มี header)

    // 2. สร้าง Map: rowIndex (1-based จาก Sheets) → raw row array เดิม
    //    เพื่อ preserve column ที่ไม่ได้ map ใน config
    const oldRowMap = new Map<number, any[]>();
    oldDataRows.forEach((row, idx) => {
      const sheetsRowIndex = idx + 2; // row 1 = header, row 2 = first data row
      oldRowMap.set(sheetsRowIndex, row);
    });

    // 3. หา total column count (เผื่อ row เดิมยาวกว่า config)
    const maxColCount = Math.max(
      headerRow.length,
      ...oldDataRows.map(r => r.length)
    );

    // 4. สร้างแถวใหม่โดย merge: เอาข้อมูลเดิม + patch เฉพาะ column ที่ config map ไว้
    const finalDataRows: any[][] = updates.map((update: any) => {
      let baseRow: any[];

      if (update.isNew) {
        // แถวใหม่: เริ่มจาก empty array ขนาดเท่า maxColCount
        baseRow = new Array(maxColCount).fill("");
      } else {
        // แถวเดิม: เอา raw row เดิมมาก่อน (preserve column ที่ไม่ได้ map)
        const existingRow = oldRowMap.get(update.rowIndex as number) || [];
        baseRow = [...existingRow];
        // เติม column ที่ขาดให้ครบ
        while (baseRow.length < maxColCount) baseRow.push("");
      }

      // Patch เฉพาะ column ที่อยู่ใน config
      // update.data คือ array เรียงตาม config order (จาก page.tsx handleSave)
      config.forEach((field: { order: number }, fieldIdx: number) => {
        const colIndex = field.order - 1; // order เริ่มจาก 1
        baseRow[colIndex] = update.data[fieldIdx] ?? "";
      });

      return baseRow;
    });

    // 5. รวม header + แถวใหม่
    const finalValues = [headerRow, ...finalDataRows];

    // 6. Clear sheet แล้วเขียนใหม่ทั้งหมด
    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}:clear`;
    await fetch(clearUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    });

    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}?valueInputOption=USER_ENTERED`;
    const updateResponse = await fetch(updateUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: finalValues }),
    });

    if (!updateResponse.ok) throw new Error("Failed to update data");

    return NextResponse.json({
      success: true,
      message: "Updated successfully",
      updatedRows: finalDataRows.length,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
export const POST = withLogger("/api/master/update", _POST);
