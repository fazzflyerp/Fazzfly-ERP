/**
 * User Modules API - PRODUCTION READY ✅ + CRM Support
 * Location: app/api/user/modules/route.ts
 * 
 * ✅ รองรับ multi-user พร้อมกัน
 * ✅ Auto-retry เมื่อ token หมดอายุ
 * ✅ Better error handling
 * ✅ CRM Access from modules column (NEW)
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const MASTER_SHEET_ID = process.env.MASTER_SHEET_ID;

// ✅ Helper function สำหรับ fetch Google Sheets พร้อม retry
async function fetchGoogleSheets(
  url: string,
  accessToken: string,
  retries = 2
): Promise<any> {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        // ✅ เพิ่ม timeout เพื่อไม่ให้ค้างนาน
        signal: AbortSignal.timeout(15000), // 15 seconds
      });

      if (response.ok) {
        return await response.json();
      }

      // ✅ Handle specific error cases
      if (response.status === 401) {
        // Token หมดอายุ - ต้อง re-login
        throw new Error("TOKEN_EXPIRED");
      }

      if (response.status === 403) {
        const errorBody = await response.text();
        if (errorBody.includes("PERMISSION_DENIED")) {
          throw new Error("PERMISSION_DENIED");
        }
        // Retry สำหรับ rate limit
        if (i < retries) {
          console.warn(`⚠️ Rate limited, retrying... (${i + 1}/${retries})`);
          await new Promise((r) => setTimeout(r, 1000 * (i + 1))); // exponential backoff
          continue;
        }
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error: any) {
      // ถ้าเป็น error ที่ไม่ควร retry ให้ throw ทันที
      if (
        error.message === "TOKEN_EXPIRED" ||
        error.message === "PERMISSION_DENIED" ||
        error.name === "TimeoutError"
      ) {
        throw error;
      }

      // Retry สำหรับ network errors
      if (i < retries) {
        console.warn(`⚠️ Network error, retrying... (${i + 1}/${retries})`);
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
        continue;
      }

      throw error;
    }
  }
}

export async function GET(request: NextRequest) {
  // ✅ เพิ่ม request ID สำหรับ tracking
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    console.log("=".repeat(50));
    console.log(`📡 [${requestId}] START: Fetching user modules`);
    console.log("=".repeat(50));

    // Step 1-3: Get token
    console.log(`⏳ [${requestId}] Step 1-3: Getting JWT token...`);
    
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token || !(token as any)?.accessToken || !(token as any)?.email) {
      console.error(`❌ [${requestId}] Authentication failed`);
      return NextResponse.json(
        { error: "Not authenticated", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    // ✅ Check for token refresh error
    if ((token as any).error === "RefreshAccessTokenError") {
      console.error(`❌ [${requestId}] Token refresh failed`);
      return NextResponse.json(
        { 
          error: "Session expired", 
          code: "TOKEN_EXPIRED",
          message: "Please sign out and sign in again" 
        },
        { status: 401 }
      );
    }

    const accessToken = (token as any).accessToken as string;
    const userEmail = (token as any).email as string;

    console.log(`✅ [${requestId}] Authentication OK:`, userEmail);

    if (!MASTER_SHEET_ID) {
      console.error(`❌ [${requestId}] MASTER_SHEET_ID not configured`);
      return NextResponse.json(
        { error: "Configuration error", code: "CONFIG_ERROR" },
        { status: 500 }
      );
    }

    // Step 5: Fetch client_master with retry (✅ เปลี่ยนเป็น A:H เพื่อรวม modules column)
    console.log(`⏳ [${requestId}] Step 5: Fetching client_master...`);
    
    const masterUrl = `https://sheets.googleapis.com/v4/spreadsheets/${MASTER_SHEET_ID}/values/client_master!A:H`;
    
    let masterData;
    try {
      masterData = await fetchGoogleSheets(masterUrl, accessToken);
    } catch (error: any) {
      if (error.message === "TOKEN_EXPIRED") {
        return NextResponse.json(
          { 
            error: "Session expired", 
            code: "TOKEN_EXPIRED",
            message: "Please sign out and sign in again" 
          },
          { status: 401 }
        );
      }
      
      if (error.message === "PERMISSION_DENIED") {
        return NextResponse.json(
          {
            error: "Permission denied",
            code: "PERMISSION_DENIED",
            message: "Need to grant Google Sheets access. Please sign out and sign in again.",
          },
          { status: 403 }
        );
      }

      throw error;
    }

    if (!masterData.values || masterData.values.length === 0) {
      console.error(`❌ [${requestId}] Master sheet is empty`);
      return NextResponse.json(
        { error: "Master sheet is empty", code: "EMPTY_SHEET" },
        { status: 500 }
      );
    }

    const masterRows = masterData.values as any[][];
    console.log(`✅ [${requestId}] Master sheet fetched:`, masterRows.length, "rows");

    // Step 6: Find client by email
    console.log(`⏳ [${requestId}] Step 6: Finding client for email:`, userEmail);
    
    const clientRow = masterRows.find((row, idx) => {
      if (idx === 0) return false;
      const email = row[2]?.toString().toLowerCase() || "";
      return email === userEmail.toLowerCase();
    });

    if (!clientRow) {
      console.error(`❌ [${requestId}] Client not found for email:`, userEmail);
      return NextResponse.json(
        { error: "User not found in system", code: "USER_NOT_FOUND" },
        { status: 404 }
      );
    }

    const clientId = clientRow[0]?.toString() || "";
    const clientName = clientRow[1]?.toString() || "";
    const planType = clientRow[3]?.toString() || "";
    const status = clientRow[4]?.toString() || "";
    const expiresAt = clientRow[6]?.toString() || "";

    // ==============================
    // ✅ NEW: Check CRM Access from column H
    // ==============================
    const modulesStr = clientRow[7]?.toString() || "ERP"; // column H: modules
    const hasCRM = modulesStr.includes("CRM");
    const hasHRM = modulesStr.includes("HRM"); // สำหรับอนาคต
    const crmExpiresAt = hasCRM ? expiresAt : null;

    console.log(`✅ [${requestId}] Client found:`, { 
      clientId, 
      clientName, 
      status, 
      modules: modulesStr,
      hasCRM,
      hasHRM 
    });

    // Step 7-8: Check status and expiry
    if (status.toUpperCase() !== "TRUE" && status.toUpperCase() !== "ACTIVE") {
      console.warn(`❌ [${requestId}] Account not active:`, status);
      return NextResponse.json(
        { error: "Account is inactive", code: "ACCOUNT_INACTIVE" },
        { status: 403 }
      );
    }

    const expireDate = parseDate(expiresAt);
    if (expireDate && expireDate < new Date()) {
      console.warn(`❌ [${requestId}] Account expired:`, expiresAt);
      return NextResponse.json(
        { error: "Subscription expired", code: "SUBSCRIPTION_EXPIRED" },
        { status: 403 }
      );
    }

    console.log(`✅ [${requestId}] Account is active and not expired`);

    // Step 9: Fetch modules with retry
    console.log(`⏳ [${requestId}] Step 9: Fetching client_modules...`);
    
    const modulesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${MASTER_SHEET_ID}/values/client_modules!A:I`;
    
    const modulesData = await fetchGoogleSheets(modulesUrl, accessToken);
    const modulesRows = modulesData.values as any[][] || [];
    
    console.log(`✅ [${requestId}] Modules sheet fetched:`, modulesRows.length, "rows");

    // Step 10: Filter modules
    console.log(`⏳ [${requestId}] Step 10: Filtering modules for client:`, clientId);
    
    const modules = modulesRows
      .slice(1)
      .filter((row) => {
        const mClientId = row[1]?.toString() || "";
        const isActive = row[6]?.toString().toUpperCase() === "TRUE";
        const configName = row[5]?.toString() || "";
        
        return mClientId === clientId && isActive && configName.trim() !== "";
      })
      .map((row) => ({
        moduleId: row[0]?.toString() || "",
        moduleName: row[2]?.toString() || "",
        spreadsheetId: row[3]?.toString() || "",
        sheetName: row[4]?.toString() || "",
        configName: row[5]?.toString() || "",
        notes: row[7]?.toString() || "",
      }));

    console.log(`✅ [${requestId}] Filtered modules:`, modules.length);

    // Step 11: Filter dashboards
    console.log(`⏳ [${requestId}] Step 11: Preparing dashboardItems...`);

    const dashboardItems = modulesRows
      .slice(1)
      .filter((row) => {
        const mClientId = row[1]?.toString() || "";
        const isActive = row[6]?.toString().toUpperCase() === "TRUE";
        const dashboardConfigName = row[8]?.toString() || "";
        
        return mClientId === clientId && isActive && dashboardConfigName.trim() !== "";
      })
      .map((row) => ({
        dashboardId: row[0]?.toString() || "",
        dashboardName: row[2]?.toString() || "",
        spreadsheetId: row[3]?.toString() || "",
        sheetName: row[4]?.toString() || "",
        dashboardConfigName: row[8]?.toString() || "",
        notes: row[7]?.toString() || "",
      }));

    console.log(`✅ [${requestId}] Dashboard items prepared:`, dashboardItems.length);

    const response = {
      clientId,
      clientName,
      planType,
      expiresAt,
      hasCRM,           // ✅ NEW
      crmExpiresAt,     // ✅ NEW
      hasHRM,           // ✅ NEW (สำหรับอนาคต)
      modules,
      dashboardItems,
    };

    console.log("=".repeat(50));
    console.log(`✅ [${requestId}] SUCCESS`);
    console.log(`   hasCRM: ${hasCRM}, hasHRM: ${hasHRM}`); // ✅ NEW
    console.log("=".repeat(50));

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("=".repeat(50));
    console.error(`❌ [${requestId}] ERROR:`, error.message);
    console.error("=".repeat(50));

    return NextResponse.json(
      {
        error: "Server error",
        code: "INTERNAL_ERROR",
        message: error.message,
      },
      { status: 500 }
    );
  }
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  try {
    if (dateStr.includes("/")) {
      const [month, day, year] = dateStr.split("/").map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date(dateStr);
  } catch {
    return null;
  }
}