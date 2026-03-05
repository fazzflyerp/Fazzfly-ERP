/**
 * =============================================================================
 * FILE PATH: app/api/payroll/transactions/route.ts
 * =============================================================================
 * 
 * Payroll Transactions API
 * GET /api/payroll/transactions
 * 
 * ดึงรายการ transactions จาก Payroll_Transaction sheet
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
    const sheetName = searchParams.get("sheetName");

    if (!spreadsheetId || !sheetName) {
      return NextResponse.json(
        { error: "Missing required parameters: spreadsheetId, sheetName" },
        { status: 400 }
      );
    }

    // ✅ FETCH TRANSACTION SHEET
    // ดึง A:AZ (ครอบคลุม order 1-52)
    const transactionUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A:AZ`;

    const response = await fetch(transactionUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: "Failed to fetch transaction sheet", details: errorText },
        { status: 500 }
      );
    }

    const data = await response.json();
    const rows = data.values || [];

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Transaction sheet is empty" },
        { status: 404 }
      );
    }

    // ✅ PARSE DATA
    const headers = rows[0];
    const dataRows = rows.slice(1);

    // แปลงเป็น array of objects
    const transactions = dataRows.map((row: any[], index: number) => {
      return {
        rowIndex: index + 2, // +2 เพราะ: +1 header, +1 zero-indexed
        data: row, // raw array ของข้อมูล
      };
    });

    return NextResponse.json({
      success: true,
      spreadsheetId,
      sheetName,
      headers,
      transactions,
      count: transactions.length,
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}