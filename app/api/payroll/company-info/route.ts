/**
 * =============================================================================
 * FILE PATH: app/api/payroll/company-info/route.ts
 * =============================================================================
 * 
 * Company Info API for Payroll
 * GET /api/payroll/company-info
 * 
 * ดึงข้อมูลบริษัทจาก company_info sheet
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function GET(request: NextRequest) {
  try {
    // ✅ AUTH
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token || !(token as any)?.accessToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const accessToken = (token as any).accessToken as string;

    // ✅ GET PARAMETERS
    const searchParams = request.nextUrl.searchParams;
    const spreadsheetId = searchParams.get("spreadsheetId");
    const sheetName = searchParams.get("sheetName") || "company_info";

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: "Missing required parameter: spreadsheetId" },
        { status: 400 }
      );
    }

    // ✅ FETCH COMPANY INFO SHEET
    const companyUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A:Z`;

    const response = await fetch(companyUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: "Failed to fetch company info", details: errorText },
        { status: 500 }
      );
    }

    const data = await response.json();
    const rows = data.values || [];

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Company info sheet is empty" },
        { status: 404 }
      );
    }

    // ✅ PARSE COMPANY INFO
    // Support 2 formats:
    // 1. Vertical (Key-Value pairs): A1=field_name, B1=value
    // 2. Horizontal (Headers-Values): Row1=headers, Row2=values

    const companyInfo: Record<string, string> = {};

    const firstRow = rows[0];
    const isHorizontalFormat = firstRow.length > 2;

    if (isHorizontalFormat) {
      // Horizontal: Row 1 = headers, Row 2 = values
      const headers = rows[0];
      const values = rows[1] || [];

      headers.forEach((header: string, index: number) => {
        const key = header?.toString().trim();
        const value = values[index]?.toString().trim();
        if (key && value) {
          companyInfo[key] = value;
        }
      });
    } else {
      // Vertical: Each row = [key, value]
      rows.forEach((row: string[]) => {
        if (row.length >= 2) {
          const key = row[0]?.toString().trim();
          const value = row[1]?.toString().trim();
          if (key && value) {
            companyInfo[key] = value;
          }
        }
      });
    }

    return NextResponse.json({
      success: true,
      spreadsheetId,
      sheetName,
      companyInfo,
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}