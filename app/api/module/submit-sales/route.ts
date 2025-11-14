/**
 * Sales Form Submit API - DATE SORT FIX v2
 * - Default insertIndex to 1 when date is oldest
 * - No more random 1000++ insertions
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

function getColumnLetter(colNum: number): string {
  let letter = '';
  while (colNum > 0) {
    colNum--;
    letter = String.fromCharCode(65 + (colNum % 26)) + letter;
    colNum = Math.floor(colNum / 26);
  }
  return letter;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const str = dateStr.toString().trim();

  if (!isNaN(Number(str))) {
    const base = new Date(Date.UTC(1899, 11, 30));
    base.setUTCDate(base.getUTCDate() + Number(str));
    base.setUTCHours(0, 0, 0, 0);
    return base;
  }

  if (str.includes("/")) {
    const [dd, mm, yyyy] = str.split("/").map(Number);
    if (!isNaN(dd) && !isNaN(mm) && !isNaN(yyyy)) {
      return new Date(Date.UTC(yyyy, mm - 1, dd));
    }
  }

  if (str.includes("-")) {
    const [yyyy, mm, dd] = str.split("-").map(Number);
    if (!isNaN(dd) && !isNaN(mm) && !isNaN(yyyy)) {
      return new Date(Date.UTC(yyyy, mm - 1, dd));
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    console.log("=".repeat(80));
    console.log("🛒 SALES FORM SUBMIT API (DATE SORT FIX v2)");
    console.log("=".repeat(80));

    // AUTH
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const accessToken = (token as any)?.accessToken;
    if (!accessToken) return NextResponse.json({ error: "No access token" }, { status: 401 });

    // BODY
    const body = await request.json();
    const { spreadsheetId, sheetName, formData, fields } = body;

    if (!spreadsheetId || !sheetName || !formData || !fields) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { lineItems, ...customerData } = formData;
    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json({ error: "No line items provided" }, { status: 400 });
    }

    // LOAD METADATA
    const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
    const metadataRes = await fetch(metadataUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    const metadata = await metadataRes.json();
    const sheet = metadata.sheets.find((s: any) => s.properties.title === sheetName);
    const sheetId = sheet.properties.sheetId;

    // LOAD DATA
    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}`;
    const getRes = await fetch(getUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    const sheetData = await getRes.json();
    const existingRows = sheetData.values || [];
    const headerRow = existingRows[0] || [];

    const lastRow = existingRows.length;
    console.log("📌 Last row =", lastRow);

    // FIELD MAPPING
    const columnIndices: Record<string, number> = {};
    let dateFieldIndex: number | null = null;

    interface FieldConfig {
      fieldName: string;
      order: number;
      type: string;
      section: string;
    }

    for (const field of fields as FieldConfig[]) {
      const colIndex = Number(field.order) - 1;
      if (colIndex >= 0) {
        columnIndices[field.fieldName] = colIndex;
        if (field.type === "date") dateFieldIndex = colIndex;
      }
    }

    // BUILD ROWS
    const rowsToInsert: any[][] = [];
    const customerFields = (fields as FieldConfig[]).filter((f: FieldConfig) => f.section === "customer");
    const lineItemFields = (fields as FieldConfig[]).filter((f: FieldConfig) => f.section === "lineitem");

    lineItems.forEach((item: any, idx: number) => {
      const row = new Array(headerRow.length).fill("");

      customerFields.forEach((f: FieldConfig) => {
        const col = columnIndices[f.fieldName];
        if (col !== undefined) {
          if (idx === 0) row[col] = customerData[f.fieldName] || "";
          else if (["date", "cust_id", "วันที่", "รหัสลูกค้า"].includes(f.fieldName.toLowerCase())) {
            row[col] = customerData[f.fieldName] || "";
          }
        }
      });

      lineItemFields.forEach((f: FieldConfig) => {
        const col = columnIndices[f.fieldName];
        if (col !== undefined) row[col] = item[f.fieldName] || "";
      });

      rowsToInsert.push(row);
    });

    console.log(`🧱 Rows built: ${rowsToInsert.length}`);

    // ============================
    //  DATE SORT (FIXED LOGIC)
    // ============================
    let insertIndex = lastRow; // default append

    if (dateFieldIndex !== null) {
      const newDate = parseDate(rowsToInsert[0][dateFieldIndex]);
      console.log("🗓️ New date parsed:", newDate);

      if (newDate) {
        const dateValues: (string | null)[] = [];
        for (let i = 1; i < lastRow; i++) {
          dateValues.push(existingRows[i]?.[dateFieldIndex] || null);
        }

        console.log(`🔍 DEBUG: dateValues.length=${dateValues.length}, lastRow=${lastRow}`);
        console.log(`🔍 Last 5 dates:`, dateValues.slice(-5).map((d, idx) => ({ idx: dateValues.length - 5 + idx, value: d })));

        // ✅ GAS LOGIC: Loop ย้อนหลัง (newest to oldest)
        // หาแถวสุดท้ายที่มี date <= inputDate
        // แล้ว insert ถัดจากแถวนั้น
        const headerRow = 1;
        insertIndex = headerRow + 1; // default → insert at row 2 (หลัง header)
        
        for (let j = dateValues.length - 1; j >= 0; j--) {
          const dateValue = dateValues[j];
          if (dateValue !== null) {
            const ex = parseDate(dateValue);
            if (ex && newDate >= ex) {
              // ✅ j = index ใน dateValues (0-indexed, เริ่มจาก row 2)
              // insertIndex = j + headerRow + 2
              insertIndex = j + headerRow + 2;
              console.log(`📍 Found at j=${j}, existingDate=${ex}, newDate=${newDate}, insertIndex=${insertIndex}`);
              break;
            }
          }
        }
      }
    }

    console.log("📌 Final InsertIndex =", insertIndex);

    // EXPAND SHEET
    const requiredRows = insertIndex + rowsToInsert.length;
    const currentMaxRows = sheet.properties.gridProperties.rowCount;

    if (requiredRows > currentMaxRows) {
      const expandUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
      await fetch(expandUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{
            updateSheetProperties: {
              properties: { sheetId, gridProperties: { rowCount: requiredRows + 100 } },
              fields: "gridProperties.rowCount"
            }
          }]
        })
      });
    }

    // INSERT EMPTY ROWS
    const insertUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    await fetch(insertUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{
          insertDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: insertIndex - 1,
              endIndex: insertIndex - 1 + rowsToInsert.length
            }
          }
        }]
      })
    });

    // UPDATE VALUES
    const endCol = getColumnLetter(headerRow.length);
    const writeRange = `${sheetName}!A${insertIndex}:${endCol}${insertIndex + rowsToInsert.length - 1}`;

    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${writeRange}?valueInputOption=USER_ENTERED`;
    const updateRes = await fetch(updateUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: rowsToInsert }),
    });

    const result = await updateRes.json();

    return NextResponse.json({
      success: true,
      message: `Inserted ${rowsToInsert.length} rows at row ${insertIndex}`,
      insertIndex,
      updated: result
    });

  } catch (err: any) {
    console.error("❌ ERROR:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}