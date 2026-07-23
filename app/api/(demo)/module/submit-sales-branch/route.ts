/**
 * POST /api/module/submit-sales-branch
 * เขียนเฉพาะ column ที่ระบุใน config เท่านั้น (sparse write via saBatchUpdate)
 * branchName → เขียนลง column ที่ config ระบุ fieldName ขึ้นต้นด้วย "branch" เท่านั้น
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  saReadRange,
  saGetSheetMeta,
  saStructuralBatchUpdate,
  saBatchUpdate,
  saLog,
  saInvalidateCache,
} from "@/lib/google-sa";

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

async function insertRowsWithDateSort(params: {
  spreadsheetId: string;
  sheetName: string;
  sheetId: number;
  rowsToInsert: any[][];
  dateFieldIndex: number | null;
  requestId: string;
}) {
  const { spreadsheetId, sheetName, sheetId, rowsToInsert, dateFieldIndex, requestId } = params;

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
      }
    }

    if (insertIndex < 2) insertIndex = lastRow + 1;

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

    // sparse write — เขียนเฉพาะ cell ที่มีค่าจาก config เท่านั้น
    const cellWrites = row
      .map((val: any, colIdx: number) => ({ colIdx, val }))
      .filter(({ val }: { val: any }) => val !== undefined && val !== null && val !== "")
      .map(({ colIdx, val }: { colIdx: number; val: any }) => ({
        range: `${sheetName}!${getColumnLetter(colIdx + 1)}${insertIndex}`,
        values: [[val]],
      }));
    if (cellWrites.length > 0) await saBatchUpdate(spreadsheetId, cellWrites);
    saInvalidateCache(spreadsheetId);

    dateValues.splice(insertIndex - headerRowIndex - 1, 0, dateFieldIndex !== null ? parseDate(row[dateFieldIndex]) : null);
    lastRow++;
    insertResults.push({ rowIndex: insertIndex });
  }

  return insertResults;
}

export async function POST(request: NextRequest) {
  const requestId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((token as any).error === "RefreshAccessTokenError")
      return NextResponse.json({ error: "Session expired" }, { status: 401 });

    const body = await request.json();
    const { spreadsheetId, sheetName, formData, fields, branchName } = body;

    if (!spreadsheetId || !sheetName || !formData || !fields)
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    const { lineItems, ...customerData } = formData;
    if (!Array.isArray(lineItems) || lineItems.length === 0)
      return NextResponse.json({ error: "No line items provided" }, { status: 400 });

    const { sheetId } = await saGetSheetMeta(spreadsheetId, sheetName);

    interface FieldConfig { fieldName: string; order: number; type: string; section: string; }

    const COL_BRANCH = 32; // col AG — hardcoded เสมอ

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

    const maxConfigCol = Math.max(...Object.values(columnIndices), COL_BRANCH);

    const SENTINEL = new Set(["__on__", "__selected__"]);
    const cleanVal = (v: any) => { const s = String(v ?? ""); return SENTINEL.has(s) ? "" : v ?? ""; };

    const rowsToInsert: any[][] = lineItems.map((item: any, idx: number) => {
      const row = new Array(maxConfigCol + 1).fill("");

      customerFields.forEach((f: FieldConfig) => {
        const col = columnIndices[f.fieldName];
        if (col !== undefined) {
          if (idx === 0) {
            row[col] = cleanVal(customerData[f.fieldName]);
          } else {
            const name = f.fieldName.toLowerCase();
            if (f.type === "date" || name.includes("date") || name.includes("วันที่") ||
                name.includes("id") || name === "cust_id" || name === "receipt_no") {
              row[col] = cleanVal(customerData[f.fieldName]);
            }
          }
        }
      });

      lineItemFields.forEach((f: FieldConfig) => {
        const col = columnIndices[f.fieldName];
        if (col !== undefined) row[col] = cleanVal(item[f.fieldName]);
      });

      if (branchName) row[COL_BRANCH] = branchName;

      return row;
    });

    const results = await insertRowsWithDateSort({
      spreadsheetId, sheetName, sheetId, rowsToInsert, dateFieldIndex, requestId,
    });

    const userEmail = ((token as any)?.email as string || "").toLowerCase();
    await saLog(spreadsheetId, {
      email: userEmail,
      action: "submit",
      module: sheetName,
      detail: `บันทึก ${results.length} แถว (sales-branch: ${branchName || "-"})`,
    });

    return NextResponse.json({
      success: true,
      message: `บันทึก ${results.length} แถวสำเร็จ`,
      rowsInserted: results.length,
      insertedAt: results.map((r) => r.rowIndex),
    });

  } catch (error: any) {
    console.error(`❌ [${requestId}] ERROR:`, error.message);
    return NextResponse.json({ error: "Failed to save data", message: error.message }, { status: 500 });
  }
}
