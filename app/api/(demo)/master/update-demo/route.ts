/**
 * POST /api/master/update-demo
 * DEMO version — อัปเดต/เพิ่มข้อมูลใน client spreadsheet ด้วย Service Account
 *
 * เปลี่ยนจาก OAuth accessToken → SA เพราะ accessToken หมดอายุได้ ทำให้ลูกค้าเห็น 401
 * Body: { spreadsheetId, sheetName, updates: [{ rowIndex, data[], isNew }] }
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saBatchUpdate, saAppendRow, saInvalidateCache } from "@/lib/google-sa";

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { spreadsheetId, sheetName, updates } = await request.json();
    if (!spreadsheetId || !sheetName || !Array.isArray(updates))
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    // Append new rows
    const newRows = updates.filter((u: any) => u.isNew);
    for (const u of newRows) {
      await saAppendRow(spreadsheetId, `${sheetName}!A:A`, u.data);
    }

    // Batch update existing rows
    const existingUpdates = updates.filter((u: any) => !u.isNew);
    if (existingUpdates.length > 0) {
      const batchData = existingUpdates.map((u: any) => ({
        range:  `${sheetName}!A${u.rowIndex}`,
        values: [u.data],
      }));
      await saBatchUpdate(spreadsheetId, batchData);
    }

    saInvalidateCache(spreadsheetId);

    return NextResponse.json({
      success: true,
      updated: existingUpdates.length,
      appended: newRows.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
