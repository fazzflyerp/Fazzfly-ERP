/**
 * Module Config API - Fixed with Smart hasSection Detection
 * Location: app/api/module/config/route.ts
 * 
 * GET /api/module/config?spreadsheetId=xxx&configName=yyy
 * 
 * ทำหน้าที่:
 * 1. ตรวจสอบ token
 * 2. ดึง config sheet จาก Google Sheets
 * 3. Parse header + fields
 * 4. Auto detect hasSection จาก data จริง ๆ (ถ้ามี field ที่มี section ที่ไม่ว่างเปล่า)
 * 5. Return field definition (รวม section + repeatable)
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const accessToken = (token as any)?.accessToken;
    if (!accessToken) {
      console.log("No accessToken in token");
      return NextResponse.json({ error: "No access token" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const spreadsheetId = searchParams.get("spreadsheetId");
    const configName = searchParams.get("configName");

    if (!spreadsheetId || !configName) {
      return NextResponse.json(
        { error: "Missing spreadsheetId or configName" },
        { status: 400 }
      );
    }

    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${configName}!A1:J100`;

    const response = await fetch(sheetsUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: "Failed to fetch config", details: errorText },
        { status: 500 }
      );
    }

    const data = await response.json();
    const rows: string[][] = Array.isArray(data.values) ? data.values : [];

    if (rows.length === 0) {
      return NextResponse.json({ error: "Config sheet is empty" }, { status: 404 });
    }

    const headerRow = Array.isArray(rows[0]) ? rows[0] : [];
    const headers: string[] = headerRow.map(h =>
      (h ?? "").toString().toLowerCase().trim()
    );

    console.log("📋 Headers found:", headers);

    const findHeader = (names: string[]) =>
      headers.findIndex(h => names.includes(h));

    const fieldNameIdx = findHeader(["field_name", "field"]);
    const labelIdx = findHeader(["label", "ชื่อแสดงผล", "name"]);
    const typeIdx = findHeader(["type", "ประเภท"]);
    const requiredIdx = findHeader(["required", "บังคับ"]);
    const helperIdx = findHeader(["helper", "options"]);
    const orderIdx = findHeader(["order", "ลำดับ"]);
    const placeholderIdx = findHeader(["placeholder"]);
    const validationIdx = findHeader(["validation"]);
    const sectionIdx = findHeader(["section", "section_name"]);
    const repeatableIdx = findHeader(["repeatable"]);
    const notesIdx = findHeader(["notes"]);

    console.log("🔑 Column indices:", {
      fieldName: fieldNameIdx,
      label: labelIdx,
      type: typeIdx,
      section: sectionIdx,
      repeatable: repeatableIdx,
    });

    if (fieldNameIdx === -1 || labelIdx === -1 || typeIdx === -1) {
      return NextResponse.json(
        {
          error: "Invalid config sheet structure",
          expected: "At least: field_name, label, type",
          found: headers,
          hint: "Columns should be: field_name, label, type, required, helper, order, section, repeatable",
        },
        { status: 400 }
      );
    }

    const fields = rows
      .slice(1)
      .filter(row => row[fieldNameIdx])
      .map((row, idx) => {
        const section = sectionIdx >= 0 ? row[sectionIdx]?.toString().trim() || "" : "";
        const repeatable = repeatableIdx >= 0 ? row[repeatableIdx]?.toString().toUpperCase() === "TRUE" : false;

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
      })

    console.log("📝 Fields parsed:", fields.length);

    // ✅ Smart Detection: hasSection = true ถ้ามี field ที่มี section value ที่ไม่ว่างเปล่า
    const hasSection = fields.some(f => f.section && f.section.length > 0);
    
    console.log("📋 Section Detection:", {
      hasSection,
      fieldWithSection: fields
        .filter(f => f.section)
        .map(f => ({ fieldName: f.fieldName, section: f.section, repeatable: f.repeatable }))
    });

    return NextResponse.json({
      success: true,
      spreadsheetId,
      configName,
      fields,
      totalFields: fields.length,
      hasSection: hasSection,
    });
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}