/**
 * GET /api/crm-demo/transactions?spreadsheetId=&sheetName=&configName=&customerId=
 *
 * Demo version of /api/crm/transactions
 * เพิ่ม: อ่าน branch_name จาก col AG (index 32)
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saAppendRow, saInvalidateCache } from "@/lib/google-sa";

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp            = request.nextUrl.searchParams;
  const spreadsheetId = sp.get("spreadsheetId") || "";
  const sheetName     = sp.get("sheetName")     || "Sales Transactions";
  const configName    = sp.get("configName")    || "Sales_Config";
  const customerId    = sp.get("customerId")    || "";

  if (!spreadsheetId) return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });
  if (!customerId)    return NextResponse.json({ error: "Missing customerId"    }, { status: 400 });

  try {
    const [configRows, txRows] = await Promise.all([
      saReadRange(spreadsheetId, `${configName}!A:H`).catch(() => [] as any[][]),
      saReadRange(spreadsheetId, sheetName),
    ]);

    if (txRows.length < 2) return NextResponse.json({ success: true, transactions: [] });

    // build field_name → label map
    const fieldLabelMap: Record<string, string> = {};
    if (configRows.length > 1) {
      const cfgH   = configRows[0].map((h: string) => (h || "").toString().toLowerCase().trim());
      const fnIdx  = cfgH.indexOf("field_name");
      const lblIdx = cfgH.indexOf("label");
      configRows.slice(1).forEach(r => {
        const fn  = (r[fnIdx]  || "").toString().trim();
        const lbl = (r[lblIdx] || "").toString().trim();
        if (fn && lbl) fieldLabelMap[fn] = lbl;
      });
    }

    const txHeaders = txRows[0].map((h: string) => (h || "").toString().toLowerCase().trim());

    const findCol = (fieldName: string, aliases: string[] = []): number => {
      const allTerms = [fieldName.toLowerCase(), (fieldLabelMap[fieldName] || "").toLowerCase().trim(), ...aliases.map(a => a.toLowerCase())].filter(Boolean);
      for (const term of allTerms) {
        const idx = txHeaders.indexOf(term);
        if (idx !== -1) return idx;
      }
      const lbl = (fieldLabelMap[fieldName] || "").toLowerCase().trim();
      if (lbl.length >= 3) {
        const idx = txHeaders.findIndex(h => h === lbl || (h.length >= 3 && (h.startsWith(lbl) || lbl.startsWith(h))));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const custCol    = findCol("cust_id",        ["opd", "hn", "patient_id", "customer_id"]);
    const dateCol    = findCol("date",            ["วันที่", "date", "วันที่รักษา", "วันที่ทำรายการ", "วันที่บันทึก", "วันที่ใช้บริการ", "ว/ด/ป", "วัน", "transaction_date", "tx_date"]);
    let   statusCol  = findCol("program_status",  ["สถานะ", "ประเภท", "ประเภทรายการ", "ประเภทบริการ", "ประเภทการใช้บริการ", "ประเภทสมาชิก", "status", "type", "transaction_type"]);
    const programCol = findCol("program",         ["ชื่อโปรแกรม (เลือก)", "ชื่อโปรแกรม", "โปรแกรม"]);
    const qtyCol     = findCol("quantity",        ["จำนวน"]);
    const priceCol   = findCol("price",           ["จำนวนเงิน", "ราคา", "amount"]);
    const doctorCol  = findCol("doctor",          ["แพทย์", "เเพทย์", "หมอ"]);
    const staffCol   = findCol("staff",           ["พนักงาน bt", "bt", "บิวตี้"]);
    const usageCol          = findCol("program_usage",   ["ยังไม่ใช้", "ใช้คอร์ส"]);
    const memberPaymentCol  = findCol("payment_10",      ["ใช้ member", "member"]);

    // Col AG = index 32 → branch_name (written by submit-sales-branch)
    const branchNameCol = 32;

    // fix statusCol if no member data
    const memberKw = /ตัด\s*member|เปิด\s*member/i;
    const allDataRows = txRows.slice(1);
    const hasMemberData = (ci: number) => allDataRows.some(r => memberKw.test((r[ci] ?? "").toString()));
    if (statusCol === -1 || !hasMemberData(statusCol)) {
      let found = -1;
      for (let ci = 0; ci < (txRows[0]?.length ?? 0); ci++) {
        if (hasMemberData(ci)) { found = ci; break; }
      }
      if (found !== -1) statusCol = found;
    }

    const parseNum = (v: any) => {
      const s = (v ?? "").toString().replace(/,/g, "").trim();
      const n = parseFloat(s);
      return isNaN(n) ? 0 : n;
    };

    const allCustRows = txRows.slice(1).filter(row => {
      if (custCol === -1) return false;
      return (row[custCol] || "").toString().trim() === customerId;
    });

    const transactions = allCustRows
      .map((row, i) => ({
        rowIndex:       i + 2,
        date:           dateCol       !== -1 ? (row[dateCol]       || "").toString().trim() : "",
        program_status: statusCol     !== -1 ? (row[statusCol]     || "").toString().trim() : "",
        program:        programCol    !== -1 ? (row[programCol]    || "").toString().trim() : "",
        quantity:       parseNum(qtyCol     !== -1 ? row[qtyCol]   : 0),
        price:          parseNum(priceCol   !== -1 ? row[priceCol] : 0),
        doctor:         doctorCol     !== -1 ? (row[doctorCol]     || "").toString().trim() : "",
        staff:          staffCol      !== -1 ? (row[staffCol]      || "").toString().trim() : "",
        usedCourse:      !(["true","1","✓","yes","TRUE"].includes((row[usageCol] || "").toString().trim())),
        branch_name:    (row[branchNameCol]                                        || "").toString().trim(),
        member_payment: parseNum(memberPaymentCol !== -1 ? row[memberPaymentCol] : 0),
      }))
      .filter(t => t.date || t.program)
      .sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({ success: true, count: transactions.length, transactions });

  } catch (err: any) {
    console.error("❌ crm-demo/transactions:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── POST — บันทึก Return / Transfer entries ──────────────────────────────────
// Body: { spreadsheetId, sheetName?, configName?, entries: TxWriteEntry[] }
// TxWriteEntry: { customerId, customerName?, date, programStatus, program, quantity, price, notes?, branchName? }
export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const {
    spreadsheetId,
    sheetName   = "Sales Transactions",
    configName  = "Sales_Config",
    entries,
  } = body;

  if (!spreadsheetId)  return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });
  if (!entries?.length) return NextResponse.json({ error: "Missing entries"       }, { status: 400 });

  try {
    // 1. Read config + header row in parallel
    const [configRows, headerRows] = await Promise.all([
      saReadRange(spreadsheetId, `${configName}!A:H`).catch(() => [] as any[][]),
      saReadRange(spreadsheetId, `${sheetName}!1:1`).catch(() => [[]] as any[][]),
    ]);

    const txHeaders = ((headerRows[0] as any[]) || [])
      .map((h: any) => (h ?? "").toString().toLowerCase().trim());

    // field_name → label map from config
    const fieldLabelMap: Record<string, string> = {};
    if (configRows.length > 1) {
      const cfgH   = (configRows[0] as any[]).map((h: any) => (h ?? "").toString().toLowerCase().trim());
      const fnIdx  = cfgH.indexOf("field_name");
      const lblIdx = cfgH.indexOf("label");
      (configRows.slice(1) as any[][]).forEach(r => {
        const fn  = (r[fnIdx]  ?? "").toString().trim();
        const lbl = (r[lblIdx] ?? "").toString().trim();
        if (fn && lbl) fieldLabelMap[fn] = lbl;
      });
    }

    const findCol = (fieldName: string, aliases: string[] = []): number => {
      const lbl = (fieldLabelMap[fieldName] || "").toLowerCase().trim();
      const terms = [fieldName.toLowerCase(), lbl, ...aliases.map(a => a.toLowerCase())].filter(Boolean);
      for (const term of terms) {
        const idx = txHeaders.indexOf(term);
        if (idx !== -1) return idx;
      }
      if (lbl.length >= 3) {
        const idx = txHeaders.findIndex((h: string) =>
          h === lbl || (h.length >= 3 && (h.startsWith(lbl) || lbl.startsWith(h)))
        );
        if (idx !== -1) return idx;
      }
      return -1;
    };

    // Detect columns (same aliases as GET)
    const colMap = {
      custId:        findCol("cust_id",        ["opd","hn","patient_id","customer_id"]),
      custName:      findCol("customer_name",  ["ชื่อลูกค้า","ชื่อ-นามสกุล","ชื่อ","name"]),
      date:          findCol("date",           ["วันที่","วันที่รักษา","วันที่ทำรายการ","วันที่บันทึก","transaction_date","tx_date"]),
      status:        findCol("program_status", ["สถานะ","ประเภท","ประเภทรายการ","ประเภทบริการ","status","type","transaction_type"]),
      program:       findCol("program",        ["ชื่อโปรแกรม (เลือก)","ชื่อโปรแกรม","โปรแกรม"]),
      qty:           findCol("quantity",       ["จำนวน"]),
      price:         findCol("price",          ["จำนวนเงิน","ราคา","amount"]),
      notes:         findCol("notes",          ["หมายเหตุ","remark","remarks","note","หมายเหตุเพิ่มเติม"]),
      memberPayment: findCol("payment_10",     ["ใช้ member","member"]),
    };

    const rowLen = Math.max(33, ...Object.values(colMap).filter((v): v is number => v >= 0)) + 1;

    const buildRow = (entry: any): any[] => {
      const row = Array(rowLen).fill("");
      const set = (col: number, val: any) => { if (col >= 0) row[col] = val ?? ""; };
      set(colMap.custId,        entry.customerId    ?? "");
      set(colMap.custName,      entry.customerName  ?? "");
      set(colMap.date,          entry.date          ?? "");
      set(colMap.status,        entry.programStatus ?? "");
      set(colMap.program,       entry.program       ?? "");
      set(colMap.qty,           entry.quantity      ?? 0);
      set(colMap.price,         entry.price         ?? 0);
      set(colMap.notes,         entry.notes         ?? "");
      set(colMap.memberPayment, entry.memberPayment ?? "");
      row[32] = entry.branchName ?? "";  // col AG = branch_name (fixed)
      return row;
    };

    // Append each entry sequentially (avoid race condition on sheet)
    for (const entry of entries) {
      const row = buildRow(entry);
      await saAppendRow(spreadsheetId, `${sheetName}!A1`, row);
    }

    try { (saInvalidateCache as any)?.(); } catch {}

    return NextResponse.json({ success: true, count: entries.length });
  } catch (err: any) {
    console.error("❌ crm-demo/transactions POST:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
