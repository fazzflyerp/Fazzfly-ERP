/**
 * Module Config API - PRODUCTION READY ✅
 * Location: app/api/module/config/route.ts
 * 
 * GET /api/module/config?spreadsheetId=xxx&configName=yyy
 * 
 * ✅ Cache mechanism (5 min)
 * ✅ Retry with exponential backoff
 * ✅ Better error handling
 * ✅ Request tracking
 * ✅ Token expiry check
 * ✅ Smart hasSection detection
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// ✅ Cache config data (5 minutes)
const configCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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
    console.log("=".repeat(60));
    console.log(`⚙️ [${requestId}] MODULE CONFIG API`);
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

    const userEmail = (token as any)?.email;
    console.log(`👤 [${requestId}] User: ${userEmail}`);

    // ✅ VALIDATE PARAMS
    const searchParams = request.nextUrl.searchParams;
    const spreadsheetId = searchParams.get("spreadsheetId");
    const configName = searchParams.get("configName");

    if (!spreadsheetId || !configName) {
      return NextResponse.json(
        {
          error: "Missing parameters",
          code: "MISSING_PARAMS",
          message: "spreadsheetId and configName are required",
        },
        { status: 400 }
      );
    }

    console.log(`⚙️ [${requestId}] Config: ${configName}`);

    // ✅ CHECK CACHE
    const cacheKey = `${spreadsheetId}:${configName}`;
    const cached = configCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`✅ [${requestId}] Cache hit`);
      return NextResponse.json({
        ...cached.data,
        cached: true,
      });
    }

    // ✅ FETCH CONFIG WITH RETRY
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      configName
    )}!A1:K100`; // ✅ เพิ่มเป็น K เผื่อมี column เพิ่ม

    let response;
    try {
      response = await fetchWithRetry(sheetsUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (error: any) {
      console.error(`❌ [${requestId}] Fetch failed:`, error.message);
      return NextResponse.json(
        {
          error: "Failed to fetch config",
          code: "FETCH_ERROR",
          message: error.message,
        },
        { status: 500 }
      );
    }

    // ✅ HANDLE NOT FOUND
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

      if (response.status === 404) {
        console.error(`❌ [${requestId}] Config not found: ${configName}`);
        return NextResponse.json(
          {
            error: "Config not found",
            code: "CONFIG_NOT_FOUND",
            message: `Config sheet "${configName}" not found`,
          },
          { status: 404 }
        );
      }

      const errorText = await response.text();
      console.error(`❌ [${requestId}] Error:`, errorText);
      return NextResponse.json(
        {
          error: "Failed to fetch config",
          code: "FETCH_ERROR",
          details: errorText,
        },
        { status: 500 }
      );
    }

    // ✅ PARSE DATA
    const data = await response.json();
    const rows: string[][] = Array.isArray(data.values) ? data.values : [];

    if (rows.length === 0) {
      console.error(`❌ [${requestId}] Config sheet is empty`);
      return NextResponse.json(
        {
          error: "Config sheet is empty",
          code: "EMPTY_CONFIG",
        },
        { status: 404 }
      );
    }

    // ✅ PARSE HEADERS
    const headerRow = Array.isArray(rows[0]) ? rows[0] : [];
    const headers: string[] = headerRow.map((h) =>
      (h ?? "").toString().toLowerCase().trim()
    );

    console.log(`📋 [${requestId}] Headers found:`, headers);

    const findHeader = (names: string[]) =>
      headers.findIndex((h) => names.includes(h));

    const fieldNameIdx = findHeader(["field_name", "field", "fieldname"]);
    const labelIdx = findHeader(["label", "ชื่อแสดงผล", "name"]);
    const typeIdx = findHeader(["type", "ประเภท"]);
    const requiredIdx = findHeader(["required", "บังคับ"]);
    const helperIdx = findHeader(["helper", "options"]);
    const orderIdx = findHeader(["order", "ลำดับ"]);
    const placeholderIdx = findHeader(["placeholder"]);
    const validationIdx = findHeader(["validation"]);
    const sectionIdx = findHeader(["section", "section_name"]);
    const repeatableIdx = findHeader(["repeatable"]);
    const notesIdx = findHeader(["notes", "หมายเหตุ"]);

    console.log(`🔑 [${requestId}] Column indices:`, {
      fieldName: fieldNameIdx,
      label: labelIdx,
      type: typeIdx,
      section: sectionIdx,
      repeatable: repeatableIdx,
    });

    // ✅ VALIDATE REQUIRED COLUMNS
    if (fieldNameIdx === -1 || labelIdx === -1 || typeIdx === -1) {
      console.error(`❌ [${requestId}] Invalid config structure`);
      return NextResponse.json(
        {
          error: "Invalid config sheet structure",
          code: "INVALID_STRUCTURE",
          expected: "At least: field_name, label, type",
          found: headers,
          hint: "Required columns: field_name, label, type. Optional: required, helper, order, section, repeatable, notes",
        },
        { status: 400 }
      );
    }

    // ✅ PARSE FIELDS
    const fields = rows
      .slice(1)
      .filter((row) => row[fieldNameIdx]) // ต้องมี fieldName
      .map((row, idx) => {
        const section =
          sectionIdx >= 0 ? row[sectionIdx]?.toString().trim() || "" : "";
        const repeatable =
          repeatableIdx >= 0
            ? row[repeatableIdx]?.toString().toUpperCase() === "TRUE"
            : false;

        return {
          fieldName: row[fieldNameIdx]?.toString() || `field_${idx}`,
          label: row[labelIdx]?.toString() || "",
          type: row[typeIdx]?.toString() || "text",
          required:
            requiredIdx >= 0
              ? row[requiredIdx]?.toString().toUpperCase() === "TRUE"
              : false,
          helper: helperIdx >= 0 ? row[helperIdx]?.toString() || null : null,
          order:
            orderIdx >= 0
              ? parseInt(row[orderIdx]?.toString() || "") || idx + 1
              : idx + 1,
          placeholder:
            placeholderIdx >= 0 ? row[placeholderIdx]?.toString() || "" : "",
          validation:
            validationIdx >= 0 ? row[validationIdx]?.toString() || null : null,
          section: section || undefined,
          repeatable: repeatable,
          notes: notesIdx >= 0 ? row[notesIdx]?.toString() || "" : "",
        };
      });

    console.log(`📝 [${requestId}] Fields parsed: ${fields.length}`);

    // ✅ SMART SECTION DETECTION
    const hasSection = fields.some((f) => f.section && f.section.length > 0);

    console.log(`📋 [${requestId}] Section Detection:`, {
      hasSection,
      sectionsFound: hasSection
        ? [...new Set(fields.filter((f) => f.section).map((f) => f.section))]
        : [],
    });

    // ✅ VALIDATE FIELD TYPES
    const validTypes = [
      "text",
      "number",
      "date",
      "select",
      "textarea",
      "checkbox",
      "radio",
      "email",
      "tel",
      "url",
    ];

    const invalidFields = fields.filter(
      (f) => !validTypes.includes(f.type.toLowerCase())
    );

    if (invalidFields.length > 0) {
      console.warn(`⚠️ [${requestId}] Invalid field types:`, invalidFields);
    }

    const result = {
      success: true,
      spreadsheetId,
      configName,
      fields,
      totalFields: fields.length,
      hasSection,
      sections: hasSection
        ? [...new Set(fields.filter((f) => f.section).map((f) => f.section))]
        : [],
      warnings: invalidFields.length > 0 ? {
        invalidFieldTypes: invalidFields.map(f => ({
          fieldName: f.fieldName,
          type: f.type,
          validTypes
        }))
      } : undefined,
    };

    // ✅ CACHE RESULT
    configCache.set(cacheKey, { data: result, timestamp: Date.now() });

    console.log(`✅ [${requestId}] Config loaded successfully`);
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

// ✅ BACKGROUND TASK: Clear expired cache every 10 minutes
setInterval(() => {
  const now = Date.now();
  let cleared = 0;

  for (const [key, value] of configCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      configCache.delete(key);
      cleared++;
    }
  }

  if (cleared > 0) {
    console.log(`🧹 Cleared ${cleared} expired config cache entries`);
  }
}, 10 * 60 * 1000);