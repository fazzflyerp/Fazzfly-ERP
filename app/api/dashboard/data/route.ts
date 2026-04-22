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
import { saReadRange } from "@/lib/google-sa";
import { verifySheetAccess } from "@/lib/verify-sheet-access";

interface ConfigField {
  fieldName: string;
  label: string;
  type: string;
  order: number;
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

    const userEmail = ((token as any)?.email as string || "").toLowerCase();

    const access = await verifySheetAccess(userEmail, spreadsheetId!);
    if (!access.allowed)
      return NextResponse.json({ error: "Forbidden: sheet not owned by your client", code: "FORBIDDEN" }, { status: 403 });

    if (periods.length > 0 || startDate || endDate) {
      console.log(`⚠️ [${requestId}] Filters ignored (handled client-side):`, {
        periods,
        startDate,
        endDate,
      });
    }

    // ============================================================
    // Step 1+2: Fetch config + data in parallel
    // ============================================================
    const targetSpreadsheetId = archiveSpreadsheetId || spreadsheetId;
    const sourceType = archiveSpreadsheetId ? `Archive (Year: ${year})` : "Main";

    let configRows: any[][] | undefined;
    let dataRows: any[][] | undefined;

    try {
      [configRows, dataRows] = await Promise.all([
        saReadRange(spreadsheetId, `${configSheetName}!A:K`),
        saReadRange(targetSpreadsheetId, dataSheetName),
      ]);
    } catch (error: any) {
      console.error(`❌ [${requestId}] Fetch failed:`, error.message);
      return NextResponse.json(
        { error: "ไม่สามารถโหลดข้อมูลได้", code: "FETCH_ERROR", message: error.message },
        { status: 500 }
      );
    }

    if (!configRows || configRows.length === 0) {
      return NextResponse.json(
        { error: "Config Sheet ว่างเปล่า", code: "EMPTY_CONFIG" },
        { status: 404 }
      );
    }

    let configFields: ConfigField[];
    try {
      configFields = parseConfigSheet(configRows);
    } catch (error: any) {
      return NextResponse.json(
        { error: "Config Sheet มีรูปแบบไม่ถูกต้อง", code: "INVALID_CONFIG", message: error.message },
        { status: 400 }
      );
    }

    if (!dataRows || dataRows.length === 0) {
      return NextResponse.json({
        config: configFields,
        data: [],
        metadata: { source: sourceType, year: year || null, totalRecords: 0, note: "Data sheet is empty" },
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
