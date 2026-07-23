/**
 * Module Update API
 * Location: app/api/module/update/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { withLogger } from "@/lib/with-logger";
import { saBatchUpdate, saAppendRows, saLog, saInvalidateCache } from "@/lib/google-sa";
import { verifySheetAccess } from "@/lib/verify-sheet-access";

function getColumnLetter(colNum: number): string {
  let letter = "";
  while (colNum > 0) {
    colNum--;
    letter = String.fromCharCode(65 + (colNum % 26)) + letter;
    colNum = Math.floor(colNum / 26);
  }
  return letter;
}

async function _POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { spreadsheetId, sheetName, updates } = body;

    if (!spreadsheetId || !sheetName || !updates)
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });

    const userEmail = ((token as any)?.email as string || "").toLowerCase();
    const access = await verifySheetAccess(userEmail, spreadsheetId);
    if (!access.allowed)
      return NextResponse.json({ error: "Forbidden: sheet not owned by your client", code: "FORBIDDEN" }, { status: 403 });

    console.log(`💾 [module/update] ${sheetName} — ${updates.length} rows`);

    // Batch update existing rows — one range per cell, only config-specified columns
    const batchData = updates
      .filter((u: any) => !u.isNew)
      .flatMap((u: any) =>
        (u.data as any[])
          .map((val: any, colIdx: number) => ({ colIdx, val }))
          .filter(({ val }: { val: any }) => val !== undefined && val !== null)
          .map(({ colIdx, val }: { colIdx: number; val: any }) => ({
            range: `${sheetName}!${getColumnLetter(colIdx + 1)}${u.rowIndex}`,
            values: [[val]],
          }))
      );

    let totalUpdated = 0;
    if (batchData.length > 0) {
      await saBatchUpdate(spreadsheetId, batchData);
      totalUpdated = batchData.length;
    }

    // Append new rows
    const newRows = updates.filter((u: any) => u.isNew);
    if (newRows.length > 0) {
      await saAppendRows(spreadsheetId, `${sheetName}!A:A`, newRows.map((u: any) => u.data));
    }

    if (batchData.length > 0 || newRows.length > 0) saInvalidateCache(spreadsheetId);

    const firstUpdatedRowIndex = updates.find((u: any) => !u.isNew)?.rowIndex;
    await saLog(spreadsheetId, {
      email: userEmail,
      action: "update",
      module: sheetName,
      detail: `แก้ไข ${totalUpdated} แถว, เพิ่ม ${newRows.length} แถว`,
      rowIndex: typeof firstUpdatedRowIndex === "number" ? firstUpdatedRowIndex : undefined,
    });

    return NextResponse.json({ success: true, updated: totalUpdated, appended: newRows.length });

  } catch (error: any) {
    console.error("❌ [module/update] Error:", error.message);
    return NextResponse.json({ error: error.message || "Failed to update data" }, { status: 500 });
  }
}
export const POST = withLogger("/api/module/update", _POST);
