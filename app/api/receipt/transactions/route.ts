/**
 * Receipt Transactions API
 * GET /api/receipt/transactions
 * 
 * ดึงรายการ transactions จาก Transaction sheet (เช่น Sales Transactions)
 * พร้อมแมพข้อมูลตาม config
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);

  try {
    console.log("=".repeat(60));
    console.log(`📊 [${requestId}] RECEIPT TRANSACTIONS API`);
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
    const sheetName = searchParams.get("sheetName");

    if (!spreadsheetId || !sheetName) {
      console.error(`❌ [${requestId}] Missing parameters`);
      return NextResponse.json(
        { 
          error: "Missing required parameters", 
          code: "MISSING_PARAMS",
          required: ["spreadsheetId", "sheetName"]
        },
        { status: 400 }
      );
    }

    console.log(`📌 [${requestId}] spreadsheetId: ${spreadsheetId}`);
    console.log(`📌 [${requestId}] sheetName: ${sheetName}`);

    // ✅ FETCH TRANSACTION SHEET
    console.log(`⏳ [${requestId}] Fetching transaction sheet...`);

    // ดึงทั้งหมด A:Z (หรือมากกว่าถ้า config มี order > 26)
    const transactionUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A:AZ`;

    const response = await fetch(transactionUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [${requestId}] Failed to fetch transactions:`, errorText);
      return NextResponse.json(
        { 
          error: "Failed to fetch transaction sheet", 
          code: "TRANSACTION_FETCH_ERROR",
          details: errorText 
        },
        { status: 500 }
      );
    }

    const data = await response.json();
    const rows = data.values || [];

    if (rows.length === 0) {
      console.error(`❌ [${requestId}] Transaction sheet is empty`);
      return NextResponse.json(
        { error: "Transaction sheet is empty", code: "EMPTY_SHEET" },
        { status: 404 }
      );
    }

    // ✅ PARSE DATA
    console.log(`📋 [${requestId}] Total rows: ${rows.length}`);

    // Header row
    const headers = rows[0];
    console.log(`📋 [${requestId}] Headers (first 10):`, headers.slice(0, 10));

    // Data rows (skip header)
    const dataRows = rows.slice(1);

    // แปลงเป็น array of arrays (raw data)
    const transactions = dataRows.map((row: any[], index: number) => {
      // แต่ละ row คือ array ของค่าใน columns
      return {
        rowIndex: index + 2, // +2 เพราะ: +1 header, +1 zero-indexed
        data: row, // raw array ของข้อมูล
      };
    });

    console.log(`✅ [${requestId}] Found ${transactions.length} transactions`);

    // LOG SAMPLE
    if (transactions.length > 0) {
      console.log(`📋 [${requestId}] Sample transaction (row 2):`, {
        rowIndex: transactions[0].rowIndex,
        firstFewColumns: transactions[0].data.slice(0, 5),
      });
    }

    console.log("=".repeat(60));
    console.log(`✅ [${requestId}] SUCCESS - Returning ${transactions.length} transactions`);
    console.log("=".repeat(60));

    return NextResponse.json({
      success: true,
      spreadsheetId,
      sheetName,
      headers,
      transactions,
      count: transactions.length,
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