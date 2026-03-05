/**
 * Company Info API
 * GET /api/receipt/company-info
 * 
 * ดึงข้อมูลบริษัทจาก company_info sheet
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);

  try {
    console.log("=".repeat(60));
    console.log(`🏢 [${requestId}] COMPANY INFO API`);
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
    const sheetName = searchParams.get("sheetName") || "company_info";

    if (!spreadsheetId) {
      console.error(`❌ [${requestId}] Missing spreadsheetId`);
      return NextResponse.json(
        { 
          error: "Missing required parameter", 
          code: "MISSING_PARAMS",
          required: ["spreadsheetId"]
        },
        { status: 400 }
      );
    }

    console.log(`📌 [${requestId}] spreadsheetId: ${spreadsheetId}`);
    console.log(`📌 [${requestId}] sheetName: ${sheetName}`);

    // ✅ FETCH COMPANY INFO SHEET
    console.log(`⏳ [${requestId}] Fetching company info...`);

    const companyUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A:Z`;

    const response = await fetch(companyUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [${requestId}] Failed to fetch company info:`, errorText);
      return NextResponse.json(
        { 
          error: "Failed to fetch company info", 
          code: "COMPANY_FETCH_ERROR",
          details: errorText 
        },
        { status: 500 }
      );
    }

    const data = await response.json();
    const rows = data.values || [];

    if (rows.length === 0) {
      console.error(`❌ [${requestId}] Company info sheet is empty`);
      return NextResponse.json(
        { error: "Company info sheet is empty", code: "EMPTY_SHEET" },
        { status: 404 }
      );
    }

    // ✅ PARSE COMPANY INFO
    // Expected format: Key-Value pairs
    // Row 1: company_name | บริษัท ABC จำกัด
    // Row 2: address | 123 ถนนสุขุมวิท
    // etc.

    const companyInfo: Record<string, string> = {};

    rows.forEach((row: string[]) => {
      if (row.length >= 2) {
        const key = row[0]?.toString().trim();
        const value = row[1]?.toString().trim();
        if (key && value) {
          companyInfo[key] = value;
        }
      }
    });

    console.log(`✅ [${requestId}] Company info loaded:`, companyInfo);

    console.log("=".repeat(60));
    console.log(`✅ [${requestId}] SUCCESS`);
    console.log("=".repeat(60));

    return NextResponse.json({
      success: true,
      spreadsheetId,
      sheetName,
      companyInfo,
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