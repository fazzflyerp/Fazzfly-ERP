/**
 * Helper/Dropdown Options API - PRODUCTION READY ✅
 * Location: app/api/module/helpers/route.ts
 * 
 * GET /api/module/helpers?spreadsheetId=xxx&helperName=yyy
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// ✅ 1. เพิ่ม cache เพื่อลด API calls
const helperCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// ✅ 2. เพิ่ม retry mechanism
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2
): Promise<Response> {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(10000), // 10 sec timeout
      });

      if (response.ok || response.status === 404) {
        return response;
      }

      // Retry for 5xx errors
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
    console.log(`📥 [${requestId}] Fetching helper options...`);

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

    const accessToken = (token as any)?.accessToken;
    if (!accessToken) {
      return NextResponse.json(
        { error: "No access token", code: "NO_TOKEN" },
        { status: 401 }
      );
    }

    // ✅ VALIDATE PARAMS
    const searchParams = request.nextUrl.searchParams;
    const spreadsheetId = searchParams.get("spreadsheetId");
    const helperName = searchParams.get("helperName");

    if (!spreadsheetId || !helperName) {
      return NextResponse.json(
        {
          error: "Missing parameters",
          code: "MISSING_PARAMS",
          message: "spreadsheetId and helperName are required",
        },
        { status: 400 }
      );
    }

    console.log(`📋 [${requestId}] Helper: ${helperName}`);

    // ✅ 3. CHECK CACHE
    const cacheKey = `${spreadsheetId}:${helperName}`;
    const cached = helperCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`✅ [${requestId}] Cache hit`);
      return NextResponse.json({
        ...cached.data,
        cached: true,
      });
    }

    // ✅ 4. FETCH FROM GOOGLE SHEETS WITH RETRY
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      helperName
    )}!A:C`;

    let response;
    try {
      response = await fetchWithRetry(sheetsUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (error: any) {
      console.error(`❌ [${requestId}] Fetch failed:`, error.message);
      return NextResponse.json(
        {
          error: "Failed to fetch helper data",
          code: "FETCH_ERROR",
          message: error.message,
        },
        { status: 500 }
      );
    }

    // ✅ 5. HANDLE NOT FOUND
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

      console.warn(`⚠️ [${requestId}] Helper sheet not found: ${helperName}`);
      
      const result = {
        success: true,
        helperName,
        options: [],
        totalOptions: 0,
        warning: `Helper sheet "${helperName}" not found`,
      };

      // Cache empty result
      helperCache.set(cacheKey, { data: result, timestamp: Date.now() });

      return NextResponse.json(result);
    }

    // ✅ 6. PARSE DATA
    const data = await response.json();
    const rows = data.values || [];

    if (rows.length === 0) {
      console.warn(`⚠️ [${requestId}] Helper sheet is empty: ${helperName}`);
      
      const result = {
        success: true,
        helperName,
        options: [],
        totalOptions: 0,
        warning: `Helper sheet "${helperName}" is empty`,
      };

      // Cache empty result
      helperCache.set(cacheKey, { data: result, timestamp: Date.now() });

      return NextResponse.json(result);
    }

    // Skip header row
    const dataRows = rows.slice(1);

    const options = dataRows
      .filter((row: any[]) => row[0]) // ต้องมี value
      .map((row: any[]) => {
        const value = row[0]?.toString() || "";
        const name = row[1]?.toString() || "";
        const detail = row[2]?.toString() || "";
        
        return {
          value,
          label: detail ? `${name} - ${detail}` : name, // ✅ ถ้าไม่มี detail ใช้แค่ name
        };
      });

    console.log(`✅ [${requestId}] Loaded ${options.length} options`);

    const result = {
      success: true,
      helperName,
      options,
      totalOptions: options.length,
    };

    // ✅ 7. CACHE RESULT
    helperCache.set(cacheKey, { data: result, timestamp: Date.now() });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`❌ [${requestId}] ERROR:`, error.message);
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

// ✅ 8. BACKGROUND TASK: Clear expired cache every 10 minutes
setInterval(() => {
  const now = Date.now();
  let cleared = 0;

  for (const [key, value] of helperCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      helperCache.delete(key);
      cleared++;
    }
  }

  if (cleared > 0) {
    console.log(`🧹 Cleared ${cleared} expired helper cache entries`);
  }
}, 10 * 60 * 1000);