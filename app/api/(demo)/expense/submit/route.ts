/**
 * POST /api/expense/submit
 * บันทึก expense entry ลงชีท พร้อม date-sort
 * แยกจาก submit-general เพื่อรองรับ column ที่เกิน headerRow.length
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  saReadRange,
  saGetSheetMeta,
  saStructuralBatchUpdate,
  saWriteRange,
  saInvalidateCache,
} from "@/lib/google-sa";

function colLetter(n: number): string {
  let s = "";
  for (let c = n; c > 0; ) { c--; s = String.fromCharCode(65 + (c % 26)) + s; c = Math.floor(c / 26); }
  return s;
}

function parseDate(v: any): Date | null {
  if (!v) return null;
  const s = v.toString().trim();
  if (s.includes("/")) {
    const [dd, mm, yyyy] = s.split("/").map(Number);
    if (!isNaN(dd) && !isNaN(mm) && !isNaN(yyyy)) return new Date(Date.UTC(yyyy, mm - 1, dd));
  }
  if (s.includes("-")) {
    const [yyyy, mm, dd] = s.split("-").map(Number);
    if (!isNaN(dd) && !isNaN(mm) && !isNaN(yyyy)) return new Date(Date.UTC(yyyy, mm - 1, dd));
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { spreadsheetId, sheetName, formData, fields, period, branchId } = body;

    if (!spreadsheetId || !sheetName || !formData || !fields)
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    const lineItems: Record<string, any>[] = formData.lineItems || [];
    if (!lineItems.length)
      return NextResponse.json({ error: "No line items" }, { status: 400 });

    // อ่าน header + sheetId
    const { sheetId, rowCount: initialRowCount } = await saGetSheetMeta(spreadsheetId, sheetName);
    const allRows      = await saReadRange(spreadsheetId, `${sheetName}!A:Z`);
    const headerRow    = allRows[0] || [];

    // หา index ของ branch_id column ก่อน เพื่อรวมใน maxColIdx
    const branchColIdx = branchId
      ? (() => {
          const i = headerRow.findIndex((h: any) =>
            ["branch_id", "branch", "สาขา"].includes((h ?? "").toString().toLowerCase().trim())
          );
          return i >= 0 ? i : 8;
        })()
      : -1;

    // หา max column index จาก order ของ fields ทั้งหมด + branch_id column
    let maxColIdx = Math.max(headerRow.length - 1, branchColIdx);
    let dateColIdx: number | null = null;

    const colMap: Record<string, number> = {};
    for (const f of fields) {
      let idx = -1;
      if (f.order !== undefined && f.order !== null && f.order !== "") {
        idx = parseInt(f.order.toString()) - 1;
      } else {
        // ค้นหา column จาก fieldName โดยตรงใน headerRow (case-insensitive)
        idx = headerRow.findIndex((h: any) =>
          (h ?? "").toString().trim().toLowerCase() === f.fieldName.toLowerCase()
        );
      }
      if (idx >= 0) {
        colMap[f.fieldName] = idx;
        if (idx > maxColIdx) maxColIdx = idx;
        if (f.type === "date" && dateColIdx === null) dateColIdx = idx;
      }
    }

    // rowSize ต้องครอบคลุมถึง column สุดท้ายที่ใช้ (รวม branch_id)
    const rowSize = maxColIdx + 1;

    // Build rows
    const rowsToInsert = lineItems.map((item) => {
      const row = new Array(rowSize).fill("");
      for (const f of fields) {
        const idx = colMap[f.fieldName];
        if (idx !== undefined) row[idx] = item[f.fieldName] ?? "";
      }
      if (branchId && branchColIdx >= 0) row[branchColIdx] = branchId;
      // col A = period — เขียนเฉพาะตอนว่าง (ไม่ทับ formula ที่มีอยู่แล้ว)
      if (period && row[0] === "") row[0] = period;
      return row;
    });

    // Date-sort insert
    const existingRows = allRows.slice(1);
    let dateValues = existingRows.map((r) => dateColIdx !== null ? parseDate(r[dateColIdx]) : null);
    let lastRow = allRows.length;
    let rowCount = initialRowCount;

    const inserted: number[] = [];

    for (const row of rowsToInsert) {
      let insertIndex = lastRow + 1;

      if (dateColIdx !== null) {
        const nd = parseDate(row[dateColIdx])?.getTime() ?? null;
        if (nd !== null) {
          insertIndex = 2; // หลัง header
          for (let j = dateValues.length - 1; j >= 0; j--) {
            const ed = dateValues[j]?.getTime() ?? null;
            if (ed !== null && nd >= ed) { insertIndex = j + 3; break; }
          }
        }
      }

      // Expand sheet ถ้าจำเป็น
      if (insertIndex > rowCount) {
        const newCount = insertIndex + 100;
        await saStructuralBatchUpdate(spreadsheetId, [{
          updateSheetProperties: {
            properties: { sheetId, gridProperties: { rowCount: newCount } },
            fields: "gridProperties.rowCount",
          },
        }]);
        rowCount = newCount;
      }

      // Insert blank row
      await saStructuralBatchUpdate(spreadsheetId, [{
        insertDimension: {
          range: { sheetId, dimension: "ROWS", startIndex: insertIndex - 1, endIndex: insertIndex },
          inheritFromBefore: false,
        },
      }]);

      // Write — ใช้ rowSize เป็น endCol (ครอบคลุมทุก column ที่ต้องการ)
      const endCol = colLetter(rowSize);
      await saWriteRange(spreadsheetId, `${sheetName}!A${insertIndex}:${endCol}${insertIndex}`, [row]);
      saInvalidateCache(spreadsheetId);

      const insertedDate = dateColIdx !== null ? parseDate(row[dateColIdx]) : null;
      dateValues.splice(insertIndex - 2, 0, insertedDate);
      lastRow++;
      inserted.push(insertIndex);
    }

    return NextResponse.json({ success: true, rowsInserted: inserted.length, insertedAt: inserted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
