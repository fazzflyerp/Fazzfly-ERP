/**
 * FILE PATH: app/api/master/update/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { withLogger } from "@/lib/with-logger";

// แปลง column index (0-based) → A1 notation (A, B, ..., Z, AA, AB, ...)
function colIndexToLetter(index: number): string {
  let letter = "";
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

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

    const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
    const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

    // แยก new rows กับ existing rows
    const existingUpdates = updates.filter((u: any) => !u.isNew);
    const newUpdates = updates.filter((u: any) => u.isNew);

    // ── 1. อัปเดต existing rows ─────────────────────────────────────────
    // ใช้ batchUpdate เพื่อเขียนเฉพาะ cell ที่ map ใน config เท่านั้น
    // ไม่แตะ column ที่ไม่ได้ map เลย
    if (existingUpdates.length > 0) {
      const batchData: { range: string; values: any[][] }[] = [];

      for (const update of existingUpdates) {
        config.forEach((field: { order: number }, fieldIdx: number) => {
          const colLetter = colIndexToLetter(field.order - 1);
          const range = `${sheetName}!${colLetter}${update.rowIndex}`;
          batchData.push({
            range,
            values: [[update.data[fieldIdx] ?? ""]],
          });
        });
      }

      const batchRes = await fetch(`${baseUrl}/values:batchUpdate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          valueInputOption: "USER_ENTERED",
          data: batchData,
        }),
      });

      if (!batchRes.ok) {
        const err = await batchRes.text();
        throw new Error(`batchUpdate failed: ${err}`);
      }
    }

    // ── 2. Append new rows ───────────────────────────────────────────────
    // หา max column index จาก config เพื่อสร้าง row array ขนาดถูกต้อง
    if (newUpdates.length > 0) {
      const maxColIndex = Math.max(...config.map((f: { order: number }) => f.order - 1));

      const newRowValues = newUpdates.map((update: any) => {
        const rowArray = new Array(maxColIndex + 1).fill("");
        config.forEach((field: { order: number }, fieldIdx: number) => {
          rowArray[field.order - 1] = update.data[fieldIdx] ?? "";
        });
        return rowArray;
      });

      const appendRes = await fetch(
        `${baseUrl}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ values: newRowValues }),
        }
      );

      if (!appendRes.ok) {
        const err = await appendRes.text();
        throw new Error(`append failed: ${err}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Updated successfully",
      updatedRows: existingUpdates.length,
      addedRows: newUpdates.length,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
export const POST = withLogger("/api/master/update", _POST);
