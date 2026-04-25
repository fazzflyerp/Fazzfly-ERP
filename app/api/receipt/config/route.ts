/**
 * Receipt Config API — ดึง field config สำหรับใบเสร็จ
 * path: app/api/receipt/config/route.ts
 *
 * GET /api/receipt/config?spreadsheetId=&configName=
 *   → อ่าน config sheet แล้วคืน fields[] สำหรับ render ฟอร์มออกใบเสร็จ
 *   → columns: fieldName | label | type | order
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange } from "@/lib/google-sa";

interface ReceiptConfigField {
  fieldName: string;
  label: string;
  type: string;
  order: number | null;
}

export async function GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);

  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const spreadsheetId = searchParams.get("spreadsheetId");
    const configName = searchParams.get("configName");

    if (!spreadsheetId || !configName) {
      return NextResponse.json({ error: "Missing required parameters", code: "MISSING_PARAMS" }, { status: 400 });
    }

    const rows = await saReadRange(spreadsheetId, `${configName}!A:Z`);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Config sheet is empty", code: "EMPTY_CONFIG" }, { status: 404 });
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    const columnIndices = {
      fieldName: headers.findIndex((h: string) => h.toLowerCase() === "field_name"),
      label:     headers.findIndex((h: string) => h.toLowerCase() === "label"),
      type:      headers.findIndex((h: string) => h.toLowerCase() === "type"),
      order:     headers.findIndex((h: string) => h.toLowerCase() === "order"),
    };

    const missingColumns = (Object.keys(columnIndices) as (keyof typeof columnIndices)[])
      .filter((k) => columnIndices[k] === -1);

    if (missingColumns.length > 0) {
      return NextResponse.json({ error: "Invalid config structure", code: "MISSING_COLUMNS", missingColumns }, { status: 500 });
    }

    const configFields: ReceiptConfigField[] = dataRows
      .filter((row: any[]) => row[columnIndices.fieldName])
      .map((row: any[]) => {
        const orderValue = row[columnIndices.order]?.toString().trim();
        return {
          fieldName: row[columnIndices.fieldName]?.toString().trim() || "",
          label:     row[columnIndices.label]?.toString().trim() || "",
          type:      row[columnIndices.type]?.toString().trim() || "text",
          order:     orderValue && orderValue !== "" ? parseInt(orderValue) : null,
        };
      });

    console.log(`✅ [${requestId}] receipt/config — ${configFields.length} fields`);

    return NextResponse.json({ success: true, spreadsheetId, configName, fields: configFields, count: configFields.length });

  } catch (error: any) {
    console.error(`❌ [${requestId}] receipt/config:`, error.message);
    return NextResponse.json({ error: "Internal server error", message: error.message }, { status: 500 });
  }
}
