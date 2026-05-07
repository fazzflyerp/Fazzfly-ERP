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

    // หา column index: exact field_name → exact label → exact aliases → ห้าม partial match เพื่อป้องกัน false positive
    const findCol = (fieldName: string, aliases: string[] = []): number => {
      const allTerms = [fieldName.toLowerCase(), (fieldLabelMap[fieldName] || "").toLowerCase().trim(), ...aliases.map(a => a.toLowerCase())].filter(Boolean);
      for (const term of allTerms) {
        const idx = txHeaders.indexOf(term);
        if (idx !== -1) return idx;
      }
      // partial match เฉพาะ label ที่ยาวพอ (≥3 chars) เพื่อลด false positive
      const lbl = (fieldLabelMap[fieldName] || "").toLowerCase().trim();
      if (lbl.length >= 3) {
        const idx = txHeaders.findIndex(h => h === lbl || (h.length >= 3 && (h.startsWith(lbl) || lbl.startsWith(h))));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const custCol    = findCol("cust_id",        ["opd", "hn", "patient_id", "customer_id"]);
    const dateCol    = findCol("date",            ["วันที่", "date", "วันที่รักษา", "วันที่ทำรายการ", "วันที่บันทึก", "วันที่ใช้บริการ", "ว/ด/ป", "วัน", "transaction_date", "tx_date"]);
    let statusCol = findCol("program_status", ["สถานะ", "ประเภท", "ประเภทรายการ", "ประเภทบริการ", "ประเภทการใช้บริการ", "ประเภทสมาชิก", "status", "type", "transaction_type"]);
    // auto-detect: ถ้าหา header ไม่เจอ scan ค่าทุกแถว (ไม่จำกัด) หา "ตัด Member" หรือ "เปิดMember"
    if (statusCol === -1) {
      const memberKw = /ตัด\s*member|เปิด\s*member/i;
      const allDataRows = txRows.slice(1);
      for (let ci = 0; ci < (txRows[0]?.length ?? 0); ci++) {
        const hits = allDataRows.filter(r => memberKw.test((r[ci] ?? "").toString())).length;
        if (hits >= 1) { statusCol = ci; break; }
      }
    }
    const programCol = findCol("program",         ["ชื่อโปรแกรม (เลือก)", "ชื่อโปรแกรม", "โปรแกรม"]);
    const qtyCol     = findCol("quantity",        ["จำนวน"]);
    const priceCol   = findCol("price",           ["จำนวนเงิน", "ราคา", "amount"]);
    const doctorCol  = findCol("doctor",          ["แพทย์", "เเพทย์", "หมอ"]);
    const staffCol   = findCol("staff",           ["พนักงาน bt", "bt", "บิวตี้"]);
    const usageCol   = findCol("program_usage",   ["ยังไม่ใช้", "ใช้คอร์ส"]);

    // cust_id ใน transactions เก็บ value จาก Helper_OPD col A ซึ่ง = customer_id ตรงๆ
    const parseNum = (v: any) => {
      const s = (v ?? "").toString().replace(/,/g, "").trim();
      const n = parseFloat(s);
      return isNaN(n) ? 0 : n;
    };

    console.log(`📋 [CRM-TX] spreadsheetId=${spreadsheetId.slice(-6)} customerId="${customerId}"`);
    console.log(`📋 [CRM-TX] cols → cust:${custCol} date:${dateCol} status:${statusCol} prog:${programCol} qty:${qtyCol} price:${priceCol}`);
    console.log(`📋 [CRM-TX] headers[0..20]:`, txHeaders.slice(0, 20));
    console.log(`📋 [CRM-TX] totalRows=${txRows.length - 1} statusCol=${statusCol}`);

    const allCustRows = txRows.slice(1).filter(row => {
      if (custCol === -1) return false;
      return (row[custCol] || "").toString().trim() === customerId;
    });
    console.log(`📋 [CRM-TX] rows for custId="${customerId}": ${allCustRows.length}`);
    allCustRows.slice(0, 10).forEach((row, i) => {
      console.log(`  row[${i}] → status="${(row[statusCol] ?? "N/A").toString().slice(0,30)}" prog="${(row[programCol] ?? "N/A").toString().slice(0,30)}" price="${(row[priceCol] ?? "N/A")}" date="${(row[dateCol] ?? "N/A").toString().slice(0,15)}"`);
    });

    const transactions = allCustRows
      .map((row, i) => ({
        rowIndex:       i + 2,
        date:           dateCol    !== -1 ? (row[dateCol]    || "").toString().trim() : "",
        program_status: statusCol  !== -1 ? (row[statusCol]  || "").toString().trim() : "",
        program:        programCol !== -1 ? (row[programCol] || "").toString().trim() : "",
        quantity:       parseNum(qtyCol   !== -1 ? row[qtyCol]   : 0),
        price:          parseNum(priceCol !== -1 ? row[priceCol] : 0),
        doctor:         doctorCol  !== -1 ? (row[doctorCol]  || "").toString().trim() : "",
        staff:          staffCol   !== -1 ? (row[staffCol]   || "").toString().trim() : "",
        usedCourse: !(["true","1","✓","yes","TRUE"].includes((row[usageCol] || "").toString().trim())),
      }))
      .filter(t => t.date || t.program)
      .sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({
      success: true, count: transactions.length, transactions,
      _debug: {
        cols: { cust: custCol, date: dateCol, status: statusCol, prog: programCol, qty: qtyCol, price: priceCol, staff: staffCol, doctor: doctorCol },
        headers: txHeaders.slice(0, 30),
        sampleRaw: transactions[0] ? { price: transactions[0].price, qty: transactions[0].quantity, prog: transactions[0].program, status: transactions[0].program_status } : null,
      },
    });

  } catch (err: any) {
    console.error("❌ crm/transactions:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
