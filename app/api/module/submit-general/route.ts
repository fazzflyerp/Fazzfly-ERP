/**
 * General Form Submit API - WITH PROPER DATE SORTING
 * Location: app/api/module/submit-general/route.ts
 * 
 * ✅ Handles GENERAL forms (no sections)
 * ✅ Supports multiple line items
 * ✅ Order-based field mapping
 * ✅ INSERT DATA SORTED BY DATE (รองรับ DD/MM/YYYY และ YYYY-MM-DD)
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

// ✅ Parse date string ให้เป็น Date object
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  const str = dateStr.toString().trim();
  
  // Format: DD/MM/YYYY
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1; // Month เริ่มที่ 0
      const year = parseInt(parts[2]);
      
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
  }
  
  // Format: YYYY-MM-DD
  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const day = parseInt(parts[2]);
      
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
  }
  
  return null;
}

export async function POST(request: NextRequest) {
  try {
    console.log("=".repeat(80));
    console.log("📋 GENERAL FORM SUBMIT API (WITH PROPER DATE SORTING)");
    console.log("=".repeat(80));

    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessToken = (token as any)?.accessToken;
    if (!accessToken) {
      return NextResponse.json({ error: "No access token" }, { status: 401 });
    }

    const body = await request.json();
    const { spreadsheetId, sheetName, formData, fields } = body;

    console.log("\n📦 REQUEST:");
    console.log("   Sheet:", sheetName);
    console.log("   Fields:", fields?.length || 0);

    if (!spreadsheetId || !sheetName || !formData || !fields) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const lineItems = formData.lineItems || [];
    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json({ error: "No line items provided" }, { status: 400 });
    }

    console.log("   Line items:", lineItems.length);

    // Fetch metadata
    const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
    const metadataResponse = await fetch(metadataUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!metadataResponse.ok) {
      throw new Error(`Metadata failed: ${metadataResponse.status}`);
    }

    const metadata = await metadataResponse.json();
    const sheet = metadata.sheets?.find((s: any) => s.properties.title === sheetName);
    const sheetId = sheet?.properties.sheetId ?? 0;

    // Fetch existing data
    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`;
    const getResponse = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!getResponse.ok) {
      throw new Error(`Failed to fetch sheet: ${getResponse.status}`);
    }

    const sheetData = await getResponse.json();
    const existingRows = sheetData.values || [];
    const headerRow = existingRows[0] || [];

    console.log("✅ Existing rows:", existingRows.length);
    console.log("📋 Header columns:", headerRow.length);

    // Map fields using order
    console.log("\n" + "=".repeat(80));
    console.log("🔗 FIELD MAPPING");
    console.log("=".repeat(80));

    const columnIndices: { [key: string]: number } = {};
    let dateFieldIndex: number | null = null;

    for (const field of fields) {
      const order = field.order;
      
      if (order !== undefined && order !== null && order !== "") {
        const colIndex = parseInt(order.toString()) - 1;
        
        if (colIndex >= 0 && colIndex < headerRow.length) {
          columnIndices[field.fieldName] = colIndex;
          console.log(`   ✅ "${field.fieldName}" → Column ${colIndex} (${getColumnLetter(colIndex + 1)})`);
          
          // ✅ หา date field
          if (field.type === "date" && dateFieldIndex === null) {
            dateFieldIndex = colIndex;
            console.log(`   📅 Date field found at column ${colIndex}`);
          }
        }
      }
    }

    const mappedCount = Object.keys(columnIndices).length;
    console.log(`\n📊 Mapped: ${mappedCount} fields`);

    if (mappedCount === 0) {
      return NextResponse.json({ error: "No fields mapped" }, { status: 400 });
    }

    // Build rows
    console.log("\n📝 Building rows...");
    const rowsToInsert: any[][] = [];

    lineItems.forEach((item: any, idx: number) => {
      const rowValues: any[] = new Array(headerRow.length).fill("");
      let filledCount = 0;

      for (const field of fields) {
        const colIndex = columnIndices[field.fieldName];
        if (colIndex !== undefined) {
          const value = item[field.fieldName] || "";
          rowValues[colIndex] = value;
          if (value) filledCount++;
        }
      }

      rowsToInsert.push(rowValues);
      console.log(`   Row ${idx + 1}: ${filledCount} cells`);
    });

    console.log(`\n✅ Created ${rowsToInsert.length} rows`);

    // ✅ SORT BY DATE และหาตำแหน่งที่จะ INSERT (ใช้ Date object)
    let insertPosition = existingRows.length; // default = ล่างสุด

    if (dateFieldIndex !== null && rowsToInsert.length > 0) {
      console.log("\n📅 SORTING BY DATE...");
      
      const newRowDateStr = rowsToInsert[0][dateFieldIndex];
      const newRowDate = parseDate(newRowDateStr);
      
      if (newRowDate) {
        console.log(`   New data date: ${newRowDateStr} → ${newRowDate.toISOString()}`);
        
        // หาตำแหน่งที่ควร insert
        for (let i = 1; i < existingRows.length; i++) {
          const existingDateStr = existingRows[i][dateFieldIndex];
          const existingDate = parseDate(existingDateStr);
          
          if (existingDate && newRowDate < existingDate) {
            insertPosition = i;
            console.log(`   ✅ Insert at row ${insertPosition} (before ${existingDateStr})`);
            console.log(`      ${newRowDate.toISOString()} < ${existingDate.toISOString()}`);
            break;
          }
        }
        
        if (insertPosition === existingRows.length) {
          console.log(`   ✅ Insert at end (after all existing dates)`);
        }
      } else {
        console.log(`   ⚠️  Cannot parse date: "${newRowDateStr}", inserting at end`);
      }
    } else {
      console.log("\n⚠️  No date field found, inserting at end");
    }

    // Expand sheet if needed
    const endCol = getColumnLetter(headerRow.length);
    const requiredRows = existingRows.length + rowsToInsert.length;
    const currentMaxRows = sheet?.properties?.gridProperties?.rowCount || 1000;

    if (requiredRows > currentMaxRows) {
      const newRowCount = requiredRows + 100;
      console.log(`\n🔧 Expanding sheet to ${newRowCount} rows...`);

      const expandUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
      const expandResponse = await fetch(expandUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [{
            updateSheetProperties: {
              properties: {
                sheetId: sheetId,
                gridProperties: { rowCount: newRowCount }
              },
              fields: "gridProperties.rowCount"
            }
          }]
        }),
      });

      if (!expandResponse.ok) {
        throw new Error(`Failed to expand sheet`);
      }

      console.log("✅ Sheet expanded");
    }

    // ✅ INSERT ROWS AT CORRECT POSITION
    console.log(`\n📤 Inserting ${rowsToInsert.length} rows at position ${insertPosition}...`);

    // Step 1: Insert blank rows
    const insertUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    const insertResponse = await fetch(insertUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [{
          insertDimension: {
            range: {
              sheetId: sheetId,
              dimension: "ROWS",
              startIndex: insertPosition,
              endIndex: insertPosition + rowsToInsert.length
            }
          }
        }]
      }),
    });

    if (!insertResponse.ok) {
      throw new Error(`Insert rows failed: ${insertResponse.status}`);
    }

    console.log("✅ Blank rows inserted");

    // Step 2: Fill data
    const range = `${sheetName}!A${insertPosition + 1}:${endCol}${insertPosition + rowsToInsert.length}`;
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

    console.log(`📝 Writing data to: ${range}`);

    const updateResponse = await fetch(updateUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: rowsToInsert }),
    });

    if (!updateResponse.ok) {
      throw new Error(`Update failed: ${updateResponse.status}`);
    }

    const updateResult = await updateResponse.json();
    console.log("\n✅ SUCCESS!");
    console.log("   Inserted at row:", insertPosition + 1);
    console.log("   Updated cells:", updateResult.updatedCells);
    console.log("   Updated rows:", updateResult.updatedRows);
    console.log("=".repeat(80));

    return NextResponse.json({
      success: true,
      message: `บันทึก ${rowsToInsert.length} แถวสำเร็จ ที่ตำแหน่ง ${insertPosition + 1}`,
      rowsInserted: rowsToInsert.length,
      insertPosition: insertPosition + 1,
      cellsUpdated: updateResult.updatedCells,
    });

  } catch (error: any) {
    console.error("\n❌ ERROR:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}