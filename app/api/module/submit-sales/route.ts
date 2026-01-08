/**
 * Sales Form Submit API - OPTIMISTIC LOCKING VERSION
 * ✅ Serverless-compatible
 * ✅ Auto-retry mechanism
 * ✅ Multi-client safe
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// Helper functions (เหมือนเดิม)
function getColumnLetter(colNum: number): string {
  let letter = "";
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

// ✅ สร้าง snapshot checksum (เช็คว่าข้อมูลเปลี่ยนไหม)
function createSnapshot(rows: any[][]): { checksum: string; rowCount: number } {
  // เอาแค่ 5 แถวล่างสุด + rowCount เพื่อเช็คว่ามีการเปลี่ยนแปลง
  const lastRows = rows.slice(-5);
  const data = JSON.stringify({ lastRows, total: rows.length });
  const checksum = Buffer.from(data).toString('base64').substring(0, 30);
  
  return {
    checksum,
    rowCount: rows.length
  };
}

// ✅ Main insert logic with retry
async function attemptInsertWithRetry(params: {
  accessToken: string;
  spreadsheetId: string;
  sheetName: string;
  sheetId: number;
  rowsToInsert: any[][];
  dateFieldIndex: number | null;
  headerRow: any[];
  customerFields: any[];
  lineItemFields: any[];
  requestId: string;
  maxRetries?: number;
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
    maxRetries = 3
  } = params;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`\n🔄 [${requestId}] Attempt ${attempt}/${maxRetries}`);

      // 1️⃣ อ่านข้อมูลปัจจุบัน + สร้าง snapshot
      const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`;
      const getRes = await fetch(getUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!getRes.ok) {
        throw new Error(`Failed to fetch sheet: ${getRes.status}`);
      }

      const sheetData = await getRes.json();
      const existingRows = sheetData.values || [];
      const snapshot = createSnapshot(existingRows);

      console.log(`📊 [${requestId}] Snapshot: ${snapshot.rowCount} rows, checksum: ${snapshot.checksum}`);

      // 2️⃣ คำนวณตำแหน่ง insert
      let insertIndex = snapshot.rowCount;

      if (dateFieldIndex !== null && rowsToInsert.length > 0) {
        const newDateStr = rowsToInsert[0][dateFieldIndex];
        const newDate = parseDate(newDateStr);

        if (newDate) {
          console.log(`📅 [${requestId}] New date: ${newDate.toISOString()}`);
          
          insertIndex = 1; // default: หลัง header

          // หาตำแหน่งที่ถูกต้อง (ย้อนจากล่างขึ้นบน)
          for (let i = snapshot.rowCount - 1; i >= 1; i--) {
            const existingDateStr = existingRows[i]?.[dateFieldIndex];
            const existingDate = parseDate(existingDateStr);
            
            if (existingDate && newDate >= existingDate) {
              insertIndex = i + 1;
              console.log(`📍 [${requestId}] Insert at row ${insertIndex}`);
              break;
            }
          }

          if (insertIndex === 1) {
            console.log(`📍 [${requestId}] Insert at row ${insertIndex} (oldest date)`);
          }
        }
      }

      // 3️⃣ Expand sheet if needed
      const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
      const metadataRes = await fetch(metadataUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      
      const metadata = await metadataRes.json();
      const sheet = metadata.sheets.find((s: any) => s.properties.title === sheetName);
      const currentMaxRows = sheet.properties.gridProperties.rowCount;
      const requiredRows = insertIndex + rowsToInsert.length;

      if (requiredRows > currentMaxRows) {
        console.log(`🔧 [${requestId}] Expanding sheet...`);
        const expandUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
        await fetch(expandUrl, {
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
                  gridProperties: { rowCount: requiredRows + 100 },
                },
                fields: "gridProperties.rowCount",
              },
            }],
          }),
        });
      }

      // 4️⃣ ✅ VALIDATE: ตรวจสอบว่าข้อมูลยังคงเหมือนเดิม
      const verifyRes = await fetch(getUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const verifyData = await verifyRes.json();
      const currentSnapshot = createSnapshot(verifyData.values || []);

      if (currentSnapshot.checksum !== snapshot.checksum) {
        console.warn(`⚠️ [${requestId}] Sheet modified during preparation!`);
        console.warn(`   Expected: ${snapshot.checksum}, Got: ${currentSnapshot.checksum}`);
        
        // Retry ด้วย exponential backoff + random jitter
        if (attempt < maxRetries) {
          const baseDelay = 500 * Math.pow(2, attempt - 1);
          const jitter = Math.random() * 500;
          const delay = baseDelay + jitter;
          
          console.log(`⏳ [${requestId}] Retrying in ${delay.toFixed(0)}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue; // Retry
        } else {
          throw new Error("DATA_MODIFIED");
        }
      }

      console.log(`✅ [${requestId}] Validation passed`);

      // 5️⃣ Insert blank rows
      console.log(`⏳ [${requestId}] Inserting ${rowsToInsert.length} rows at ${insertIndex}...`);
      
      const insertUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
      await fetch(insertUrl, {
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
                startIndex: insertIndex - 1,
                endIndex: insertIndex - 1 + rowsToInsert.length,
              },
            },
          }],
        }),
      });

      // 6️⃣ Write data
      const endCol = getColumnLetter(headerRow.length);
      const writeRange = `${sheetName}!A${insertIndex}:${endCol}${insertIndex + rowsToInsert.length - 1}`;
      const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(writeRange)}?valueInputOption=USER_ENTERED`;
      
      const updateRes = await fetch(updateUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: rowsToInsert }),
      });

      if (!updateRes.ok) {
        throw new Error(`Update failed: ${updateRes.status}`);
      }

      const result = await updateRes.json();

      console.log(`✅ [${requestId}] SUCCESS! Inserted at row ${insertIndex}`);

      return {
        success: true,
        insertIndex,
        result,
        attempts: attempt,
      };

    } catch (error: any) {
      // ถ้าเป็น DATA_MODIFIED และยังมี retry เหลือ → ลอง retry
      if (error.message === "DATA_MODIFIED" && attempt < maxRetries) {
        continue;
      }
      
      // Error อื่นๆ หรือ retry หมดแล้ว → throw
      console.error(`❌ [${requestId}] Attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw new Error(
          error.message === "DATA_MODIFIED"
            ? "ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น กรุณาลองใหม่อีกครั้ง"
            : error.message
        );
      }
    }
  }

  throw new Error("Max retries exceeded");
}

export async function POST(request: NextRequest) {
  const requestId = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  try {
    console.log("=".repeat(80));
    console.log(`🛒 [${requestId}] SALES FORM SUBMIT API`);
    console.log("=".repeat(80));

    // AUTH
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    if ((token as any).error === "RefreshAccessTokenError") {
      return NextResponse.json(
        {
          error: "Session expired",
          code: "TOKEN_EXPIRED",
          message: "Please sign out and sign in again",
        },
        { status: 401 }
      );
    }

    const accessToken = (token as any)?.accessToken;
    if (!accessToken) {
      return NextResponse.json(
        { error: "No access token", code: "NO_TOKEN" },
        { status: 401 }
      );
    }

    const userEmail = (token as any)?.email;
    console.log(`👤 [${requestId}] User: ${userEmail}`);

    // PARSE BODY
    const body = await request.json();
    const { spreadsheetId, sheetName, formData, fields } = body;

    console.log(`📦 [${requestId}] Sheet: ${sheetName}`);

    if (!spreadsheetId || !sheetName || !formData || !fields) {
      return NextResponse.json(
        { error: "Missing required fields", code: "MISSING_PARAMS" },
        { status: 400 }
      );
    }

    const { lineItems, ...customerData } = formData;

    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json(
        { error: "No line items provided", code: "NO_ITEMS" },
        { status: 400 }
      );
    }

    console.log(`   Line items: ${lineItems.length}`);

    // GET METADATA
    const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
    const metadataRes = await fetch(metadataUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!metadataRes.ok) {
      if (metadataRes.status === 401) {
        return NextResponse.json(
          {
            error: "Session expired",
            code: "TOKEN_EXPIRED",
            message: "Please sign out and sign in again",
          },
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

    // GET INITIAL DATA (for header)
    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`;
    const getRes = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const sheetData = await getRes.json();
    const headerRow = (sheetData.values || [])[0] || [];

    // MAP FIELDS
    console.log(`\n🔗 [${requestId}] Mapping fields...`);

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
        if (field.type === "date" && dateFieldIndex === null) {
          dateFieldIndex = colIndex;
        }
      }
    }

    // BUILD ROWS
    console.log(`\n📝 [${requestId}] Building rows...`);

    const rowsToInsert: any[][] = [];
    const customerFields = (fields as FieldConfig[]).filter((f) => f.section === "customer");
    const lineItemFields = (fields as FieldConfig[]).filter((f) => f.section === "lineitem");

    lineItems.forEach((item: any, idx: number) => {
      const row = new Array(headerRow.length).fill("");

      customerFields.forEach((f: FieldConfig) => {
        const col = columnIndices[f.fieldName];
        if (col !== undefined) {
          if (idx === 0) {
            row[col] = customerData[f.fieldName] || "";
          } else if (["date", "cust_id", "วันที่", "รหัสลูกค้า"].includes(f.fieldName.toLowerCase())) {
            row[col] = customerData[f.fieldName] || "";
          }
        }
      });

      lineItemFields.forEach((f: FieldConfig) => {
        const col = columnIndices[f.fieldName];
        if (col !== undefined) {
          row[col] = item[f.fieldName] || "";
        }
      });

      rowsToInsert.push(row);
    });

    console.log(`✅ [${requestId}] Built ${rowsToInsert.length} rows`);

    // ✅ ATTEMPT INSERT WITH AUTO-RETRY
    const result = await attemptInsertWithRetry({
      accessToken,
      spreadsheetId,
      sheetName,
      sheetId,
      rowsToInsert,
      dateFieldIndex,
      headerRow,
      customerFields,
      lineItemFields,
      requestId,
      maxRetries: 3,
    });

    console.log("=".repeat(80));

    return NextResponse.json({
      success: true,
      message: `บันทึก ${rowsToInsert.length} แถวสำเร็จ ที่ตำแหน่ง ${result.insertIndex}`,
      rowsInserted: rowsToInsert.length,
      insertIndex: result.insertIndex,
      cellsUpdated: result.result.updatedCells,
      attempts: result.attempts,
    });

  } catch (error: any) {
    console.error(`\n❌ [${requestId}] ERROR:`, error.message);

    return NextResponse.json(
      {
        error: "Failed to save data",
        code: "SAVE_ERROR",
        message: error.message,
      },
      { status: 500 }
    );
  }
}