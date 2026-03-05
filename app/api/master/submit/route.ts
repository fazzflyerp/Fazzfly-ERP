/**
 * Master Data Submit API - PRODUCTION READY ✅
 * Location: app/api/master/submit/route.ts
 * 
 * POST /api/master/submit
 * Body: { spreadsheetId, sheetName, rowData }
 * 
 * ✅ เพิ่มข้อมูลเข้า Master sheet
 * ✅ Auto-retry mechanism
 * ✅ Token expiry handling
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

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

      if (response.ok) {
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

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);

  try {
    console.log("=".repeat(60));
    console.log(`💾 [${requestId}] MASTER DATA SUBMIT`);
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

    // ✅ PARSE BODY
    const body = await request.json();
    const { spreadsheetId, sheetName, rowData } = body;

    if (!spreadsheetId || !sheetName || !rowData) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          code: "MISSING_FIELDS",
          message: "spreadsheetId, sheetName, and rowData are required",
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(rowData)) {
      return NextResponse.json(
        {
          error: "Invalid rowData format",
          code: "INVALID_FORMAT",
          message: "rowData must be an array",
        },
        { status: 400 }
      );
    }

    console.log(`📊 [${requestId}] Sheet: ${sheetName}`);
    console.log(`📋 [${requestId}] Columns: ${rowData.length}`);

    // ✅ APPEND ROW TO GOOGLE SHEETS
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      sheetName
    )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const appendBody = {
      values: [rowData],
    };

    console.log(`⏳ [${requestId}] Appending data...`);

    let response;
    try {
      response = await fetchWithRetry(appendUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(appendBody),
      });
    } catch (error: any) {
      console.error(`❌ [${requestId}] Append failed:`, error.message);
      return NextResponse.json(
        {
          error: "Failed to save data",
          code: "APPEND_ERROR",
          message: error.message,
        },
        { status: 500 }
      );
    }

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

      const errorText = await response.text();
      console.error(`❌ [${requestId}] Google Sheets error:`, errorText);

      return NextResponse.json(
        {
          error: "Failed to save data",
          code: "SHEETS_ERROR",
          details: errorText,
        },
        { status: 500 }
      );
    }

    const result = await response.json();

    console.log(`✅ [${requestId}] Data saved successfully`);
    console.log(`   Updated range: ${result.updates?.updatedRange || "N/A"}`);
    console.log("=".repeat(60));

    return NextResponse.json({
      success: true,
      message: "Data saved successfully",
      updatedRange: result.updates?.updatedRange,
      updatedRows: result.updates?.updatedRows || 1,
    });
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