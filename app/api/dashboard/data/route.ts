/**
 * Dashboard Data API - Fixed to handle multiple periods
 * Location: app/api/dashboard/data/route.ts
 * ✅ FIXED: Handle multiple period params properly
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

interface ConfigField {
  fieldName: string;
  label: string;
  type: string;
  order: number;
}

function parseConfigSheet(configRows: any[][]): ConfigField[] {
  const header = configRows[0];
  const fieldNameIdx = header.findIndex((h) => h.toLowerCase().includes("field"));
  const labelIdx = header.findIndex((h) => h.toLowerCase().includes("label"));
  const typeIdx = header.findIndex((h) => h.toLowerCase().includes("type"));
  const orderIdx = header.findIndex((h) => h.toLowerCase().includes("order"));

  return configRows.slice(1).map((row) => ({
    fieldName: row[fieldNameIdx] || "",
    label: row[labelIdx] || "",
    type: row[typeIdx] || "text",
    order: Number(row[orderIdx] || 0),
  }));
}

function parseDataSheetByColumnIndex(
  dataRows: any[][],
  configFields: ConfigField[]
): any[] {
  if (!dataRows || dataRows.length < 2) return [];
  const dataRowsWithoutHeader = dataRows.slice(1);

  return dataRowsWithoutHeader.map((row) => {
    const record: any = {};
    configFields.forEach((field) => {
      const colIndex = field.order - 1;
      record[field.fieldName] =
        colIndex >= 0 && colIndex < row.length ? row[colIndex] || "" : "";
    });
    return record;
  });
}

function normalizeDate(dateStr: string): string | null {
  if (!dateStr) return null;

  const val = String(dateStr).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return val;
  }

  const parts = val.split(/[\/\-]/);
  if (parts.length === 3) {
    const [first, second, third] = parts.map((p) => parseInt(p, 10));

    let year: number, month: number, day: number;

    if (third > 99) {
      year = third;
      if (first > 12) {
        day = first;
        month = second;
      } else if (second > 12) {
        month = first;
        day = second;
      } else {
        month = first;
        day = second;
      }
    } else if (first > 99) {
      year = first;
      month = second;
      day = third;
    } else {
      if (first > 12) {
        day = first;
        month = second;
      } else if (second > 12) {
        month = first;
        day = second;
      } else {
        month = first;
        day = second;
      }
      year =
        third < 100 ? (third > 50 ? 1900 + third : 2000 + third) : third;
    }

    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900) {
      return null;
    }

    const m = String(month).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${year}-${m}-${d}`;
  }

  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${dd}`;
    }
  } catch (e) {
    // fallback
  }

  return null;
}

function filterByDateRange(
  data: any[],
  dateFieldName: string,
  startDate?: string,
  endDate?: string
): any[] {
  if (!startDate && !endDate) return data;

  const sNorm = startDate ? normalizeDate(startDate) : null;
  const eNorm = endDate ? normalizeDate(endDate) : null;

  if (!sNorm && !eNorm) return data;

  return data.filter((row) => {
    const rawVal = String(row[dateFieldName] || "").trim();
    if (!rawVal) return false;

    const vNorm = normalizeDate(rawVal);
    if (!vNorm) return false;

    if (sNorm && eNorm && sNorm === eNorm) {
      return vNorm === sNorm;
    }

    if (sNorm && eNorm) {
      return vNorm >= sNorm && vNorm <= eNorm;
    }

    if (sNorm && !eNorm) {
      return vNorm >= sNorm;
    }

    if (!sNorm && eNorm) {
      return vNorm <= eNorm;
    }

    return true;
  });
}

export async function GET(request: NextRequest) {
  try {
    console.log("=".repeat(60));
    console.log("📊 START: Fetching unified dashboard data");

    const { searchParams } = new URL(request.url);
    const spreadsheetId = searchParams.get("spreadsheetId");
    const configSheetName = searchParams.get("configSheetName");
    const dataSheetName = searchParams.get("dataSheetName");
    const year = searchParams.get("year");
    const archiveSpreadsheetId = searchParams.get("archiveSpreadsheetId");
    const periods = searchParams.getAll("period"); // ✅ Get ALL period params
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!spreadsheetId || !configSheetName || !dataSheetName) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token || !(token as any)?.accessToken) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const accessToken = (token as any).accessToken as string;

    console.log("📋 Query Parameters (periods/dates ignored - filtered client-side):");
    console.log("   Year:", year || "Current");
    if (periods.length > 0) console.log("   ⚠️  Periods (ignored):", periods);
    if (startDate || endDate) console.log("   ⚠️  Date range (ignored):", { startDate, endDate });

    // ============================================================
    // Step 1: Fetch config sheet
    // ============================================================
    console.log("⏳ Step 1: Fetching config sheet...");

    const configUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(configSheetName)}!A:D`;
    const configResponse = await fetch(configUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!configResponse.ok) {
      throw new Error(`Failed to fetch config sheet: ${configResponse.status}`);
    }

    const configData = await configResponse.json();
    const configRows = configData.values as any[][] | undefined;
    if (!configRows || configRows.length === 0) {
      throw new Error("Config sheet is empty");
    }

    const configFields = parseConfigSheet(configRows);
    console.log(`✅ Loaded ${configFields.length} config fields`);

    // ============================================================
    // Step 2: Fetch data sheet
    // ============================================================
    const targetSpreadsheetId = archiveSpreadsheetId || spreadsheetId;
    const sourceType = archiveSpreadsheetId ? `Archive (Year: ${year})` : "Main";

    console.log(`⏳ Step 2: Fetching data sheet from ${sourceType}...`);

    const dataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${targetSpreadsheetId}/values/${encodeURIComponent(dataSheetName)}`;
    const dataResponse = await fetch(dataUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!dataResponse.ok) {
      throw new Error(`Failed to fetch data sheet: ${dataResponse.status}`);
    }

    const dataSheetData = await dataResponse.json();
    const dataRows = dataSheetData.values as any[][] | undefined;
    if (!dataRows || dataRows.length === 0) {
      throw new Error("Data sheet is empty");
    }

    // ============================================================
    // Step 3: Map data
    // ============================================================
    console.log("⏳ Step 3: Mapping data according to config...");
    let parsedData = parseDataSheetByColumnIndex(dataRows, configFields);
    console.log(`✅ Parsed ${parsedData.length} records`);

    // ============================================================
    // Step 4: Return ALL data (NO filtering)
    // ============================================================
    // ✅ Component handles period + date filtering
    // ✅ API just returns all data

    // ============================================================
    // Step 5: Return response
    // ============================================================
    const response = {
      config: configFields,
      data: parsedData,
      metadata: {
        source: sourceType,
        year: year || null,
        totalRecords: parsedData.length,
        note: "Period and Date filtering handled client-side",
      },
    };

    console.log("✅ SUCCESS: Data ready");
    console.log(`   Source: ${sourceType}`);
    console.log(`   Total records: ${parsedData.length}`);
    console.log("=".repeat(60));

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("❌ ERROR:", error.message);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data", message: error.message },
      { status: 500 }
    );
  }
}