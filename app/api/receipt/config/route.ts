/**
 * Receipt Config API
 * GET /api/receipt/config
 * 
 * ดึง config จาก Config_recipt_dashboard sheet
 * เพื่อแมพ columns ใน Transaction sheet
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

interface ReceiptConfigField {
  fieldName: string;
  label: string;
  type: string;
  order: number | null; // null = field แสดงแต่ไม่มีข้อมูลจาก Transaction
}

export async function GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);

  try {
    console.log("=".repeat(60));
    console.log(`📋 [${requestId}] RECEIPT CONFIG API`);
    console.log("=".repeat(60));

    // ✅ AUTH
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token || !(token as any)?.accessToken) {
      console.error(`❌ [${requestId}] Unauthorized`);
      return NextResponse.json(
        { error: "Unauthorized", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    const accessToken = (token as any).accessToken as string;

    // ✅ GET PARAMETERS
    const searchParams = request.nextUrl.searchParams;
    const spreadsheetId = searchParams.get("spreadsheetId");
    const configName = searchParams.get("configName");

    if (!spreadsheetId || !configName) {
      console.error(`❌ [${requestId}] Missing parameters`);
      return NextResponse.json(
        { 
          error: "Missing required parameters", 
          code: "MISSING_PARAMS",
          required: ["spreadsheetId", "configName"]
        },
        { status: 400 }
      );
    }

    console.log(`📌 [${requestId}] spreadsheetId: ${spreadsheetId}`);
    console.log(`📌 [${requestId}] configName: ${configName}`);

    // ✅ FETCH CONFIG SHEET
    console.log(`⏳ [${requestId}] Fetching config sheet...`);

    const configUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${configName}!A:Z`;

    const response = await fetch(configUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [${requestId}] Failed to fetch config:`, errorText);
      return NextResponse.json(
        { 
          error: "Failed to fetch config sheet", 
          code: "CONFIG_FETCH_ERROR",
          details: errorText 
        },
        { status: 500 }
      );
    }

    const data = await response.json();
    const rows = data.values || [];

    if (rows.length === 0) {
      console.error(`❌ [${requestId}] Config sheet is empty`);
      return NextResponse.json(
        { error: "Config sheet is empty", code: "EMPTY_CONFIG" },
        { status: 404 }
      );
    }

    // ✅ PARSE HEADERS
    const headers = rows[0];
    const dataRows = rows.slice(1);

    console.log(`📋 [${requestId}] Headers:`, headers);

    // Find column indices
    const columnIndices = {
      fieldName: headers.findIndex((h: string) => h.toLowerCase() === "field_name"),
      label: headers.findIndex((h: string) => h.toLowerCase() === "label"),
      type: headers.findIndex((h: string) => h.toLowerCase() === "type"),
      order: headers.findIndex((h: string) => h.toLowerCase() === "order"),
    };

    // Validate required columns
    const requiredColumns = ["fieldName", "label", "type", "order"];
    const missingColumns = requiredColumns.filter(
      (key) => columnIndices[key as keyof typeof columnIndices] === -1
    );

    if (missingColumns.length > 0) {
      console.error(`❌ [${requestId}] Missing columns:`, missingColumns);
      return NextResponse.json(
        { 
          error: "Invalid config structure", 
          code: "MISSING_COLUMNS",
          missingColumns,
          availableHeaders: headers
        },
        { status: 500 }
      );
    }

    // ✅ PARSE CONFIG FIELDS
    console.log(`🔍 [${requestId}] Parsing config fields...`);

    const configFields: ReceiptConfigField[] = dataRows
      .filter((row: any[]) => row[columnIndices.fieldName]) // มี field_name
      .map((row: any[]) => {
        const orderValue = row[columnIndices.order]?.toString().trim();
        
        return {
          fieldName: row[columnIndices.fieldName]?.toString().trim() || "",
          label: row[columnIndices.label]?.toString().trim() || "",
          type: row[columnIndices.type]?.toString().trim() || "text",
          order: orderValue && orderValue !== "" ? parseInt(orderValue) : null,
        };
      });

    console.log(`✅ [${requestId}] Found ${configFields.length} config fields`);

    // ✅ LOG SAMPLE FIELDS
    configFields.slice(0, 3).forEach((field, index) => {
      console.log(`   ${index + 1}. ${field.fieldName} (${field.label})`);
      console.log(`      type: ${field.type}, order: ${field.order || "null"}`);
    });

    console.log("=".repeat(60));
    console.log(`✅ [${requestId}] SUCCESS - Returning ${configFields.length} fields`);
    console.log("=".repeat(60));

    return NextResponse.json({
      success: true,
      spreadsheetId,
      configName,
      fields: configFields,
      count: configFields.length,
    });

  } catch (error: any) {
    console.error("=".repeat(60));
    console.error(`❌ [${requestId}] ERROR:`, error.message);
    console.error(error.stack);
    console.error("=".repeat(60));

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