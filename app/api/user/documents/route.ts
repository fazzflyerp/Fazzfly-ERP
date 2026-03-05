/**
 * =============================================================================
 * FILE PATH: app/api/user/documents/route.ts
 * =============================================================================
 * 
 * Client Documents API - PRODUCTION READY ✅
 * GET /api/user/documents
 * 
 * ดึงรายการเอกสารที่ลูกค้าสามารถออกได้จาก client_receipt sheet
 * พร้อม config_name สำหรับแมพ columns
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const MASTER_CONFIG_ID = process.env.NEXT_PUBLIC_MASTER_CONFIG_ID || "1j7LguHaX8pIvvQ1PqqenuguOsPT1QthJqXJyMYW2xo8";
const CLIENT_RECEIPT_SHEET = "client_receipt";

interface DocumentModule {
  moduleId: string;
  clientId: string;
  moduleName: string;
  spreadsheetId: string;
  sheetName: string;
  companyName: string;
  paymentMethodHelper: string;
  salesReceiptData: string;
  configName: string;
  folderID: string; // ✅ เพิ่ม folderID
  isActive: boolean;
  notes?: string;
}

export async function GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);

  try {
    console.log("=".repeat(60));
    console.log(`📄 [${requestId}] CLIENT DOCUMENTS API`);
    console.log("=".repeat(60));

    // ✅ AUTH
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token || !(token as any)?.accessToken) {
      console.error(`❌ [${requestId}] Unauthorized - No token`);
      return NextResponse.json(
        { error: "Unauthorized", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    if ((token as any).error === "RefreshAccessTokenError") {
      console.error(`❌ [${requestId}] Token refresh error`);
      return NextResponse.json(
        { error: "Session expired", code: "TOKEN_EXPIRED" },
        { status: 401 }
      );
    }

    const accessToken = (token as any).accessToken as string;
    const userEmail = (token as any).email as string;

    console.log(`👤 [${requestId}] User: ${userEmail}`);

    // ✅ GET CLIENT ID from query parameter (sent from frontend)
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get("clientId");

    if (!clientId) {
      console.error(`❌ [${requestId}] Missing clientId in query parameter`);
      return NextResponse.json(
        { 
          error: "Missing clientId parameter", 
          code: "MISSING_CLIENT_ID",
          message: "Please provide clientId in query: /api/user/documents?clientId=xxx"
        },
        { status: 400 }
      );
    }

    console.log(`✅ [${requestId}] Client ID: ${clientId}`);

    // ✅ FETCH CLIENT_RECEIPT SHEET
    console.log(`⏳ [${requestId}] Fetching client_receipt sheet...`);

    const clientReceiptUrl = `https://sheets.googleapis.com/v4/spreadsheets/${MASTER_CONFIG_ID}/values/${CLIENT_RECEIPT_SHEET}!A:Z`;

    const receiptResponse = await fetch(clientReceiptUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!receiptResponse.ok) {
      const errorText = await receiptResponse.text();
      console.error(`❌ [${requestId}] Failed to fetch client_receipt:`, errorText);
      return NextResponse.json(
        { 
          error: "Failed to fetch documents", 
          code: "RECEIPT_FETCH_ERROR",
          details: errorText 
        },
        { status: 500 }
      );
    }

    const receiptData = await receiptResponse.json();
    const receiptRows = receiptData.values || [];

    if (receiptRows.length === 0) {
      console.log(`ℹ️ [${requestId}] client_receipt sheet is empty`);
      return NextResponse.json({
        success: true,
        clientId,
        documents: [],
        count: 0,
      });
    }

    // ✅ PARSE HEADERS
    const headers = receiptRows[0];
    const dataRows = receiptRows.slice(1);

    console.log(`📋 [${requestId}] Headers:`, headers);

    // Find column indices
    const columnIndices = {
      moduleId: headers.findIndex((h: string) => h.toLowerCase() === "module_id"),
      clientId: headers.findIndex((h: string) => h.toLowerCase() === "client_id"),
      moduleName: headers.findIndex((h: string) => h.toLowerCase() === "module_name"),
      spreadsheetId: headers.findIndex((h: string) => h.toLowerCase() === "spreadsheet_id"),
      sheetName: headers.findIndex((h: string) => h.toLowerCase() === "sheet_name"),
      companyName: headers.findIndex((h: string) => h.toLowerCase() === "company_name"),
      paymentMethodHelper: headers.findIndex((h: string) => h.toLowerCase() === "payment_method_helper"),
      salesReceiptData: headers.findIndex((h: string) => h.toLowerCase() === "sales_receipt_data"),
      configName: headers.findIndex((h: string) => h.toLowerCase() === "config_name"),
      folderID: headers.findIndex((h: string) => h.toLowerCase() === "folderid"), // ✅ เพิ่ม folderID
      isActive: headers.findIndex((h: string) => h.toLowerCase() === "is_active"),
      notes: headers.findIndex((h: string) => h.toLowerCase() === "notes"),
    };

    // Validate required columns
    const requiredColumns = [
      "moduleId", "clientId", "moduleName", "spreadsheetId", 
      "sheetName", "configName", "isActive"
    ];
    
    const missingColumns = requiredColumns.filter(
      (key) => columnIndices[key as keyof typeof columnIndices] === -1
    );

    if (missingColumns.length > 0) {
      console.error(`❌ [${requestId}] Missing columns:`, missingColumns);
      return NextResponse.json(
        { 
          error: "Invalid sheet structure", 
          code: "MISSING_COLUMNS",
          missingColumns 
        },
        { status: 500 }
      );
    }

    // ✅ FILTER BY CLIENT_ID AND IS_ACTIVE
    console.log(`🔍 [${requestId}] Filtering documents for client: ${clientId}`);

    const clientDocuments: DocumentModule[] = dataRows
      .filter((row: any[]) => {
        const rowClientId = row[columnIndices.clientId]?.toString().trim();
        const isActive = row[columnIndices.isActive]?.toString().trim().toUpperCase();
        
        return rowClientId === clientId && isActive === "TRUE";
      })
      .map((row: any[]) => ({
        moduleId: row[columnIndices.moduleId]?.toString().trim() || "",
        clientId: row[columnIndices.clientId]?.toString().trim() || "",
        moduleName: row[columnIndices.moduleName]?.toString().trim() || "",
        spreadsheetId: row[columnIndices.spreadsheetId]?.toString().trim() || "",
        sheetName: row[columnIndices.sheetName]?.toString().trim() || "",
        companyName: row[columnIndices.companyName]?.toString().trim() || "",
        paymentMethodHelper: row[columnIndices.paymentMethodHelper]?.toString().trim() || "",
        salesReceiptData: row[columnIndices.salesReceiptData]?.toString().trim() || "",
        configName: row[columnIndices.configName]?.toString().trim() || "",
        folderID: row[columnIndices.folderID]?.toString().trim() || "", // ✅ เพิ่ม folderID
        isActive: true,
        notes: columnIndices.notes >= 0 ? row[columnIndices.notes]?.toString().trim() : undefined,
      }))
      .filter((doc: DocumentModule) => doc.moduleId && doc.spreadsheetId && doc.configName);

    console.log(`✅ [${requestId}] Found ${clientDocuments.length} active documents`);

    // ✅ LOG DETAILS
    clientDocuments.forEach((doc, index) => {
      console.log(`   ${index + 1}. ${doc.moduleName} (${doc.moduleId})`);
      console.log(`      spreadsheetId: ${doc.spreadsheetId}`);
      console.log(`      sheetName: ${doc.sheetName}`);
      console.log(`      configName: ${doc.configName}`);
    });

    console.log("=".repeat(60));
    console.log(`✅ [${requestId}] SUCCESS - Returning ${clientDocuments.length} documents`);
    console.log("=".repeat(60));

    return NextResponse.json({
      success: true,
      clientId,
      documents: clientDocuments,
      count: clientDocuments.length,
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