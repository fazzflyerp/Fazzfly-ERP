/**
 * User Modules API - Column Mapping Fixed
 * Location: app/api/user/modules/route.ts
 * 
 * client_master columns:
 * A(0): client_id
 * B(1): client_name
 * C(2): email
 * D(3): plan_type
 * E(4): status
 * F(5): created_at
 * G(6): expires_at
 */

/**
 * User Modules API - Safe Version
 * Location: app/api/user/modules/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const MASTER_SHEET_ID = process.env.MASTER_SHEET_ID;

export async function GET(request: NextRequest) {
  try {
    console.log("=".repeat(50));
    console.log("📡 START: Fetching user modules");
    console.log("=".repeat(50));

    // Step 1-3: Get token
    console.log("⏳ Step 1-3: Getting JWT token...");
    
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token || !(token as any)?.accessToken || !(token as any)?.email) {
      console.error("❌ Authentication failed");
      console.error({
        hasToken: !!token,
        hasAccessToken: !!(token as any)?.accessToken,
        hasEmail: !!(token as any)?.email,
      });
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const accessToken = (token as any).accessToken as string;
    const userEmail = (token as any).email as string;

    console.log("✅ Authentication OK:", userEmail);

    if (!MASTER_SHEET_ID) {
      console.error("❌ MASTER_SHEET_ID not configured");
      return NextResponse.json(
        { error: "Configuration error: MASTER_SHEET_ID not set" },
        { status: 500 }
      );
    }

    // Step 5: Fetch client_master
    console.log("⏳ Step 5: Fetching client_master...");
    
    const masterUrl = `https://sheets.googleapis.com/v4/spreadsheets/${MASTER_SHEET_ID}/values/client_master!A:G`;
    
    const masterResponse = await fetch(masterUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!masterResponse.ok) {
      const errorBody = await masterResponse.text();
      console.error("❌ Google Sheets API Error:", {
        status: masterResponse.status,
        statusText: masterResponse.statusText,
        body: errorBody.substring(0, 300),
      });

      // Check if it's a scope issue
      if (masterResponse.status === 403) {
        return NextResponse.json(
          {
            error: "Permission denied",
            message: "Need to grant Google Sheets access. Please sign out and sign in again.",
          },
          { status: 403 }
        );
      }

      throw new Error(`Google Sheets API: ${masterResponse.status}`);
    }

    const masterData = await masterResponse.json();
    
    if (!masterData.values || masterData.values.length === 0) {
      console.error("❌ Master sheet is empty");
      return NextResponse.json(
        { error: "Master sheet is empty" },
        { status: 500 }
      );
    }

    const masterRows = masterData.values as any[][];
    console.log("✅ Master sheet fetched:", masterRows.length, "rows");
    console.log("   Header:", masterRows[0].join(" | "));

    // Step 6: Find client by email
    console.log("⏳ Step 6: Finding client for email:", userEmail);
    
    const clientRow = masterRows.find((row, idx) => {
      if (idx === 0) return false; // skip header
      const email = row[2]?.toString().toLowerCase() || "";
      return email === userEmail.toLowerCase();
    });

    if (!clientRow) {
      console.error("❌ Client not found for email:", userEmail);
      return NextResponse.json(
        { error: "User not found in system" },
        { status: 404 }
      );
    }

    const clientId = clientRow[0]?.toString() || "";
    const clientName = clientRow[1]?.toString() || "";
    const planType = clientRow[3]?.toString() || "";
    const status = clientRow[4]?.toString() || "";
    const expiresAt = clientRow[6]?.toString() || "";

    console.log("✅ Client found:", { clientId, clientName, status });

    // Step 7-8: Check status and expiry
    if (status.toUpperCase() !== "TRUE" && status.toUpperCase() !== "ACTIVE") {
      console.warn("❌ Account not active:", status);
      return NextResponse.json(
        { error: "Account is inactive" },
        { status: 403 }
      );
    }

    const expireDate = parseDate(expiresAt);
    if (expireDate && expireDate < new Date()) {
      console.warn("❌ Account expired:", expiresAt);
      return NextResponse.json(
        { error: "Subscription expired" },
        { status: 403 }
      );
    }

    console.log("✅ Account is active and not expired");

    // Step 9: Fetch modules
    console.log("⏳ Step 9: Fetching client_modules...");
    
    const modulesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${MASTER_SHEET_ID}/values/client_modules!A:I`;
    
    const modulesResponse = await fetch(modulesUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!modulesResponse.ok) {
      const errorBody = await modulesResponse.text();
      console.error("❌ Failed to fetch modules:", errorBody.substring(0, 300));
      throw new Error("Failed to fetch modules");
    }

    const modulesData = await modulesResponse.json();
    const modulesRows = modulesData.values as any[][] || [];
    
    console.log("✅ Modules sheet fetched:", modulesRows.length, "rows");
    if (modulesRows.length > 0) {
      console.log("   Header:", modulesRows[0].join(" | "));
    }

    // Step 10: Filter modules
    console.log("⏳ Step 10: Filtering modules for client:", clientId);
    
    const modules = modulesRows
      .slice(1) // skip header
      .filter((row) => {
        const mClientId = row[1]?.toString() || "";
        const isActive = row[6]?.toString().toUpperCase() === "TRUE";
        return mClientId === clientId && isActive;
      })
      .map((row) => ({
        moduleId: row[0]?.toString() || "",
        moduleName: row[2]?.toString() || "",
        spreadsheetId: row[3]?.toString() || "",
        sheetName: row[4]?.toString() || "",
        configName: row[5]?.toString() || "",
        dashboardConfigName: row[8]?.toString() || "",
        notes: row[7]?.toString() || "",
      }));

    console.log("✅ Filtered modules:", modules.length);
    modules.forEach((m) => {
      console.log(`   - ${m.moduleName} (${m.moduleId})`);
    });

    const response = {
      clientId,
      clientName,
      planType,
      expiresAt,
      modules,
    };

    console.log("=".repeat(50));
    console.log("✅ SUCCESS");
    console.log("=".repeat(50));

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("=".repeat(50));
    console.error("❌ ERROR:", error.message);
    console.error("=".repeat(50));

    return NextResponse.json(
      {
        error: "Server error",
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