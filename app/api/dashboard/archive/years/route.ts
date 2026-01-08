/**
 * Years API - PRODUCTION READY ✅
 * Location: app/api/dashboard/years/route.ts
 * 
 * GET /api/dashboard/years?archiveFolderId=xxx&moduleName=yyy
 * 
 * ✅ Cache mechanism (10 min - archive ไม่ค่อยเปลี่ยน)
 * ✅ Retry with exponential backoff
 * ✅ Better error handling
 * ✅ Request tracking
 * ✅ Token expiry check
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export const dynamic = 'force-dynamic';

// ✅ Cache years data (10 minutes - archive folders เปลี่ยนไม่บ่อย)
const yearsCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

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
        signal: AbortSignal.timeout(15000), // 15 sec timeout (Drive API อาจช้า)
      });

      if (response.ok || response.status === 404) {
        return response;
      }

      // Retry for 5xx errors or 403 (rate limit)
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
    console.log(`📅 [${requestId}] YEARS API`);
    console.log("=".repeat(60));

    // ✅ PARSE PARAMS
    const { searchParams } = new URL(request.url);
    const archiveFolderId = searchParams.get("archiveFolderId");
    const moduleName = searchParams.get("moduleName");

    console.log(`📦 [${requestId}] Params:`, { archiveFolderId, moduleName });

    // ✅ VALIDATE PARAMS
    if (!archiveFolderId) {
      return NextResponse.json(
        {
          error: "Missing parameter",
          code: "MISSING_PARAMS",
          message: "archiveFolderId is required",
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
    const cacheKey = `${archiveFolderId}:${moduleName || 'all'}`;
    const cached = yearsCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`✅ [${requestId}] Cache hit`);
      return NextResponse.json({
        ...cached.data,
        cached: true,
      });
    }

    // ✅ FETCH FROM GOOGLE DRIVE WITH RETRY
    console.log(`⏳ [${requestId}] Fetching from Google Drive...`);

    const driveUrl = `https://www.googleapis.com/drive/v3/files?q='${archiveFolderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,createdTime,modifiedTime)&orderBy=name desc`;

    let driveResponse;
    try {
      driveResponse = await fetchWithRetry(driveUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (error: any) {
      console.error(`❌ [${requestId}] Fetch failed:`, error.message);
      return NextResponse.json(
        {
          error: "Failed to fetch from Google Drive",
          code: "DRIVE_ERROR",
          message: error.message,
        },
        { status: 500 }
      );
    }

    // ✅ HANDLE ERRORS
    if (!driveResponse.ok) {
      if (driveResponse.status === 401) {
        return NextResponse.json(
          {
            error: "Session expired",
            code: "TOKEN_EXPIRED",
            message: "Please sign out and sign in again",
          },
          { status: 401 }
        );
      }

      if (driveResponse.status === 403) {
        return NextResponse.json(
          {
            error: "Permission denied",
            code: "PERMISSION_DENIED",
            message: "No access to this Google Drive folder",
          },
          { status: 403 }
        );
      }

      if (driveResponse.status === 404) {
        console.warn(`⚠️ [${requestId}] Folder not found: ${archiveFolderId}`);
        return NextResponse.json(
          {
            error: "Folder not found",
            code: "FOLDER_NOT_FOUND",
            message: "Archive folder not found in Google Drive",
          },
          { status: 404 }
        );
      }

      throw new Error(`Drive API failed: ${driveResponse.status}`);
    }

    const driveData = await driveResponse.json();
    const files = driveData.files || [];

    console.log(`📂 [${requestId}] Found ${files.length} files in folder`);

    // ✅ PARSE YEARS FROM FILENAMES
    const years: any[] = [];
    
    // ✅ รองรับหลาย pattern
    const yearPatterns = [
      /Archive[_\s]+(\d{4})/i,           // Archive_2024, Archive 2024
      /(\d{4})[_\s]+Archive/i,           // 2024_Archive, 2024 Archive
      /^(\d{4})$/,                        // 2024
      /[_\s-](\d{4})[_\s-]/,             // Sales_2024_Data
    ];

    files.forEach((file: any) => {
      // ✅ เฉพาะ Google Sheets
      if (file.mimeType !== "application/vnd.google-apps.spreadsheet") {
        return;
      }

      let year: string | null = null;

      // ลอง match ทุก pattern
      for (const pattern of yearPatterns) {
        const match = file.name.match(pattern);
        if (match) {
          year = match[1];
          break;
        }
      }

      if (year) {
        // ✅ Validate year (1900-2100)
        const yearNum = parseInt(year);
        if (yearNum >= 1900 && yearNum <= 2100) {
          years.push({
            year,
            spreadsheetId: file.id,
            fileName: file.name,
            createdTime: file.createdTime,
            modifiedTime: file.modifiedTime,
          });
        } else {
          console.warn(`⚠️ [${requestId}] Invalid year: ${year} in file: ${file.name}`);
        }
      }
    });

    // ✅ ลบ duplicate years (เอาไฟล์ล่าสุด)
    const uniqueYears = new Map<string, any>();
    years.forEach(item => {
      const existing = uniqueYears.get(item.year);
      if (!existing || item.modifiedTime > existing.modifiedTime) {
        uniqueYears.set(item.year, item);
      }
    });

    // ✅ Sort: ปีล่าสุดขึ้นก่อน
    const sortedYears = Array.from(uniqueYears.values()).sort(
      (a, b) => parseInt(b.year) - parseInt(a.year)
    );

    console.log(`📅 [${requestId}] Found years:`, sortedYears.map(y => y.year));

    // ✅ PREPARE RESULT
    const result = {
      success: true,
      years: sortedYears,
      totalYears: sortedYears.length,
      archiveFolderId,
      moduleName: moduleName || null,
    };

    // ✅ CACHE RESULT
    yearsCache.set(cacheKey, { data: result, timestamp: Date.now() });

    console.log(`✅ [${requestId}] Years loaded successfully`);
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

// ✅ BACKGROUND TASK: Clear expired cache every 15 minutes
setInterval(() => {
  const now = Date.now();
  let cleared = 0;

  for (const [key, value] of yearsCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      yearsCache.delete(key);
      cleared++;
    }
  }

  if (cleared > 0) {
    console.log(`🧹 Cleared ${cleared} expired years cache entries`);
  }
}, 15 * 60 * 1000);