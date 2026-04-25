/**
 * GET  /api/crm/customers?spreadsheetId=xxx&sheetName=Customers
 * POST /api/crm/customers  { spreadsheetId, sheetName, action, row, rowIndex? }
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saAppendRow, saWriteRange, saInvalidateCache } from "@/lib/google-sa";

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const spreadsheetId = searchParams.get("spreadsheetId");
  const sheetName     = searchParams.get("sheetName") || "Customers";

  if (!spreadsheetId) return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });

  try {
    const values = await saReadRange(spreadsheetId, sheetName);
    if (values.length === 0) return NextResponse.json({ success: true, count: 0, customers: [] });

    const header    = values[0];
    const customers = values.slice(1)
      .map((row, i) => {
        const obj: any = { rowIndex: i + 2 };
        header.forEach((col: string, j: number) => { obj[col] = row[j] || ""; });
        obj.customer_id     = row[0]  || "";
        obj.full_name       = row[1]  || "";
        obj.phone_number    = row[2]  || "";
        obj.address         = row[3]  || "";
        obj.nickname        = row[5]  || "";
        obj.line_id         = row[6]  || "";
        obj.gender          = row[8]  || "";
        obj.birthdate       = row[9]  || "";
        obj.allergy         = row[10] || "";
        obj.medical_history = row[11] || "";
        obj.source          = row[12] || "";
        obj.member_level    = row[13] || "";
        obj.notes           = row[14] || "";
        obj.tax_id          = row[4]  || "";
        obj.email           = row[7]  || "";
        obj.skin_type       = "";
        return obj;
      })
      .filter((c: any) => c.customer_id);

    return NextResponse.json({ success: true, count: customers.length, customers });
  } catch (error: any) {
    console.error("❌ crm/customers GET:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { spreadsheetId, sheetName = "Customers", action, row, rowIndex } = body;
  if (!spreadsheetId) return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });

  try {
    if (action === "append") {
      await saAppendRow(spreadsheetId, `${sheetName}!A1`, row);
      saInvalidateCache(spreadsheetId);
      return NextResponse.json({ success: true, action: "append" });
    }

    if (action === "update") {
      await saWriteRange(spreadsheetId, `${sheetName}!A${rowIndex}`, [row]);
      saInvalidateCache(spreadsheetId);
      return NextResponse.json({ success: true, action: "update" });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("❌ crm/customers POST:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
