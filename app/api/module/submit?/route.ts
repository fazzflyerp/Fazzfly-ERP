/**
 * Form Submit API - Order-Based Mapping
 * Location: app/api/module/submit/route.ts
 * 
 * ✅ Maps fields using "order" column from Config Sheet
 * ✅ Order 1 = Column A (index 0), Order 2 = Column B (index 1), etc.
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

export async function POST(request: NextRequest) {
  try {
    console.log("=" .repeat(80));
    console.log("📡 Form Submit API - ORDER-BASED MAPPING");
    console.log("=" .repeat(80));

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
    console.log("   Fields:", fields.length);

    if (!spreadsheetId || !sheetName || !formData || !fields) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

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

    // 🔧 MAP FIELDS USING ORDER COLUMN
    console.log("\n" + "=".repeat(80));
    console.log("🔗 ORDER-BASED FIELD MAPPING");
    console.log("=".repeat(80));

    const columnIndices: { [key: string]: number } = {};

    for (const field of fields) {
      const order = field.order;
      
      if (order !== undefined && order !== null && order !== "") {
        // Order 1 → Column 0 (A), Order 2 → Column 1 (B), etc.
        const colIndex = parseInt(order) - 1;
        
        if (colIndex >= 0 && colIndex < headerRow.length) {
          columnIndices[field.fieldName] = colIndex;
          console.log(`   ✅ "${field.fieldName}" → Order ${order} → Column ${colIndex} (${getColumnLetter(colIndex + 1)})`);
        } else if (colIndex >= 0) {
          console.log(`   ⚠️ "${field.fieldName}" → Order ${order} → Column ${colIndex} (OUT OF RANGE, sheet has ${headerRow.length} columns)`);
        } else {
          console.log(`   ❌ "${field.fieldName}" → Invalid order: ${order}`);
        }
      } else {
        console.log(`   ⚠️ "${field.fieldName}" → No order specified, skipping`);
      }
    }

    const mappedCount = Object.keys(columnIndices).length;
    console.log(`\n📊 Mapped: ${mappedCount} of ${fields.length} fields`);

    if (mappedCount === 0) {
      return NextResponse.json({
        error: "No fields mapped. Check that 'order' column is set in Config Sheet.",
        debug: {
          fields: fields.map((f: any) => ({ fieldName: f.fieldName, order: f.order }))
        }
      }, { status: 400 });
    }

    // Determine form type
    const hasSection = fields.some((f: any) => f.section && f.section.trim() !== "");
    const customerFields = hasSection ? fields.filter((f: any) => f.section === "customer") : [];
    const lineItemFields = hasSection ? fields.filter((f: any) => f.section === "lineitem") : [];

    console.log("\n📋 Form Type:", hasSection ? "SALES" : "GENERAL");
    if (hasSection) {
      console.log("   Customer fields:", customerFields.length);
      console.log("   Line item fields:", lineItemFields.length);
    }

    // Build rows
    let rowsToInsert: any[][] = [];

    if (!hasSection) {
      console.log("\n📝 Building GENERAL form rows...");
      
      // ✅ Get all filled line items (not just first one)
      const filledRows = formData.lineItems 
        ? formData.lineItems.filter((row: any) => Object.values(row).some((v: any) => v))
        : [formData];  // Fallback to single formData if no lineItems
      
      console.log(`   Processing ${filledRows.length} rows...`);

      filledRows.forEach((rowData: any, idx: number) => {
        const rowValues: any[] = new Array(headerRow.length).fill("");
        let filledCount = 0;

        for (const field of fields) {
          const colIndex = columnIndices[field.fieldName];
          if (colIndex !== undefined) {
            const value = rowData[field.fieldName] || "";
            rowValues[colIndex] = value;
            if (value) {
              filledCount++;
            }
          }
        }

        rowsToInsert.push(rowValues);
        console.log(`   Row ${idx + 1}: ${filledCount} non-empty cells`);
      });

      console.log(`\n✅ Created ${rowsToInsert.length} rows`);

    } else {
      console.log("\n🛒 Building SALES form rows...");
      const lineItems = formData.lineItems;
      
      if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
        return NextResponse.json(
          { error: "Sales form requires formData.lineItems array" },
          { status: 400 }
        );
      }

      console.log(`   Line items: ${lineItems.length}`);

      lineItems.forEach((item: any, itemIdx: number) => {
        const rowValues: any[] = new Array(headerRow.length).fill("");
        let filledCount = 0;

        // Customer fields - first row only
        if (itemIdx === 0) {
          for (const field of customerFields) {
            const colIndex = columnIndices[field.fieldName];
            if (colIndex !== undefined) {
              const value = formData[field.fieldName] || "";
              rowValues[colIndex] = value;
              if (value) filledCount++;
            }
          }
        }

        // Line item fields - all rows
        for (const field of lineItemFields) {
          const colIndex = columnIndices[field.fieldName];
          if (colIndex !== undefined) {
            const value = item[field.fieldName] || "";
            rowValues[colIndex] = value;
            if (value) filledCount++;
          }
        }

        rowsToInsert.push(rowValues);
        console.log(`   Row ${itemIdx + 1}: ${filledCount} non-empty cells`);
      });

      console.log(`\n✅ Created ${rowsToInsert.length} rows`);
    }

    // Expand sheet if needed
    const insertRowIndex = existingRows.length;
    const endCol = getColumnLetter(headerRow.length);
    const requiredRows = insertRowIndex + rowsToInsert.length;
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
        const expandError = await expandResponse.text();
        console.error("❌ Expand error:", expandError);
        throw new Error(`Failed to expand sheet: ${expandResponse.status}`);
      }

      console.log("✅ Sheet expanded");
    }

    // Insert rows
    const range = `${sheetName}!A${insertRowIndex + 1}:${endCol}${insertRowIndex + rowsToInsert.length}`;
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

    console.log(`\n📤 Inserting at: ${range}`);

    const updateResponse = await fetch(updateUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: rowsToInsert }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error("❌ Update failed:", errorText);
      throw new Error(`Update failed: ${updateResponse.status}`);
    }

    const updateResult = await updateResponse.json();
    console.log("\n✅ SUCCESS!");
    console.log("   Updated cells:", updateResult.updatedCells);
    console.log("   Updated rows:", updateResult.updatedRows);

    console.log("\n" + "=".repeat(80));

    return NextResponse.json({
      success: true,
      message: `บันทึก ${rowsToInsert.length} แถวสำเร็จ`,
      rowsInserted: rowsToInsert.length,
      cellsUpdated: updateResult.updatedCells,
      shouldRedirect: false, // ✅ Don't redirect after successful submission
    });

  } catch (error: any) {
    console.error("\n❌ ERROR:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}