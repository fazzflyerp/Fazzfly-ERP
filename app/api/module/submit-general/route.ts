/**
 * General Form Submit API
 * POST /api/module/submit-general
 *
 * ✅ Port logic จาก Apps Script — อ่านครั้งเดียว วน loop insert ทีละแถว
 * ✅ อัปเดต dateValues ใน memory หลัง insert แต่ละแถว (เหมือน splice ของ Apps Script)
 * ✅ ไม่มี checksum validation (ช้าและไม่แม่น)
 * ✅ Serverless-compatible
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

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

// ✅ Parse date — รองรับ DD/MM/YYYY, YYYY-MM-DD และ Excel serial number
function parseDate(dateStr: any): Date | null {
  if (!dateStr) return null;
  const str = dateStr.toString().trim();

  // Excel serial number
  if (!isNaN(Number(str)) && Number(str) > 1000) {
    const base = new Date(Date.UTC(1899, 11, 30));
    base.setUTCDate(base.getUTCDate() + Number(str));
    base.setUTCHours(0, 0, 0, 0);
    return base;
  }

  // DD/MM/YYYY
  if (str.includes("/")) {
    const [dd, mm, yyyy] = str.split("/").map(Number);
    if (!isNaN(dd) && !isNaN(mm) && !isNaN(yyyy)) {
      return new Date(Date.UTC(yyyy, mm - 1, dd));
    }
  }

  // YYYY-MM-DD
  if (str.includes("-")) {
    const parts = str.split("-").map(Number);
    if (parts.length === 3) {
      const [yyyy, mm, dd] = parts;
      if (!isNaN(dd) && !isNaN(mm) && !isNaN(yyyy)) {
        return new Date(Date.UTC(yyyy, mm - 1, dd));
      }
    }
  }

  return null;
}

// ✅ Normalize วันที่เป็น timestamp เพื่อเปรียบเทียบ (เหมือน normalize ของ Apps Script)
function normalizeDate(d: Date | null): number | null {
  if (!d) return null;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// ─── Core insert logic (port จาก Apps Script) ─────────────────────────────────

async function insertRowsWithDateSort(params: {
  accessToken: string;
  spreadsheetId: string;
  sheetName: string;
  sheetId: number;
  rowsToInsert: any[][];
  dateFieldIndex: number | null;
  headerRow: any[];
  requestId: string;
}) {
  const {
    accessToken,
    spreadsheetId,
    sheetName,
    sheetId,
    rowsToInsert,
    dateFieldIndex,
    headerRow,
    requestId,
  } = params;

  // ✅ 1. อ่านข้อมูลปัจจุบันครั้งเดียว (เหมือน Apps Script ที่อ่าน sheet ครั้งเดียว)
  const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`;
  const getRes = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!getRes.ok) throw new Error(`Failed to fetch sheet: ${getRes.status}`);

  const sheetData = await getRes.json();
  const existingRows: any[][] = sheetData.values || [];
  const headerRowIndex = 1; // แถวที่ 1 คือ header

  // ✅ 2. สร้าง dateValues array จาก existing rows (เหมือน Apps Script)
  // เก็บเฉพาะ date column ทั้งหมด (ข้าม header แถวแรก)
  let dateValues: (Date | null)[] = existingRows
    .slice(1) // ข้าม header
    .map((row) =>
      dateFieldIndex !== null ? parseDate(row[dateFieldIndex]) : null
    );

  let lastRow = existingRows.length; // จำนวนแถวทั้งหมดรวม header

  console.log(`📊 [${requestId}] Existing rows: ${lastRow}, dateValues: ${dateValues.length}`);

  const insertResults: { rowIndex: number }[] = [];

  // ✅ 3. วน loop insert ทีละแถว (เหมือน Apps Script)
  for (let i = 0; i < rowsToInsert.length; i++) {
    const row = rowsToInsert[i];

    // ─── คำนวณ insertIndex ───────────────────────────────────────────────────
    let insertIndex = lastRow + 1; // default: append ท้ายสุด

    if (dateFieldIndex !== null) {
      const newDateRaw = row[dateFieldIndex];
      const newDate = parseDate(newDateRaw);
      const newDateNorm = normalizeDate(newDate);

      if (newDateNorm !== null) {
        console.log(`📅 [${requestId}] Row ${i + 1}: date = ${new Date(newDateNorm).toISOString().split("T")[0]}`);

        insertIndex = headerRowIndex + 1; // default: หลัง header (วันที่เก่าที่สุด)

        // ✅ วนย้อนจากล่างขึ้นบน (เหมือน Apps Script)
        for (let j = dateValues.length - 1; j >= 0; j--) {
          const existingDateNorm = normalizeDate(dateValues[j]);
          if (existingDateNorm !== null && newDateNorm >= existingDateNorm) {
            insertIndex = j + headerRowIndex + 2; // +2 = 1 (header) + 1 (next row)
            break;
          }
        }

        console.log(`📍 [${requestId}] Row ${i + 1}: insertIndex = ${insertIndex}`);
      } else {
        console.warn(`⚠️ [${requestId}] Row ${i + 1}: cannot parse date "${newDateRaw}", appending`);
      }
    }

    // ─── Expand sheet ถ้าจำเป็น ─────────────────────────────────────────────
    const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
    const metadataRes = await fetch(metadataUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const metadata = await metadataRes.json();
    const sheetMeta = metadata.sheets.find((s: any) => s.properties.title === sheetName);
    const currentMaxRows = sheetMeta?.properties?.gridProperties?.rowCount ?? 1000;

    if (insertIndex > currentMaxRows) {
      console.log(`🔧 [${requestId}] Expanding sheet to ${insertIndex + 100} rows...`);
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [{
            updateSheetProperties: {
              properties: {
                sheetId,
                gridProperties: { rowCount: insertIndex + 100 },
              },
              fields: "gridProperties.rowCount",
            },
          }],
        }),
      });
    }

    // ─── Insert blank row ────────────────────────────────────────────────────
    const insertRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [{
            insertDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: insertIndex - 1, // 0-indexed
                endIndex: insertIndex,       // insert 1 แถว
              },
              inheritFromBefore: false,
            },
          }],
        }),
      }
    );

    if (!insertRes.ok) {
      throw new Error(`insertDimension failed: ${insertRes.status}`);
    }

    // ─── Write data ──────────────────────────────────────────────────────────
    const endCol = getColumnLetter(headerRow.length);
    const writeRange = `${sheetName}!A${insertIndex}:${endCol}${insertIndex}`;
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(writeRange)}?valueInputOption=USER_ENTERED`;

    const updateRes = await fetch(updateUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [row] }),
    });

    if (!updateRes.ok) {
      throw new Error(`Write failed: ${updateRes.status}`);
    }

    console.log(`✅ [${requestId}] Row ${i + 1} inserted at ${insertIndex}`);

    // ✅ อัปเดต dateValues ใน memory (เหมือน splice ของ Apps Script)
    // เพื่อให้ loop ถัดไปคำนวณตำแหน่งถูกต้อง
    const insertedDate = dateFieldIndex !== null ? parseDate(row[dateFieldIndex]) : null;
    dateValues.splice(insertIndex - headerRowIndex - 1, 0, insertedDate);
    lastRow++;

    insertResults.push({ rowIndex: insertIndex });
  }

  return insertResults;
}

// ─── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const requestId = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  try {
    console.log("=".repeat(80));
    console.log(`📋 [${requestId}] GENERAL FORM SUBMIT (Apps Script Logic)`);
    console.log("=".repeat(80));

    // ✅ AUTH
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
    }

    if ((token as any).error === "RefreshAccessTokenError") {
      return NextResponse.json(
        { error: "Session expired", code: "TOKEN_EXPIRED", message: "Please sign out and sign in again" },
        { status: 401 }
      );
    }

    const accessToken = (token as any)?.accessToken;
    if (!accessToken) {
      return NextResponse.json({ error: "No access token", code: "NO_TOKEN" }, { status: 401 });
    }

    // ✅ PARSE BODY
    const body = await request.json();
    const { spreadsheetId, sheetName, formData, fields } = body;

    if (!spreadsheetId || !sheetName || !formData || !fields) {
      return NextResponse.json({ error: "Missing required fields", code: "MISSING_PARAMS" }, { status: 400 });
    }

    const lineItems = formData.lineItems || [];
    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json({ error: "No line items provided", code: "NO_ITEMS" }, { status: 400 });
    }

    console.log(`📦 [${requestId}] Sheet: ${sheetName}, Items: ${lineItems.length}`);

    // ✅ GET METADATA + SHEET ID
    const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
    const metadataRes = await fetch(metadataUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!metadataRes.ok) {
      if (metadataRes.status === 401) {
        return NextResponse.json(
          { error: "Session expired", code: "TOKEN_EXPIRED", message: "Please sign out and sign in again" },
          { status: 401 }
        );
      }
      throw new Error(`Metadata failed: ${metadataRes.status}`);
    }

    const metadata = await metadataRes.json();
    const sheet = metadata.sheets?.find((s: any) => s.properties.title === sheetName);

    if (!sheet) {
      return NextResponse.json(
        { error: `Sheet "${sheetName}" not found`, code: "SHEET_NOT_FOUND" },
        { status: 404 }
      );
    }

    const sheetId = sheet.properties.sheetId;

    // ✅ GET HEADER ROW
    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`;
    const getRes = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!getRes.ok) throw new Error(`Failed to fetch sheet: ${getRes.status}`);
    const sheetData = await getRes.json();
    const headerRow = (sheetData.values || [])[0] || [];

    console.log(`📋 [${requestId}] Header columns: ${headerRow.length}`);

    // ✅ MAP FIELDS → column indices
    const columnIndices: Record<string, number> = {};
    let dateFieldIndex: number | null = null;

    for (const field of fields) {
      if (field.order !== undefined && field.order !== null && field.order !== "") {
        const colIndex = parseInt(field.order.toString()) - 1;
        if (colIndex >= 0) {
          columnIndices[field.fieldName] = colIndex;
          if (field.type === "date" && dateFieldIndex === null) {
            dateFieldIndex = colIndex;
            console.log(`📅 [${requestId}] Date field: "${field.fieldName}" at col ${colIndex + 1}`);
          }
        }
      }
    }

    if (Object.keys(columnIndices).length === 0) {
      return NextResponse.json({ error: "No fields mapped", code: "NO_MAPPING" }, { status: 400 });
    }

    // ✅ BUILD ROWS
    const rowsToInsert: any[][] = lineItems.map((item: any, idx: number) => {
      const rowValues: any[] = new Array(headerRow.length).fill("");
      for (const field of fields) {
        const colIndex = columnIndices[field.fieldName];
        if (colIndex !== undefined) {
          rowValues[colIndex] = item[field.fieldName] ?? "";
        }
      }
      console.log(`   Row ${idx + 1}: built with ${Object.keys(columnIndices).length} fields`);
      return rowValues;
    });

    // ✅ INSERT (Apps Script logic)
    const results = await insertRowsWithDateSort({
      accessToken,
      spreadsheetId,
      sheetName,
      sheetId,
      rowsToInsert,
      dateFieldIndex,
      headerRow,
      requestId,
    });

    console.log("=".repeat(80));

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