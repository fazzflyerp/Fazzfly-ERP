/**
 * Form Submit API - Order-Based Mapping
 * Location: app/api/module/submit/route.ts
 *
 * ✅ Maps fields using "order" column from Config Sheet
 * ✅ ใช้ SA — ไม่พึ่ง OAuth token ของ user
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saGetSheetMeta, saStructuralBatchUpdate, saWriteRange } from "@/lib/google-sa";

function getColumnLetter(colNum: number): string {
  let letter = "";
  while (colNum > 0) {
    colNum--;
    letter = String.fromCharCode(65 + (colNum % 26)) + letter;
    colNum = Math.floor(colNum / 26);
  }
  return letter;
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { spreadsheetId, sheetName, formData, fields } = body;

    if (!spreadsheetId || !sheetName || !formData || !fields)
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    const { sheetId } = await saGetSheetMeta(spreadsheetId, sheetName);
    const existingRows = await saReadRange(spreadsheetId, sheetName);
    const headerRow = existingRows[0] || [];

    // Map fields using order column
    const columnIndices: { [key: string]: number } = {};
    for (const field of fields) {
      if (field.order !== undefined && field.order !== null && field.order !== "") {
        const colIndex = parseInt(field.order) - 1;
        if (colIndex >= 0) columnIndices[field.fieldName] = colIndex;
      }
    }

    if (Object.keys(columnIndices).length === 0)
      return NextResponse.json({ error: "No fields mapped. Check 'order' column in Config Sheet." }, { status: 400 });

    const hasSection = fields.some((f: any) => f.section && f.section.trim() !== "");
    const customerFields = hasSection ? fields.filter((f: any) => f.section === "customer") : [];
    const lineItemFields  = hasSection ? fields.filter((f: any) => f.section === "lineitem") : [];

    let rowsToInsert: any[][] = [];

    if (!hasSection) {
      const filledRows = formData.lineItems
        ? formData.lineItems.filter((row: any) => Object.values(row).some((v: any) => v))
        : [formData];

      filledRows.forEach((rowData: any) => {
        const rowValues: any[] = new Array(headerRow.length).fill("");
        for (const field of fields) {
          const colIndex = columnIndices[field.fieldName];
          if (colIndex !== undefined) rowValues[colIndex] = rowData[field.fieldName] || "";
        }
        rowsToInsert.push(rowValues);
      });
    } else {
      const lineItems = formData.lineItems;
      if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0)
        return NextResponse.json({ error: "Sales form requires formData.lineItems array" }, { status: 400 });

      lineItems.forEach((item: any, itemIdx: number) => {
        const rowValues: any[] = new Array(headerRow.length).fill("");
        if (itemIdx === 0) {
          for (const field of customerFields) {
            const col = columnIndices[field.fieldName];
            if (col !== undefined) rowValues[col] = formData[field.fieldName] || "";
          }
        }
        for (const field of lineItemFields) {
          const col = columnIndices[field.fieldName];
          if (col !== undefined) rowValues[col] = item[field.fieldName] || "";
        }
        rowsToInsert.push(rowValues);
      });
    }

    const insertRowIndex = existingRows.length;
    const endCol = getColumnLetter(headerRow.length);
    const requiredRows = insertRowIndex + rowsToInsert.length;
    const { rowCount: currentMaxRows } = await saGetSheetMeta(spreadsheetId, sheetName);

    if (requiredRows > currentMaxRows) {
      await saStructuralBatchUpdate(spreadsheetId, [{
        updateSheetProperties: {
          properties: { sheetId, gridProperties: { rowCount: requiredRows + 100 } },
          fields: "gridProperties.rowCount",
        },
      }]);
    }

    const range = `${sheetName}!A${insertRowIndex + 1}:${endCol}${insertRowIndex + rowsToInsert.length}`;
    await saWriteRange(spreadsheetId, range, rowsToInsert);

    return NextResponse.json({
      success: true,
      message: `บันทึก ${rowsToInsert.length} แถวสำเร็จ`,
      rowsInserted: rowsToInsert.length,
      shouldRedirect: false,
    });

  } catch (error: any) {
    console.error("❌ [submit] ERROR:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
