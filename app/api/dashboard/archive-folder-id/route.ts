/**
 * API Route: Get Archive Folder ID - PRODUCTION READY
 * Location: app/api/dashboard/archive-folder-id/route.ts
 * 
 * ✅ Column indices verified: Index 9 = archive_folder_id
 * ✅ Flexible is_active check
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const MASTER_CONFIG_ID = "1j7LguHaX8pIvvQ1PqqenuguOsPT1QthJqXJyMYW2xo8";
const SHEET_NAME = "client_modules";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  const moduleName = searchParams.get("moduleName");

  console.log("🧪 [getArchiveFolderId] API Called");
  console.log("━".repeat(60));
  console.log("📋 Parameters:");
  console.log("   clientId:", clientId || "❌ MISSING");
  console.log("   moduleName:", moduleName || "❌ MISSING");

  if (!clientId || !moduleName) {
    return NextResponse.json(
      {
        error: "❌ Missing required parameters",
        required: ["clientId", "moduleName"],
        received: { clientId, moduleName },
      },
      { status: 400 }
    );
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token?.accessToken) {
    console.error("❌ Not authenticated");
    return NextResponse.json(
      { error: "❌ Not authenticated" },
      { status: 401 }
    );
  }

  const accessToken = token.accessToken as string;

  try {
    console.log("\n📊 Fetching from Google Sheets...");
    console.log(`   Sheet: ${SHEET_NAME}`);

    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${MASTER_CONFIG_ID}/values/${SHEET_NAME}`;

    const response = await fetch(sheetsUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    console.log("📡 Response Status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Sheets API Error:", errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    if (!data.values || data.values.length === 0) {
      console.warn("⚠️ No data found in sheet");
      return NextResponse.json(
        { error: "⚠️ No data in sheet" },
        { status: 404 }
      );
    }

    const [headers, ...rows] = data.values;

    console.log("\n📊 Sheet Structure:");
    console.log("   Headers:", headers);
    console.log("   Total Rows:", rows.length);

    // ✅ VERIFIED Column Indices (based on actual sheet dump)
    const COLS = {
      moduleId: 0,             // Col A: module_id
      clientId: 1,             // Col B: client_id
      moduleName: 2,           // Col C: module_name
      spreadsheetId: 3,        // Col D: spreadsheet_id
      sheetName: 4,            // Col E: sheet_name
      configName: 5,           // Col F: config_name
      isActive: 6,             // Col G: is_active
      notes: 7,                // Col H: notes
      dashboardConfigName: 8,  // Col I: Dashboard_Config_name
      archiveFolderId: 9,      // Col J: archive_folder_id ✅ VERIFIED!
    };

    console.log(`\n🔎 Searching for: clientId="${clientId}" + moduleName="${moduleName}"`);

    const matchingRow = rows.find((row: any[]) => {
      const rowClientId = String(row[COLS.clientId] || "").trim();
      const rowModuleName = String(row[COLS.moduleName] || "").trim();
      const rowIsActive = String(row[COLS.isActive] || "").trim().toUpperCase();

      const clientMatch = rowClientId === clientId;
      const nameMatch = rowModuleName.toLowerCase() === moduleName.toLowerCase();
      
      // ✅ Flexible is_active check
      // Accept: TRUE, YES, or any value that is NOT FALSE/NO/empty
      const activeMatch = 
        rowIsActive === "TRUE" || 
        rowIsActive === "YES" || 
        (rowIsActive !== "FALSE" && rowIsActive !== "NO" && rowIsActive !== "");

      console.log(
        `   Checking: client=${clientMatch} name=${nameMatch} active=${activeMatch} | ` +
        `client_id="${rowClientId}" module_name="${rowModuleName}" is_active="${rowIsActive}"`
      );

      return clientMatch && nameMatch && activeMatch;
    });

    if (!matchingRow) {
      console.warn(`\n⚠️ No matching row found`);
      
      console.log("\n📋 First 5 available rows:");
      rows.slice(0, 5).forEach((row: any[], idx: number) => {
        console.log(
          `   Row ${idx + 2}: ` +
          `client_id="${row[COLS.clientId]}" | ` +
          `module_name="${row[COLS.moduleName]}" | ` +
          `is_active="${row[COLS.isActive]}" | ` +
          `archive_folder_id="${row[COLS.archiveFolderId]}"`
        );
      });

      return NextResponse.json(
        {
          error: "❌ No matching configuration found",
          searchedFor: { clientId, moduleName },
          hint: "Check console for available rows. Make sure is_active is not FALSE or NO.",
        },
        { status: 404 }
      );
    }

    console.log("✅ Matching row found!");

    let archiveFolderId = String(matchingRow[COLS.archiveFolderId] || "").trim();

    if (!archiveFolderId || archiveFolderId === "undefined") {
      console.warn("⚠️ archive_folder_id is empty or undefined in matching row");

      return NextResponse.json(
        {
          error: "⚠️ archive_folder_id is empty or not set",
          row: {
            client_id: matchingRow[COLS.clientId],
            module_name: matchingRow[COLS.moduleName],
            is_active: matchingRow[COLS.isActive],
          },
          hint: "Add archive folder ID in Google Sheet Column J",
        },
        { status: 404 }
      );
    }

    // ✅ Extract folder ID if it's a URL
    const urlMatch = archiveFolderId.match(/folders\/([a-zA-Z0-9_-]+)/);
    if (urlMatch && urlMatch[1]) {
      console.log("🔗 Extracted Folder ID from URL:", urlMatch[1]);
      archiveFolderId = urlMatch[1];
    }

    console.log("\n✅ Success!");
    console.log("   archive_folder_id:", archiveFolderId);
    console.log("━".repeat(60));

    return NextResponse.json(
      {
        success: true,
        archiveFolderId,
        clientId,
        moduleName,
        metadata: {
          source: "client_modules sheet",
          spreadsheetId: MASTER_CONFIG_ID,
          sheet: SHEET_NAME,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("━".repeat(60));
    console.error("❌ [getArchiveFolderId] Error:", error.message);
    console.error("━".repeat(60));

    return NextResponse.json(
      {
        error: error.message,
        details: error.stack,
      },
      { status: 500 }
    );
  }
}