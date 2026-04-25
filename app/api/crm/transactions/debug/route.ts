/**
 * GET /api/crm/transactions/debug?spreadsheetId=&sheetName=&customerId=
 * ดูข้อมูลดิบเพื่อ debug ว่า format ไม่ตรงกันตรงไหน
 */
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange } from "@/lib/google-sa";

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp            = request.nextUrl.searchParams;
  const spreadsheetId = sp.get("spreadsheetId") || "";
  const sheetName     = sp.get("sheetName")     || "Sales Transactions";
  const customerId    = sp.get("customerId")    || "";

  if (!spreadsheetId) return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });

  try {
    const [txRows, opdRows] = await Promise.all([
      saReadRange(spreadsheetId, sheetName),
      saReadRange(spreadsheetId, "Helper_OPD!A:C").catch(() => [] as any[][]),
    ]);

    // tx headers + first 10 rows
    const txHeaders = txRows[0] || [];
    const txSample  = txRows.slice(1, 11).map(r => Object.fromEntries(txHeaders.map((h: string, i: number) => [h, r[i]])));

    // Helper_OPD first 20 rows raw
    const opdSample = opdRows.slice(0, 20).map(r => ({ col_A: r[0], col_B: r[1], col_C: r[2] }));

    // ถ้ามี customerId ให้หา match ใน Helper_OPD
    let opdMatch = null;
    if (customerId && opdRows.length > 1) {
      const firstCell = (opdRows[0][0] || "").toString().toLowerCase();
      const dataRows  = (firstCell === "value" || isNaN(Number(firstCell))) ? opdRows.slice(1) : opdRows;
      opdMatch = dataRows.find(r => (r[1] || "").toString().trim() === customerId) || null;
    }

    // unique cust_id values ใน tx sheet (first 50 unique)
    const custColIdx = txHeaders.findIndex((h: string) => h.toLowerCase() === "cust_id");
    const uniqueCustIds = [...new Set(txRows.slice(1).map(r => (r[custColIdx] || "").toString().trim()))].slice(0, 50);

    return NextResponse.json({
      txHeaders,
      txSample,
      opdSample,
      opdMatch,
      uniqueCustIds,
      searchedCustomerId: customerId,
      custColIdx,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
