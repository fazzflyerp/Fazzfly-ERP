/**
 * Sales Form Submit API
 * POST /api/module/submit-sales
 *
 * ✅ Port logic จาก Apps Script — วน loop insert ทีละแถว เรียงตามวันที่
 * ✅ customer fields ลงเฉพาะแถวแรก (เหมือน Apps Script i === 0)
 * ✅ ใช้ SA — ไม่พึ่ง OAuth token ของ user
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  saReadRange,
  saGetSheetMeta,
  saStructuralBatchUpdate,
  saWriteRange,
  saLog,
} from "@/lib/google-sa";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getColumnLetter(colNum: number): string {
  let letter = "";
  while (colNum > 0) {
    colNum--;
    letter = String.fromCharCode(65 + (colNum % 26)) + letter;
    colNum = Math.floor(colNum / 26);
  }
  return letter;
}

function parseDate(dateStr: any): Date | null {
  if (!dateStr) return null;
  const str = dateStr.toString().trim();
  if (!isNaN(Number(str)) && Number(str) > 1000) {
    const base = new Date(Date.UTC(1899, 11, 30));
    base.setUTCDate(base.getUTCDate() + Number(str));
    base.setUTCHours(0, 0, 0, 0);
    return base;
  }
  if (str.includes("/")) {
    const [dd, mm, yyyy] = str.split("/").map(Number);
    if (!isNaN(dd) && !isNaN(mm) && !isNaN(yyyy)) return new Date(Date.UTC(yyyy, mm - 1, dd));
  }
  if (str.includes("-")) {
    const parts = str.split("-").map(Number);
    if (parts.length === 3) {
      const [yyyy, mm, dd] = parts;
      if (!isNaN(dd) && !isNaN(mm) && !isNaN(yyyy)) return new Date(Date.UTC(yyyy, mm - 1, dd));
    }
  }
  return null;
}

function normalizeDate(d: Date | null): number | null {
  if (!d) return null;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// ─── Core insert logic (SA version) ──────────────────────────────────────────

async function insertRowsWithDateSort(params: {
  spreadsheetId: string;
  sheetName: string;
  sheetId: number;
  rowsToInsert: any[][];
  dateFieldIndex: number | null;
  headerRow: any[];
  requestId: string;
}) {
  const { spreadsheetId, sheetName, sheetId, rowsToInsert, dateFieldIndex, headerRow, requestId } = params;

  const existingRows = await saReadRange(spreadsheetId, sheetName);
  const headerRowIndex = 1;

  let dateValues: (Date | null)[] = existingRows
    .slice(1)
    .map((row) => (dateFieldIndex !== null ? parseDate(row[dateFieldIndex]) : null));

  let lastRow = existingRows.length;
  let currentRowCount = (await saGetSheetMeta(spreadsheetId, sheetName)).rowCount;
  const insertResults: { rowIndex: number }[] = [];

  for (let i = 0; i < rowsToInsert.length; i++) {
    const row = rowsToInsert[i];
    let insertIndex = lastRow + 1;

    if (dateFieldIndex !== null) {
      const newDateNorm = normalizeDate(parseDate(row[dateFieldIndex]));
      if (newDateNorm !== null) {
        insertIndex = headerRowIndex + 1;
        for (let j = dateValues.length - 1; j >= 0; j--) {
          const existingDateNorm = normalizeDate(dateValues[j]);
          if (existingDateNorm !== null && newDateNorm >= existingDateNorm) {
            insertIndex = j + headerRowIndex + 2;
            break;
          }
        }
        console.log(`📍 [${requestId}] Row ${i + 1}: insertIndex = ${insertIndex}`);
      }
    }

    if (insertIndex > currentRowCount) {
      const newRowCount = insertIndex + 100;
      await saStructuralBatchUpdate(spreadsheetId, [{
        updateSheetProperties: {
          properties: { sheetId, gridProperties: { rowCount: newRowCount } },
          fields: "gridProperties.rowCount",
        },
      }]);
      currentRowCount = newRowCount;
    }

    await saStructuralBatchUpdate(spreadsheetId, [{
      insertDimension: {
        range: { sheetId, dimension: "ROWS", startIndex: insertIndex - 1, endIndex: insertIndex },
        inheritFromBefore: false,
      },
    }]);

    const endCol = getColumnLetter(headerRow.length);
    await saWriteRange(spreadsheetId, `${sheetName}!A${insertIndex}:${endCol}${insertIndex}`, [row]);

    console.log(`✅ [${requestId}] Row ${i + 1} inserted at ${insertIndex}`);

    dateValues.splice(insertIndex - headerRowIndex - 1, 0, dateFieldIndex !== null ? parseDate(row[dateFieldIndex]) : null);
    lastRow++;
    insertResults.push({ rowIndex: insertIndex });
  }

  return insertResults;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const requestId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
    if ((token as any).error === "RefreshAccessTokenError")
      return NextResponse.json({ error: "Session expired", code: "TOKEN_EXPIRED" }, { status: 401 });

    const body = await request.json();
    const { spreadsheetId, sheetName, formData, fields } = body;

    if (!spreadsheetId || !sheetName || !formData || !fields)
      return NextResponse.json({ error: "Missing required fields", code: "MISSING_PARAMS" }, { status: 400 });

    const { lineItems, ...customerData } = formData;
    if (!Array.isArray(lineItems) || lineItems.length === 0)
      return NextResponse.json({ error: "No line items provided", code: "NO_ITEMS" }, { status: 400 });

    console.log(`📦 [${requestId}] Sheet: ${sheetName}, Items: ${lineItems.length}`);

    const { sheetId } = await saGetSheetMeta(spreadsheetId, sheetName);
    const allRows = await saReadRange(spreadsheetId, sheetName);
    const headerRow = allRows[0] || [];

    interface FieldConfig { fieldName: string; order: number; type: string; section: string; }

    const columnIndices: Record<string, number> = {};
    let dateFieldIndex: number | null = null;

    for (const field of fields as FieldConfig[]) {
      const colIndex = Number(field.order) - 1;
      if (colIndex >= 0) {
        columnIndices[field.fieldName] = colIndex;
        if (field.type === "date" && dateFieldIndex === null) {
          dateFieldIndex = colIndex;
        }
      }
    }

    const customerFields = (fields as FieldConfig[]).filter((f) => f.section === "customer");
    const lineItemFields  = (fields as FieldConfig[]).filter((f) => f.section === "lineitem");

    const rowsToInsert: any[][] = lineItems.map((item: any, idx: number) => {
      const row = new Array(headerRow.length).fill("");

      customerFields.forEach((f: FieldConfig) => {
        const col = columnIndices[f.fieldName];
        if (col !== undefined) {
          if (idx === 0) {
            row[col] = customerData[f.fieldName] ?? "";
          } else {
            const name = f.fieldName.toLowerCase();
            if (f.type === "date" || name.includes("date") || name.includes("วันที่") ||
                name.includes("id") || name === "cust_id" || name === "receipt_no") {
              row[col] = customerData[f.fieldName] ?? "";
            }
          }
        }
      });

      lineItemFields.forEach((f: FieldConfig) => {
        const col = columnIndices[f.fieldName];
        if (col !== undefined) row[col] = item[f.fieldName] ?? "";
      });

      return row;
    });

    const results = await insertRowsWithDateSort({
      spreadsheetId, sheetName, sheetId, rowsToInsert, dateFieldIndex, headerRow, requestId,
    });

    const userEmail = ((token as any)?.email as string || "").toLowerCase();
    await saLog(spreadsheetId, {
      email: userEmail,
      action: "submit",
      module: sheetName,
      detail: `บันทึก ${results.length} แถว (sales)`,
    });

    return NextResponse.json({
      success: true,
      message: `บันทึก ${results.length} แถวสำเร็จ`,
      rowsInserted: results.length,
      insertedAt: results.map((r) => r.rowIndex),
    });

  } catch (error: any) {
    console.error(`❌ [${requestId}] ERROR:`, error.message);
    return NextResponse.json(
      { error: "Failed to save data", code: "SAVE_ERROR", message: error.message },
      { status: 500 }
    );
  }
}
