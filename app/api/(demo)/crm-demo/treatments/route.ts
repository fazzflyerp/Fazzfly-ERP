/**
 * GET  /api/crm-demo/treatments?spreadsheetId=&sheetName=CRM_Treatments&branchId=
 * POST /api/crm-demo/treatments  { spreadsheetId, sheetName, action, row, rowIndex? }
 *
 * Sheet: CRM_Treatments
 * cols: treatment_id | created_at | customer_id | customer_name | customer_phone |
 *       appointment_id | branch_id | branch_name | treatment_date | service | doctor |
 *       price | notes | before_photo | after_photo | created_by
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saAppendRow, saWriteRange, saInvalidateCache } from "@/lib/google-sa";

const DEFAULT_SHEET = "CRM_Treatments";

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp            = request.nextUrl.searchParams;
  const spreadsheetId = sp.get("spreadsheetId");
  const sheetName     = sp.get("sheetName")  || DEFAULT_SHEET;
  const branchId      = sp.get("branchId")   || "";
  const customerId    = sp.get("customerId") || "";

  if (!spreadsheetId) return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });

  try {
    const values = await saReadRange(spreadsheetId, sheetName).catch(() => [] as any[][]);

    let treatments = values.slice(1)
      .map((row, i) => ({
        rowIndex:       i + 2,
        treatment_id:   row[0]  || "",
        created_at:     row[1]  || "",
        customer_id:    row[2]  || "",
        customer_name:  row[3]  || "",
        customer_phone: row[4]  || "",
        appointment_id: row[5]  || "",
        branch_id:      row[6]  || "",
        branch_name:    row[7]  || "",
        treatment_date: row[8]  || "",
        service:        row[9]  || "",
        doctor:         row[10] || "",
        price:          Number(row[11]) || 0,
        notes:          row[12] || "",
        before_photo:   row[13] || "",
        after_photo:    row[14] || "",
        created_by:     row[15] || "",
      }))
      .filter(t => t.treatment_id);

    if (branchId)    treatments = treatments.filter(t => t.branch_id   === branchId);
    if (customerId)  treatments = treatments.filter(t => t.customer_id === customerId);

    treatments.sort((a, b) => b.treatment_date.localeCompare(a.treatment_date));

    return NextResponse.json({ success: true, count: treatments.length, treatments });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { spreadsheetId, sheetName = DEFAULT_SHEET, action, row, rowIndex } = body;
  if (!spreadsheetId) return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });
  if (!action)        return NextResponse.json({ error: "Missing action" },        { status: 400 });

  try {
    if (action === "append") {
      if (!row || !Array.isArray(row)) return NextResponse.json({ error: "Missing row" }, { status: 400 });
      await saAppendRow(spreadsheetId, `${sheetName}!A1`, row);
      saInvalidateCache(spreadsheetId);
      return NextResponse.json({ success: true, action: "append" });
    }
    if (action === "update") {
      if (!rowIndex || !row) return NextResponse.json({ error: "Missing rowIndex or row" }, { status: 400 });
      await saWriteRange(spreadsheetId, `${sheetName}!A${rowIndex}`, [row]);
      saInvalidateCache(spreadsheetId);
      return NextResponse.json({ success: true, action: "update" });
    }
    return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
