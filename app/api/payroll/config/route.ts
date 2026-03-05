/**
 * =============================================================================
 * FILE PATH: app/api/payroll/config/route.ts
 * =============================================================================
 * 
 * Payroll Config API
 * GET /api/payroll/config
 * รองรับ type: text, number, earning, deduction
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

interface PayrollConfigField {
  fieldName: string;
  label: string;
  type: string; // text, number, earning, deduction
  order: number | null;
}

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token || !(token as any)?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessToken = (token as any).accessToken as string;
    const searchParams = request.nextUrl.searchParams;
    const spreadsheetId = searchParams.get("spreadsheetId");
    const configName = searchParams.get("configName");

    if (!spreadsheetId || !configName) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const configUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${configName}!A:Z`;

    const response = await fetch(configUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: "Failed to fetch config sheet", details: errorText },
        { status: 500 }
      );
    }

    const data = await response.json();
    const rows = data.values || [];

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Config sheet is empty" },
        { status: 404 }
      );
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    const columnIndices = {
      fieldName: headers.findIndex((h: string) => h.toLowerCase() === "field_name"),
      label: headers.findIndex((h: string) => h.toLowerCase() === "label"),
      type: headers.findIndex((h: string) => h.toLowerCase() === "type"),
      order: headers.findIndex((h: string) => h.toLowerCase() === "order"),
    };

    const configFields: PayrollConfigField[] = dataRows
      .filter((row: any[]) => row[columnIndices.fieldName])
      .map((row: any[]) => {
        const orderValue = row[columnIndices.order]?.toString().trim();
        
        return {
          fieldName: row[columnIndices.fieldName]?.toString().trim() || "",
          label: row[columnIndices.label]?.toString().trim() || "",
          type: row[columnIndices.type]?.toString().trim() || "text",
          order: orderValue && orderValue !== "" ? parseInt(orderValue) : null,
        };
      });

    return NextResponse.json({
      success: true,
      spreadsheetId,
      configName,
      fields: configFields,
      count: configFields.length,
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}