/**
 * Module Config API - FIXED v2
 * Location: app/api/dashboard/module-config/route.ts
 * 
 * ✅ FIX: ค้นหา module_id (M001, M002...) ใน Column A
 * ✅ หา row ที่ตรงกับ module_id + client_id
 * 
 * ดึงจาก: Fazzfly_Master_Config → client_modules sheet
 * 
 * Query params:
 * - masterConfigId: Spreadsheet ID
 * - moduleName: Module name (e.g., "Sales") → แปลง → module_id (e.g., "M001")
 * - clientId: Client ID (e.g., "CLIENT001")
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// ============================================================
// Map: Module Name → Module ID
// ============================================================
const MODULE_NAME_TO_ID: Record<string, string> = {
  "Sales": "M001",
  "Purchase": "M002",
  "Payroll": "M003",
  "Expense": "M004",
  "Financial": "M005",
  "Usage": "M006",
  "Inventory": "M007",
  // เพิ่มเติมถ้าต้อง
};

export async function GET(request: NextRequest) {
  try {
    console.log("=".repeat(60));
    console.log("📦 START: Fetching module config v2");

    const { searchParams } = new URL(request.url);
    const masterConfigId = searchParams.get("masterConfigId");
    const moduleName = searchParams.get("moduleName");
    const clientId = searchParams.get("clientId"); // ✅ NEW
    const clientModulesSheet = searchParams.get("sheetName") || "client_modules";

    if (!masterConfigId) {
      return NextResponse.json(
        { error: "Missing masterConfigId parameter" },
        { status: 400 }
      );
    }

    if (!moduleName) {
      return NextResponse.json(
        { error: "Missing moduleName parameter" },
        { status: 400 }
      );
    }

    console.log("📋 Parameters:");
    console.log("   Master Config ID:", masterConfigId);
    console.log("   Module Name:", moduleName);
    console.log("   Client ID:", clientId || "(not provided)");
    console.log("   Sheet Name:", clientModulesSheet);

    // ============================================================
    // Map module name to module ID
    // ============================================================
    const moduleId = MODULE_NAME_TO_ID[moduleName];
    
    if (!moduleId) {
      console.warn(`⚠️ Module "${moduleName}" not in mapping`);
      console.log("   Available mappings:", Object.keys(MODULE_NAME_TO_ID).join(", "));
      
      return NextResponse.json(
        {
          error: "Module name not recognized",
          message: `"${moduleName}" not found in module mapping`,
          availableMappings: Object.keys(MODULE_NAME_TO_ID),
        },
        { status: 400 }
      );
    }

    console.log(`✅ Mapped: "${moduleName}" → "${moduleId}"`);

    // Authenticate
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token || !(token as any)?.accessToken) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const accessToken = (token as any).accessToken as string;

    // ============================================================
    // Fetch client_modules sheet
    // ============================================================
    console.log("⏳ Fetching client_modules sheet...");

    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${masterConfigId}/values/${encodeURIComponent(clientModulesSheet)}`;

    const response = await fetch(sheetsUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch sheet: ${response.status}`);
    }

    const data = await response.json();
    const rows = data.values as any[][] | undefined;

    if (!rows || rows.length < 2) {
      throw new Error("Sheet is empty or has no data rows");
    }

    console.log("✅ Sheet fetched:", rows.length, "rows");

    // ============================================================
    // HARDCODED: Column Indices
    // ============================================================
    const HARDCODED_INDICES = {
      moduleId: 0,        // Col A: module_id (M001, M002, ...)
      clientId: 1,        // Col B: client_id (CLIENT001, ...)
      spreadsheetId: 2,   // Col C: spreadsheet_id
      sheetName: 3,       // Col D: sheet_name
      configName: 4,      // Col E: config_name
      archiveFolderId: 9, // Col J: archive_folder_id
      enabled: 10,        // Col K: is_active (optional)
    };

    console.log("📍 Column Indices (HARDCODED):");
    console.log("   Module ID (Col A):", HARDCODED_INDICES.moduleId);
    console.log("   Client ID (Col B):", HARDCODED_INDICES.clientId);
    console.log("   Spreadsheet ID (Col C):", HARDCODED_INDICES.spreadsheetId);
    console.log("   Sheet Name (Col D):", HARDCODED_INDICES.sheetName);
    console.log("   Config Name (Col E):", HARDCODED_INDICES.configName);
    console.log("   Archive Folder ID (Col J):", HARDCODED_INDICES.archiveFolderId);
    console.log("   Enabled (Col K):", HARDCODED_INDICES.enabled);

    // ============================================================
    // Find matching module row
    // ============================================================
    console.log(`\n🔎 Finding row: moduleId="${moduleId}"`);
    if (clientId) {
      console.log(`                clientId="${clientId}"`);
    }

    const dataRows = rows.slice(1);
    let matchingRow = null;

    if (clientId) {
      // ✅ Search by BOTH moduleId AND clientId
      matchingRow = dataRows.find((row) => {
        const rowModuleId = String(row[HARDCODED_INDICES.moduleId] || "").trim();
        const rowClientId = String(row[HARDCODED_INDICES.clientId] || "").trim();
        return rowModuleId === moduleId && rowClientId === clientId;
      });

      if (matchingRow) {
        console.log("✅ Found row with moduleId + clientId match");
      }
    }

    // Fallback: ค้นหา moduleId เฉยๆ
    if (!matchingRow) {
      console.log("⏭️ Fallback: searching by moduleId only...");
      matchingRow = dataRows.find((row) => {
        const rowModuleId = String(row[HARDCODED_INDICES.moduleId] || "").trim();
        return rowModuleId === moduleId;
      });

      if (matchingRow) {
        console.log("✅ Found row with moduleId match");
      }
    }

    if (!matchingRow) {
      const availableModuleIds = dataRows
        .map((r) => r[HARDCODED_INDICES.moduleId])
        .filter((id) => id);

      return NextResponse.json(
        {
          error: "Module not found",
          message: `Module ID "${moduleId}" (from name "${moduleName}") not found in client_modules sheet`,
          availableModuleIds,
          debugInfo: {
            searchedModuleId: moduleId,
            searchedClientId: clientId || "(not provided)",
          },
        },
        { status: 404 }
      );
    }

    console.log("✅ Matching row found");

    // ============================================================
    // Extract module config
    // ============================================================
    const moduleConfig = {
      moduleName: moduleName, // Return the original name
      moduleId: matchingRow[HARDCODED_INDICES.moduleId] || "",
      clientId: matchingRow[HARDCODED_INDICES.clientId] || "",
      spreadsheetId: matchingRow[HARDCODED_INDICES.spreadsheetId] || "",
      sheetName: matchingRow[HARDCODED_INDICES.sheetName] || "",
      configName: matchingRow[HARDCODED_INDICES.configName] || "",
      archiveFolderId: matchingRow[HARDCODED_INDICES.archiveFolderId] || "",
      enabled: String(matchingRow[HARDCODED_INDICES.enabled] || "").toUpperCase() === "TRUE",
    };

    console.log("📦 Module Config:");
    console.log("   Module Name:", moduleConfig.moduleName);
    console.log("   Module ID:", moduleConfig.moduleId);
    console.log("   Client ID:", moduleConfig.clientId);
    console.log("   Spreadsheet ID:", moduleConfig.spreadsheetId);
    console.log("   Sheet Name:", moduleConfig.sheetName);
    console.log("   Config Name:", moduleConfig.configName);
    console.log("   Archive Folder ID:", moduleConfig.archiveFolderId || "(none)");
    console.log("   Enabled:", moduleConfig.enabled);

    // ============================================================
    // Extract folder ID if it's a URL
    // ============================================================
    if (moduleConfig.archiveFolderId) {
      const trimmed = String(moduleConfig.archiveFolderId).trim();

      // Check if it's a URL
      const urlMatch = trimmed.match(/folders\/([a-zA-Z0-9_-]+)/);
      if (urlMatch && urlMatch[1]) {
        console.log("🔗 Extracted Folder ID from URL:", urlMatch[1]);
        moduleConfig.archiveFolderId = urlMatch[1];
      } else {
        console.log("🆔 Using Folder ID as-is:", trimmed);
      }
    }

    console.log("✅ SUCCESS: Module config loaded");
    console.log("=".repeat(60));

    return NextResponse.json({
      success: true,
      config: moduleConfig,
    });
  } catch (error: any) {
    console.error("❌ ERROR:", error.message);
    return NextResponse.json(
      { error: "Failed to fetch module config", message: error.message },
      { status: 500 }
    );
  }
}