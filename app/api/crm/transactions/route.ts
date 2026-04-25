/**
 * GET /api/crm/transactions?spreadsheetId=&sheetName=&configName=&customerId=
 *
 * อ่าน Sales_Config → map field_name → actual column header ในชีท
 * แล้วกรองตาม cust_id ที่เป็น customer_id ตรงๆ (Helper_OPD col A = customer_id)
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
  const configName    = sp.get("configName")    || "Sales_Config";
  const customerId    = sp.get("customerId")    || "";

  if (!spreadsheetId) return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });
  if (!customerId)    return NextResponse.json({ error: "Missing customerId" }, { status: 400 });

  try {
    // โหลด config + transaction data พร้อมกัน
    const [configRows, txRows] = await Promise.all([
      saReadRange(spreadsheetId, `${configName}!A:H`).catch(() => [] as any[][]),
      saReadRange(spreadsheetId, sheetName),
    ]);

    if (txRows.length < 2) {
      return NextResponse.json({ success: true, transactions: [] });
    }

    // ── build field_name → label map จาก Sales_Config ───────────────────────
    // Sales_Config row: field_name | label | type | required | helper | order | section | repeatable
    const fieldLabelMap: Record<string, string> = {};
    if (configRows.length > 1) {
      const cfgHeaders = configRows[0].map((h: string) => (h || "").toString().toLowerCase().trim());
      const fnIdx  = cfgHeaders.indexOf("field_name");
      const lblIdx = cfgHeaders.indexOf("label");
      configRows.slice(1).forEach(r => {
        const fn  = (r[fnIdx]  || "").toString().trim();
        const lbl = (r[lblIdx] || "").toString().trim();
        if (fn && lbl) fieldLabelMap[fn] = lbl;
      });
    }

    // ── map tx headers (lowercase) ───────────────────────────────────────────
    const txHeaders = txRows[0].map((h: string) => (h || "").toString().toLowerCase().trim());

    // หา column index โดย: ลอง field_name ก่อน → ลอง label จาก config → ลอง aliases
    const findCol = (fieldName: string, aliases: string[] = []): number => {
      // 1. ตรงกับ field_name โดยตรง
      let idx = txHeaders.indexOf(fieldName.toLowerCase());
      if (idx !== -1) return idx;
      // 2. ตรงกับ label จาก config
      const lbl = (fieldLabelMap[fieldName] || "").toLowerCase().trim();
      if (lbl) { idx = txHeaders.indexOf(lbl); if (idx !== -1) return idx; }
      // 3. aliases fallback
      for (const a of aliases) {
        idx = txHeaders.indexOf(a.toLowerCase());
        if (idx !== -1) return idx;
      }
      // 4. partial match กับ label
      if (lbl) {
        idx = txHeaders.findIndex(h => h.includes(lbl) || lbl.includes(h));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const custCol    = findCol("cust_id",       ["opd", "hn", "patient_id", "customer_id"]);
    const dateCol    = findCol("date",           ["วันที่", "date"]);
    const programCol = findCol("program",        ["ชื่อโปรแกรม", "โปรแกรม"]);
    const qtyCol     = findCol("quantity",       ["จำนวน"]);
    const doctorCol  = findCol("doctor",         ["แพทย์", "เเพทย์", "หมอ"]);
    const staffCol   = findCol("staff",          ["พนักงาน bt", "bt", "บิวตี้"]);
    const usageCol   = findCol("program_usage",  ["ยังไม่ใช้", "ใช้คอร์ส"]);

    console.log(`📋 col map → cust:${custCol} date:${dateCol} prog:${programCol} qty:${qtyCol} doctor:${doctorCol} staff:${staffCol} usage:${usageCol}`);
    console.log(`📋 fieldLabelMap:`, fieldLabelMap);

    // cust_id ใน transactions เก็บ value จาก Helper_OPD col A ซึ่ง = customer_id ตรงๆ
    const transactions = txRows.slice(1)
      .filter(row => {
        if (custCol === -1) return false;
        const rowCustId = (row[custCol] || "").toString().trim();
        return rowCustId === customerId;
      })
      .map((row, i) => ({
        rowIndex:   i + 2,
        date:       dateCol    !== -1 ? (row[dateCol]    || "").toString().trim() : "",
        program:    programCol !== -1 ? (row[programCol] || "").toString().trim() : "",
        quantity:   qtyCol     !== -1 ? (row[qtyCol]     || "").toString().trim() : "",
        doctor:     doctorCol  !== -1 ? (row[doctorCol]  || "").toString().trim() : "",
        staff:      staffCol   !== -1 ? (row[staffCol]   || "").toString().trim() : "",
        // ยังไม่ใช้ = TRUE/✓ → ยังไม่ใช้คอร์ส, FALSE/"" → ใช้คอร์สแล้ว
        usedCourse: !(["true","1","✓","yes","TRUE"].includes((row[usageCol] || "").toString().trim())),
      }))
      .filter(t => t.date || t.program)
      .sort((a, b) => b.date.localeCompare(a.date));

    console.log(`✅ found ${transactions.length} tx for customerId="${customerId}" (custCol=${custCol})`);
    return NextResponse.json({ success: true, count: transactions.length, transactions });

  } catch (err: any) {
    console.error("❌ crm/transactions:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
