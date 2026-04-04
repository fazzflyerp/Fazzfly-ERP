/**
 * Module Config API
 * Location: app/api/module/config/route.ts
 * 
 * ✅ No in-memory cache (Vercel serverless = multiple instances)
 * ✅ ใช้ HTTP Cache-Control แทน
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { withLogger } from "@/lib/with-logger";

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
      if (response.ok || response.status === 404) return response;
      if (response.status >= 500 && i < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
        continue;
      }
      return response;
    } catch (error: any) {
      if (error.name === "TimeoutError" || i === maxRetries) throw error;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw new Error("Max retries exceeded");
}

async function _GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);

  try {
    console.log(`⚙️ [${requestId}] MODULE CONFIG API`);

    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
    if ((token as any).error === "RefreshAccessTokenError")
      return NextResponse.json({ error: "Session expired", code: "TOKEN_EXPIRED" }, { status: 401 });

    const accessToken = (token as any)?.accessToken;
    if (!accessToken) return NextResponse.json({ error: "No access token", code: "NO_TOKEN" }, { status: 401 });

    const searchParams = request.nextUrl.searchParams;
    const spreadsheetId = searchParams.get("spreadsheetId");
    const configName    = searchParams.get("configName");

    if (!spreadsheetId || !configName)
      return NextResponse.json({ error: "Missing parameters", code: "MISSING_PARAMS" }, { status: 400 });

    console.log(`⚙️ [${requestId}] Config: ${configName}`);

    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(configName)}!A1:K100`;

    let response: Response;
    try {
      response = await fetchWithRetry(sheetsUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    } catch (error: any) {
      return NextResponse.json({ error: "Failed to fetch config", code: "FETCH_ERROR", message: error.message }, { status: 500 });
    }

    if (!response.ok) {
      if (response.status === 401) return NextResponse.json({ error: "Session expired", code: "TOKEN_EXPIRED" }, { status: 401 });
      if (response.status === 404) return NextResponse.json({ error: "Config not found", code: "CONFIG_NOT_FOUND" }, { status: 404 });
      const errorText = await response.text();
      return NextResponse.json({ error: "Failed to fetch config", code: "FETCH_ERROR", details: errorText }, { status: 500 });
    }

    const data = await response.json();
    const rows: string[][] = Array.isArray(data.values) ? data.values : [];

    if (rows.length === 0)
      return NextResponse.json({ error: "Config sheet is empty", code: "EMPTY_CONFIG" }, { status: 404 });

    const headerRow = Array.isArray(rows[0]) ? rows[0] : [];
    const headers: string[] = headerRow.map(h => (h ?? "").toString().toLowerCase().trim());

    console.log(`📋 [${requestId}] Headers found:`, headers);

    const findHeader = (names: string[]) => headers.findIndex(h => names.includes(h));

    const fieldNameIdx   = findHeader(["field_name", "field", "fieldname"]);
    const labelIdx       = findHeader(["label", "ชื่อแสดงผล", "name"]);
    const typeIdx        = findHeader(["type", "ประเภท"]);
    const requiredIdx    = findHeader(["required", "บังคับ"]);
    const helperIdx      = findHeader(["helper", "options"]);
    const orderIdx       = findHeader(["order", "ลำดับ"]);
    const placeholderIdx = findHeader(["placeholder"]);
    const validationIdx  = findHeader(["validation"]);
    const sectionIdx     = findHeader(["section", "section_name"]);
    const repeatableIdx  = findHeader(["repeatable"]);
    const notesIdx       = findHeader(["notes", "หมายเหตุ"]);

    if (fieldNameIdx === -1 || labelIdx === -1 || typeIdx === -1)
      return NextResponse.json({ error: "Invalid config sheet structure", code: "INVALID_STRUCTURE", found: headers }, { status: 400 });

    const fields = rows.slice(1)
      .filter(row => row[fieldNameIdx])
      .map((row, idx) => ({
        fieldName:   row[fieldNameIdx]?.toString()                                          || `field_${idx}`,
        label:       row[labelIdx]?.toString()                                              || "",
        type:        row[typeIdx]?.toString()                                               || "text",
        required:    requiredIdx    >= 0 ? row[requiredIdx]?.toString().toUpperCase()    === "TRUE" : false,
        helper:      helperIdx      >= 0 ? row[helperIdx]?.toString()                   || null : null,
        order:       orderIdx       >= 0 ? parseInt(row[orderIdx]?.toString() || "")    || idx + 1 : idx + 1,
        placeholder: placeholderIdx >= 0 ? row[placeholderIdx]?.toString()              || "" : "",
        validation:  validationIdx  >= 0 ? row[validationIdx]?.toString()               || null : null,
        section:     sectionIdx     >= 0 ? row[sectionIdx]?.toString().trim()           || undefined : undefined,
        repeatable:  repeatableIdx  >= 0 ? row[repeatableIdx]?.toString().toUpperCase() === "TRUE" : false,
        notes:       notesIdx       >= 0 ? row[notesIdx]?.toString()                    || "" : "",
      }));

    console.log(`📝 [${requestId}] Fields parsed: ${fields.length}`);

    const hasSection = fields.some(f => f.section && f.section.length > 0);

    const result = {
      success: true,
      spreadsheetId,
      configName,
      fields,
      totalFields: fields.length,
      hasSection,
      sections: hasSection ? [...new Set(fields.filter(f => f.section).map(f => f.section))] : [],
    };

    console.log(`✅ [${requestId}] Config loaded successfully`);

    return NextResponse.json(result, {
      headers: {
        // Config เปลี่ยนน้อยกว่า helper → cache นานกว่าได้ (5 นาที)
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    });

  } catch (error: any) {
    console.error(`❌ [${requestId}] ERROR:`, error.message);
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR", message: error.message }, { status: 500 });
  }
}
export const GET = withLogger("/api/module/config", _GET);