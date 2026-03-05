/**
 * Master Databases API - PRODUCTION READY ✅
 * Location: app/api/master/databases/route.ts
 * 
 * GET /api/master/databases
 * 
 * ✅ ดึงรายการ Master databases จาก client_db sheet
 * ✅ กรองตาม client_id ของ user
 * ✅ Retry และ cache mechanism
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const MASTER_SHEET_ID = process.env.MASTER_SHEET_ID;

// ✅ Cache (5 minutes)
const dbCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000;

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
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok || response.status === 404) {
        return response;
      }

      if (response.status >= 500 && i < maxRetries) {
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
    console.log(`📊 [${requestId}] MASTER DATABASES API`);
    console.log("=".repeat(60));

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
    const userEmail = (token as any)?.email;

    if (!accessToken) {
      return NextResponse.json(
        { error: "No access token", code: "NO_TOKEN" },
        { status: 401 }
      );
    }

    console.log(`👤 [${requestId}] User: ${userEmail}`);

    if (!MASTER_SHEET_ID) {
      return NextResponse.json(
        { error: "Master sheet not configured", code: "CONFIG_ERROR" },
        { status: 500 }
      );
    }

    // ✅ GET CLIENT_ID from client_master
    console.log(`⏳ [${requestId}] Fetching client info...`);

    const masterUrl = `https://sheets.googleapis.com/v4/spreadsheets/${MASTER_SHEET_ID}/values/client_master!A:H`;

    let masterResponse;
    try {
      masterResponse = await fetchWithRetry(masterUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (error: any) {
      console.error(`❌ [${requestId}] Master fetch failed:`, error.message);
      return NextResponse.json(
        {
          error: "Failed to fetch client data",
          code: "FETCH_ERROR",
          message: error.message,
        },
        { status: 500 }
      );
    }

    if (!masterResponse.ok) {
      if (masterResponse.status === 401) {
        return NextResponse.json(
          {
            error: "Session expired",
            code: "TOKEN_EXPIRED",
            message: "Please sign out and sign in again",
          },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: "Failed to fetch client data", code: "FETCH_ERROR" },
        { status: 500 }
      );
    }

    const masterData = await masterResponse.json();
    const masterRows = masterData.values || [];

    const clientRow = masterRows.find((row: any[], idx: number) => {
      if (idx === 0) return false;
      const email = row[2]?.toString().toLowerCase() || "";
      return email === userEmail.toLowerCase();
    });

    if (!clientRow) {
      return NextResponse.json(
        { error: "Client not found", code: "CLIENT_NOT_FOUND" },
        { status: 404 }
      );
    }

    const clientId = clientRow[0]?.toString() || "";
    console.log(`✅ [${requestId}] Client ID: ${clientId}`);

    // ✅ CHECK CACHE
    const cacheKey = `db:${clientId}`;
    const cached = dbCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`✅ [${requestId}] Cache hit`);
      return NextResponse.json({
        ...cached.data,
        cached: true,
      });
    }

    // ✅ FETCH client_db
    console.log(`⏳ [${requestId}] Fetching client_db...`);

    const dbUrl = `https://sheets.googleapis.com/v4/spreadsheets/${MASTER_SHEET_ID}/values/client_db!A:E`;

    let dbResponse;
    try {
      dbResponse = await fetchWithRetry(dbUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (error: any) {
      console.error(`❌ [${requestId}] DB fetch failed:`, error.message);
      return NextResponse.json(
        {
          error: "Failed to fetch database list",
          code: "FETCH_ERROR",
          message: error.message,
        },
        { status: 500 }
      );
    }

    if (!dbResponse.ok) {
      if (dbResponse.status === 401) {
        return NextResponse.json(
          {
            error: "Session expired",
            code: "TOKEN_EXPIRED",
            message: "Please sign out and sign in again",
          },
          { status: 401 }
        );
      }

      return NextResponse.json(
        {
          error: "Failed to fetch database list",
          code: "FETCH_ERROR",
        },
        { status: 500 }
      );
    }

    const dbData = await dbResponse.json();
    const dbRows = dbData.values || [];

    if (dbRows.length === 0) {
      console.warn(`⚠️ [${requestId}] client_db sheet is empty`);
      
      const result = {
        success: true,
        databases: [],
        totalDatabases: 0,
      };

      dbCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return NextResponse.json(result);
    }

    // ✅ PARSE & FILTER DATABASES
    const databases = dbRows
      .slice(1) // Skip header
      .filter((row: any[]) => {
        const dbClientId = row[1]?.toString() || "";
        const sheetName = row[2]?.toString() || "";
        const configName = row[4]?.toString() || "";
        
        return (
          dbClientId === clientId &&
          sheetName.trim() !== "" &&
          configName.trim() !== ""
        );
      })
      .map((row: any[]) => {
        // ✅ Clean spreadsheetId - ลบ /edit?gid=... ออก
        let spreadsheetId = row[3]?.toString() || "";
        if (spreadsheetId.includes("/edit")) {
          spreadsheetId = spreadsheetId.split("/edit")[0];
        }
        if (spreadsheetId.includes("?")) {
          spreadsheetId = spreadsheetId.split("?")[0];
        }

        return {
          databaseId: row[0]?.toString() || "",
          clientId: row[1]?.toString() || "",
          sheetName: row[2]?.toString() || "",
          spreadsheetId: spreadsheetId,  // ← ใช้ cleaned version
          configName: row[4]?.toString() || "",
        };
      });

    console.log(`✅ [${requestId}] Found ${databases.length} databases`);

    const result = {
      success: true,
      databases,
      totalDatabases: databases.length,
    };

    // ✅ CACHE RESULT
    dbCache.set(cacheKey, { data: result, timestamp: Date.now() });

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

// ✅ Clear cache every 10 minutes
setInterval(() => {
  const now = Date.now();
  let cleared = 0;

  for (const [key, value] of dbCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      dbCache.delete(key);
      cleared++;
    }
  }

  if (cleared > 0) {
    console.log(`🧹 Cleared ${cleared} expired database cache entries`);
  }
}, 10 * 60 * 1000);