/**
 * Dashboard Data API - PRODUCTION READY ✅
 * Location: app/api/dashboard/data/route.ts
 *
 * GET /api/dashboard/data?spreadsheetId=xxx&configSheetName=yyy&dataSheetName=zzz
 *
 * ✅ NO CACHE (dashboard ต้องการ real-time data)
 * ✅ Retry with exponential backoff
 * ✅ Better error handling with Thai messages
 * ✅ Request tracking
 * ✅ Token expiry check
 * ✅ Optimized parsing
 */
export const maxDuration = 60; // 60 วินาที
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // บังคับใช้ Node.js runtime

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { withLogger } from "@/lib/with-logger";

interface ConfigField {
  fieldName: string;
  label: string;
  type: string;
  order: number;
}

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
        signal: AbortSignal.timeout(20000), // 20 sec timeout (dashboard อาจมีข้อมูลเยอะ)
      });

      if (response.ok || response.status === 404) {
        return response;
      }

      // Retry for 5xx errors, 403 or 429 (rate limit)
      if ((response.status >= 500 || response.status === 403 || response.status === 429) && i < maxRetries) {
        const delay = response.status === 429 ? 2000 * Math.pow(2, i) : 1000 * Math.pow(2, i);
        console.warn(`⚠️ Retry ${i + 1}/${maxRetries} (status ${response.status}) in ${delay}ms`);
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

// ✅ Parse config sheet
function parseConfigSheet(configRows: any[][]): ConfigField[] {
  if (!configRows || configRows.length < 2) {
    throw new Error("Config sheet must have at least header row and one data row");
  }

  const header = configRows[0].map((h) => (h || "").toString().toLowerCase().trim());

  const fieldNameIdx = header.findIndex((h) =>
    h.includes("field") || h === "fieldname" || h === "field_name"
  );
  const labelIdx = header.findIndex((h) =>
    h.includes("label") || h.includes("ชื่อแสดงผล")
  );
  const typeIdx = header.findIndex((h) =>
    h.includes("type") || h.includes("ประเภท")
  );
  const orderIdx = header.findIndex((h) =>
    h.includes("order") || h.includes("ลำดับ")
  );

  if (fieldNameIdx === -1 || labelIdx === -1 || typeIdx === -1) {
    throw new Error("Config sheet missing required columns: field_name, label, type");
  }

  return configRows.slice(1)
    .filter((row) => row[fieldNameIdx]) // ต้องมี field name
    .map((row, idx) => ({
      fieldName: row[fieldNameIdx]?.toString() || `field_${idx}`,
      label: row[labelIdx]?.toString() || "",
      type: row[typeIdx]?.toString() || "text",
      order: orderIdx >= 0 ? Number(row[orderIdx] || idx + 1) : idx + 1,
    }));
}

// ✅ Parse data sheet by column index
function parseDataSheetByColumnIndex(
  dataRows: any[][],
  configFields: ConfigField[]
): any[] {
  if (!dataRows || dataRows.length < 2) return [];

  const dataRowsWithoutHeader = dataRows.slice(1);

  return dataRowsWithoutHeader
    .filter((row) => row.some((cell) => cell !== null && cell !== undefined && cell !== ""))
    .map((row) => {
      const record: any = {};
      configFields.forEach((field) => {
        const colIndex = field.order - 1;
        record[field.fieldName] =
          colIndex >= 0 && colIndex < row.length ? row[colIndex] || "" : "";
      });
      return record;
    });
}

async function _GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);

  try {
    console.log("=".repeat(60));
    console.log(`📊 [${requestId}] DASHBOARD DATA API`);
    console.log("=".repeat(60));

    // ✅ PARSE PARAMS
    const { searchParams } = new URL(request.url);
    const spreadsheetId = searchParams.get("spreadsheetId");
    const configSheetName = searchParams.get("configSheetName");
    const dataSheetName = searchParams.get("dataSheetName");
    const year = searchParams.get("year");
    const archiveSpreadsheetId = searchParams.get("archiveSpreadsheetId");
    const periods = searchParams.getAll("period");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    console.log(`📋 [${requestId}] Params:`, {
      spreadsheetId,
      configSheetName,
      dataSheetName,
      year: year || "Current",
      archiveSpreadsheetId: archiveSpreadsheetId || "None",
    });

    // ✅ VALIDATE PARAMS
    if (!spreadsheetId || !configSheetName || !dataSheetName) {
      return NextResponse.json(
        {
          error: "Missing parameters",
          code: "MISSING_PARAMS",
          message: "spreadsheetId, configSheetName, and dataSheetName are required",
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
        {
          error: "Token หมดอายุ",
          code: "AUTH_REQUIRED",
          message: "เซสชันของคุณหมดอายุ กรุณา Refresh Browser เพื่อเข้าสู่ระบบใหม่",
        },
        { status: 401 }
      );
    }

    // ✅ Check token refresh error
    if ((token as any).error === "RefreshAccessTokenError") {
      return NextResponse.json(
        {
          error: "Token หมดอายุ",
          code: "TOKEN_EXPIRED",
          message: "เซสชันของคุณหมดอายุ กรุณา Refresh Browser เพื่อเข้าสู่ระบบใหม่",
        },
        { status: 401 }
      );
    }

    const accessToken = (token as any)?.accessToken as string;
    if (!accessToken) {
      return NextResponse.json(
        {
          error: "Token หมดอายุ",
          code: "NO_TOKEN",
          message: "เซสชันของคุณหมดอายุ กรุณา Refresh Browser เพื่อเข้าสู่ระบบใหม่",
        },
        { status: 401 }
      );
    }

    const userEmail = (token as any)?.email;
    console.log(`👤 [${requestId}] User: ${userEmail}`);

    // ✅ Check token expiry (additional check)
    const expiresAt = (token as any).expiresAt;
    if (expiresAt && Date.now() > expiresAt) {
      console.error(`❌ [${requestId}] Token expired at:`, new Date(expiresAt));
      return NextResponse.json(
        {
          error: "Token หมดอายุ",
          code: "TOKEN_EXPIRED",
          message: "เซสชันของคุณหมดอายุ กรุณา Refresh Browser เพื่อเข้าสู่ระบบใหม่",
        },
        { status: 401 }
      );
    }

    if (periods.length > 0 || startDate || endDate) {
      console.log(`⚠️ [${requestId}] Filters ignored (handled client-side):`, {
        periods,
        startDate,
        endDate,
      });
    }

    // ============================================================
    // Step 1: Fetch config sheet with retry
    // ============================================================
    console.log(`⏳ [${requestId}] Step 1: Fetching config sheet...`);

    const configUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      configSheetName
    )}!A:K`; // ✅ เพิ่มเป็น K เผื่อมี column เพิ่ม

    let configResponse;
    try {
      configResponse = await fetchWithRetry(configUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (error: any) {
      console.error(`❌ [${requestId}] Config fetch failed:`, error.message);
      return NextResponse.json(
        {
          error: "ไม่สามารถโหลด Config ได้",
          code: "CONFIG_FETCH_ERROR",
          message: error.message,
        },
        { status: 500 }
      );
    }

    if (!configResponse.ok) {
      if (configResponse.status === 401) {
        return NextResponse.json(
          {
            error: "Token หมดอายุ",
            code: "TOKEN_EXPIRED",
            message: "เซสชันของคุณหมดอายุ กรุณา Refresh Browser เพื่อเข้าสู่ระบบใหม่",
          },
          { status: 401 }
        );
      }

      if (configResponse.status === 404) {
        return NextResponse.json(
          {
            error: "ไม่พบ Config Sheet",
            code: "CONFIG_NOT_FOUND",
            message: `ไม่พบ sheet "${configSheetName}"`,
          },
          { status: 404 }
        );
      }

      throw new Error(`Failed to fetch config sheet: ${configResponse.status}`);
    }

    const configData = await configResponse.json();
    const configRows = configData.values as any[][] | undefined;

    if (!configRows || configRows.length === 0) {
      return NextResponse.json(
        {
          error: "Config Sheet ว่างเปล่า",
          code: "EMPTY_CONFIG",
        },
        { status: 404 }
      );
    }

    let configFields: ConfigField[];
    try {
      configFields = parseConfigSheet(configRows);
      console.log(`✅ [${requestId}] Loaded ${configFields.length} config fields`);
    } catch (error: any) {
      console.error(`❌ [${requestId}] Config parse error:`, error.message);
      return NextResponse.json(
        {
          error: "Config Sheet มีรูปแบบไม่ถูกต้อง",
          code: "INVALID_CONFIG",
          message: error.message,
        },
        { status: 400 }
      );
    }

    // ============================================================
    // Step 2: Fetch data sheet with retry
    // ============================================================
    const targetSpreadsheetId = archiveSpreadsheetId || spreadsheetId;
    const sourceType = archiveSpreadsheetId ? `Archive (Year: ${year})` : "Main";

    console.log(`⏳ [${requestId}] Step 2: Fetching data from ${sourceType}...`);

    const dataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${targetSpreadsheetId}/values/${encodeURIComponent(
      dataSheetName
    )}`;

    let dataResponse;
    try {
      dataResponse = await fetchWithRetry(dataUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (error: any) {
      console.error(`❌ [${requestId}] Data fetch failed:`, error.message);
      return NextResponse.json(
        {
          error: "ไม่สามารถโหลดข้อมูลได้",
          code: "DATA_FETCH_ERROR",
          message: error.message,
        },
        { status: 500 }
      );
    }

    if (!dataResponse.ok) {
      if (dataResponse.status === 401) {
        return NextResponse.json(
          {
            error: "Token หมดอายุ",
            code: "TOKEN_EXPIRED",
            message: "เซสชันของคุณหมดอายุ กรุณา Refresh Browser เพื่อเข้าสู่ระบบใหม่",
          },
          { status: 401 }
        );
      }

      if (dataResponse.status === 404) {
        return NextResponse.json(
          {
            error: "ไม่พบ Data Sheet",
            code: "DATA_NOT_FOUND",
            message: `ไม่พบ sheet "${dataSheetName}"${
              archiveSpreadsheetId ? ` ในปี ${year}` : ""
            }`,
          },
          { status: 404 }
        );
      }

      throw new Error(`Failed to fetch data sheet: ${dataResponse.status}`);
    }

    const dataSheetData = await dataResponse.json();
    const dataRows = dataSheetData.values as any[][] | undefined;

    if (!dataRows || dataRows.length === 0) {
      console.warn(`⚠️ [${requestId}] Data sheet is empty`);
      return NextResponse.json({
        config: configFields,
        data: [],
        metadata: {
          source: sourceType,
          year: year || null,
          totalRecords: 0,
          note: "Data sheet is empty",
        },
      });
    }

    // ============================================================
    // Step 3: Parse data
    // ============================================================
    console.log(`⏳ [${requestId}] Step 3: Parsing ${dataRows.length - 1} records...`);

    let parsedData: any[];
    try {
      parsedData = parseDataSheetByColumnIndex(dataRows, configFields);
      console.log(`✅ [${requestId}] Parsed ${parsedData.length} records`);
    } catch (error: any) {
      console.error(`❌ [${requestId}] Parse error:`, error.message);
      return NextResponse.json(
        {
          error: "ไม่สามารถอ่านข้อมูลได้",
          code: "PARSE_ERROR",
          message: error.message,
        },
        { status: 500 }
      );
    }

    // ============================================================
    // Step 4: Return response (NO FILTERING - handled client-side)
    // ============================================================
    const response = {
      success: true,
      config: configFields,
      data: parsedData,
      metadata: {
        source: sourceType,
        year: year || null,
        totalRecords: parsedData.length,
        spreadsheetId: targetSpreadsheetId,
        configSheetName,
        dataSheetName,
        note: "Period and Date filtering handled client-side",
      },
    };

    console.log(`✅ [${requestId}] SUCCESS`);
    console.log(`   Source: ${sourceType}`);
    console.log(`   Records: ${parsedData.length}`);
    console.log("=".repeat(60));

    return NextResponse.json(response);
  } catch (error: any) {
    console.error(`❌ [${requestId}] ERROR:`, error.message);
    console.error(error.stack);

    return NextResponse.json(
      {
        error: "เกิดข้อผิดพลาด",
        code: "INTERNAL_ERROR",
        message: error.message || "ไม่สามารถโหลดข้อมูล Dashboard ได้",
      },
      { status: 500 }
    );
  }
}
export const GET = withLogger("/api/dashboard/data", _GET);
