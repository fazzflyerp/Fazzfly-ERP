/**
 * Archive Folder ID API - PRODUCTION READY ✅
 * Location: app/api/dashboard/archive-folder-id/route.ts
 * 
 * GET /api/dashboard/archive-folder-id?clientId=xxx&moduleName=yyy
 * 
 * ✅ Cache mechanism (15 min - ไม่ค่อยเปลี่ยน)
 * ✅ Retry with exponential backoff
 * ✅ Better error handling
 * ✅ Request tracking
 * ✅ Token expiry check
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const MASTER_CONFIG_ID = process.env.MASTER_SHEET_ID || "1j7LguHaX8pIvvQ1PqqenuguOsPT1QthJqXJyMYW2xo8";
const SHEET_NAME = "client_dashboard";

// ✅ Cache (15 minutes - archive folder IDs ไม่ค่อยเปลี่ยน)
const folderCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

// ✅ Retry helper
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2
): Promise<Response> {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(15000), // 15 sec timeout
      });

      if (response.ok || response.status === 404) {
        return response;
      }

      if ((response.status >= 500 || response.status === 403) && i < maxRetries) {
        const delay = 1000 * Math.pow(2, i);
        console.warn(`⚠️ Retry ${i + 1}/${maxRetries} in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      return response;
    } catch (error: any) {
      if (error.name === "TimeoutError" || i === maxRetries) {
        throw error;
      }
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw new Error("Max retries exceeded");
}

export async function GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);

  try {
    console.log("=".repeat(60));
    console.log(`📁 [${requestId}] ARCHIVE FOLDER ID API`);
    console.log("=".repeat(60));

    // ✅ PARSE PARAMS
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const moduleName = searchParams.get("moduleName");

    console.log(`📋 [${requestId}] Params:`, { clientId, moduleName });

    // ✅ VALIDATE PARAMS
    if (!clientId || !moduleName) {
      return NextResponse.json(
        {
          error: "Missing parameters",
          code: "MISSING_PARAMS",
          message: "clientId and moduleName are required",
          required: ["clientId", "moduleName"],
          received: { clientId, moduleName },
        },
        { status: 400 }
      );
    }

    // ✅ AUTH
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

    // ✅ Check token refresh error
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

    const accessToken = token.accessToken as string;
    if (!accessToken) {
      return NextResponse.json(
        { error: "No access token", code: "NO_TOKEN" },
        { status: 401 }
      );
    }

    const userEmail = (token as any)?.email;
    console.log(`👤 [${requestId}] User: ${userEmail}`);

    // ✅ CHECK CACHE
    const cacheKey = `${clientId}:${moduleName}`;
    const cached = folderCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`✅ [${requestId}] Cache hit`);
      return NextResponse.json({
        ...cached.data,
        cached: true,
      });
    }

    // ✅ FETCH FROM GOOGLE SHEETS WITH RETRY
    console.log(`⏳ [${requestId}] Fetching from Google Sheets...`);

    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${MASTER_CONFIG_ID}/values/${SHEET_NAME}`;

    let response;
    try {
      response = await fetchWithRetry(sheetsUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });
    } catch (error: any) {
      console.error(`❌ [${requestId}] Fetch failed:`, error.message);
      return NextResponse.json(
        {
          error: "Failed to fetch configuration",
          code: "FETCH_ERROR",
          message: error.message,
        },
        { status: 500 }
      );
    }

    // ✅ HANDLE ERRORS
    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json(
          {
            error: "Session expired",
            code: "TOKEN_EXPIRED",
            message: "Please sign out and sign in again",
          },
          { status: 401 }
        );
      }

      if (response.status === 403) {
        return NextResponse.json(
          {
            error: "Permission denied",
            code: "PERMISSION_DENIED",
            message: "No access to master configuration sheet",
          },
          { status: 403 }
        );
      }

      const errorText = await response.text();
      console.error(`❌ [${requestId}] Sheets API Error:`, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    if (!data.values || data.values.length === 0) {
      console.warn(`⚠️ [${requestId}] No data found in sheet`);
      return NextResponse.json(
        {
          error: "No data in configuration sheet",
          code: "EMPTY_SHEET",
        },
        { status: 404 }
      );
    }

    const [headers, ...rows] = data.values;

    console.log(`📊 [${requestId}] Sheet: ${rows.length} rows`);

    // ✅ Column indices — client_dashboard sheet
    // A:module_id B:client_id C:module_name D:spreadsheet_id E:sheet_name
    // F:config_name G:is_active H:notes I:archive_folder_id
    const COLS = {
      moduleId: 0,
      clientId: 1,
      moduleName: 2,
      spreadsheetId: 3,
      sheetName: 4,
      configName: 5,
      isActive: 6,
      notes: 7,
      archiveFolderId: 8, // ✅ Column I
    };

    console.log(`🔎 [${requestId}] Searching: clientId="${clientId}", moduleName="${moduleName}"`);

    // ✅ FIND MATCHING ROW
    const matchingRow = rows.find((row: any[]) => {
      const rowClientId = String(row[COLS.clientId] || "").trim();
      const rowModuleName = String(row[COLS.moduleName] || "").trim();
      const rowIsActive = String(row[COLS.isActive] || "").trim().toUpperCase();

      const clientMatch = rowClientId === clientId;
      const nameMatch = rowModuleName.toLowerCase() === moduleName.toLowerCase();

      // ✅ Flexible is_active check
      const activeMatch =
        rowIsActive === "TRUE" ||
        rowIsActive === "YES" ||
        rowIsActive === "1" ||
        (rowIsActive !== "FALSE" && rowIsActive !== "NO" && rowIsActive !== "0" && rowIsActive !== "");

      return clientMatch && nameMatch && activeMatch;
    });

    if (!matchingRow) {
      console.warn(`⚠️ [${requestId}] No matching row found`);

      // ✅ Show available options for debugging
      const availableModules = rows
        .filter((row: any[]) => row[COLS.clientId] === clientId)
        .map((row: any[]) => ({
          moduleName: row[COLS.moduleName],
          isActive: row[COLS.isActive],
        }));

      return NextResponse.json(
        {
          error: "Configuration not found",
          code: "CONFIG_NOT_FOUND",
          message: `No active configuration found for client "${clientId}" and module "${moduleName}"`,
          searchedFor: { clientId, moduleName },
          availableModules: availableModules.length > 0 ? availableModules : undefined,
          hint: "Check if module is active (is_active = TRUE/YES)",
        },
        { status: 404 }
      );
    }

    console.log(`✅ [${requestId}] Matching row found`);

    // ✅ EXTRACT ARCHIVE FOLDER ID
    let archiveFolderId = String(matchingRow[COLS.archiveFolderId] || "").trim();

    if (!archiveFolderId || archiveFolderId === "undefined") {
      console.warn(`⚠️ [${requestId}] archive_folder_id is empty`);

      return NextResponse.json(
        {
          error: "Archive folder not configured",
          code: "NO_ARCHIVE_FOLDER",
          message: "Archive folder ID is not set in configuration",
          row: {
            client_id: matchingRow[COLS.clientId],
            module_name: matchingRow[COLS.moduleName],
            is_active: matchingRow[COLS.isActive],
          },
          hint: "Please add archive folder ID in client_dashboard Sheet Column I",
        },
        { status: 404 }
      );
    }

    // ✅ Extract folder ID from URL (if it's a full URL)
    const urlMatch = archiveFolderId.match(/folders\/([a-zA-Z0-9_-]+)/);
    if (urlMatch && urlMatch[1]) {
      console.log(`🔗 [${requestId}] Extracted folder ID from URL`);
      archiveFolderId = urlMatch[1];
    }

    console.log(`📁 [${requestId}] Archive folder: ${archiveFolderId}`);

    // ✅ PREPARE RESULT
    const result = {
      success: true,
      archiveFolderId,
      clientId,
      moduleName,
      metadata: {
        source: SHEET_NAME,
        spreadsheetId: MASTER_CONFIG_ID,
        moduleId: matchingRow[COLS.moduleId],
      },
    };

    // ✅ CACHE RESULT
    folderCache.set(cacheKey, { data: result, timestamp: Date.now() });

    console.log(`✅ [${requestId}] Success!`);
    console.log("=".repeat(60));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`❌ [${requestId}] ERROR:`, error.message);
    console.error(error.stack);

    return NextResponse.json(
      {
        error: "Internal server error",
        code: "INTERNAL_ERROR",
        message: error.message,
      },
      { status: 500 }
    );
  }
}

// ✅ BACKGROUND TASK: Clear expired cache every 20 minutes
setInterval(() => {
  const now = Date.now();
  let cleared = 0;

  for (const [key, value] of folderCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      folderCache.delete(key);
      cleared++;
    }
  }

  if (cleared > 0) {
    console.log(`🧹 Cleared ${cleared} expired folder cache entries`);
  }
}, 20 * 60 * 1000);