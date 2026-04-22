/**
 * Module Config API
 * Location: app/api/module/config/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { withLogger } from "@/lib/with-logger";
import { saReadRange } from "@/lib/google-sa";
import { verifySheetAccess } from "@/lib/verify-sheet-access";

async function _GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);

  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
    if ((token as any).error === "RefreshAccessTokenError")
      return NextResponse.json({ error: "Session expired", code: "TOKEN_EXPIRED" }, { status: 401 });

    const spreadsheetId = request.nextUrl.searchParams.get("spreadsheetId");
    const configName    = request.nextUrl.searchParams.get("configName");

    if (!spreadsheetId || !configName)
      return NextResponse.json({ error: "Missing parameters", code: "MISSING_PARAMS" }, { status: 400 });

    const userEmail = ((token as any)?.email as string || "").toLowerCase();
    const access = await verifySheetAccess(userEmail, spreadsheetId);
    if (!access.allowed)
      return NextResponse.json({ error: "Forbidden: sheet not owned by your client", code: "FORBIDDEN" }, { status: 403 });

    let rows: any[][];
    try {
      rows = await saReadRange(spreadsheetId, `${configName}!A1:K100`);
    } catch (error: any) {
      const httpStatus = error?.response?.status;
      const msg = httpStatus === 404
        ? `ไม่พบ Sheet ชื่อ "${configName}" ใน Spreadsheet`
        : httpStatus === 403
        ? "Service Account ไม่มีสิทธิ์เข้าถึง Spreadsheet นี้"
        : error.message;
      console.error(`❌ [${requestId}] saReadRange failed (HTTP ${httpStatus ?? "?"}) :`, error.message);
      return NextResponse.json({ error: "Failed to fetch config", code: "FETCH_ERROR", message: msg }, { status: 500 });
    }

    if (!rows || rows.length === 0)
      return NextResponse.json({ error: "Config sheet is empty", code: "EMPTY_CONFIG" }, { status: 404 });

    const headerRow = Array.isArray(rows[0]) ? rows[0] : [];
    const headers   = headerRow.map((h: any) => (h ?? "").toString().toLowerCase().trim());

    const findHeader = (names: string[]) => headers.findIndex((h: string) => names.includes(h));

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

    const hasSection = fields.some(f => f.section && f.section.length > 0);

    return NextResponse.json(
      {
        success: true,
        spreadsheetId,
        configName,
        fields,
        totalFields: fields.length,
        hasSection,
        sections: hasSection ? [...new Set(fields.filter(f => f.section).map(f => f.section))] : [],
      },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } }
    );

  } catch (error: any) {
    console.error(`❌ [${requestId}] ERROR:`, error.message);
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR", message: error.message }, { status: 500 });
  }
}
export const GET = withLogger("/api/module/config", _GET);
