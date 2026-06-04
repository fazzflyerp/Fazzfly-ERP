/**
 * GET /api/accounting/ar?spreadsheetId=
 *
 * คำนวณ AR (ลูกหนี้) จาก HelperS
 * outstanding = ราคา (ยอดเงิน) − sum(payment_* columns)
 *
 * HelperS hardcoded cols (0-based):
 *   A(0)  = วันที่
 *   F(5)  = ชื่อลูกค้า
 *   I(8)  = โปรแกรม
 *   AE(30)= ยอดเงิน (invoice total)
 *   AG(32)= สาขา
 *
 * Payment cols: อ่านจาก header row หาชื่อที่ match /^payment_\d+$/i
 * (ไม่นับ payment_type_*)
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange } from "@/lib/google-sa";

// HelperS fixed cols
const COL_DATE     = 0;
const COL_CUST     = 5;
const COL_PROG     = 8;
const COL_AMOUNT   = 30;
const COL_BRANCH   = 32;

function parseNum(v: any): number {
  const n = parseFloat((v ?? "").toString().replace(/,/g, "").replace(/[^\d.\-]/g, ""));
  return isNaN(n) ? 0 : n;
}

function normDateKey(raw: string): string {
  const s = (raw ?? "").toString().trim();
  // DD/MM/YYYY → yyyy-mm-dd
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2,"0")}-${m1[1].padStart(2,"0")}`;
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return "";
}

function agingBucket(dateKey: string, todayKey: string): "current" | "1-30" | "31-60" | "61+" {
  if (!dateKey || !todayKey) return "current";
  const days = Math.floor(
    (new Date(todayKey).getTime() - new Date(dateKey).getTime()) / 86400000
  );
  if (days <= 0)  return "current";
  if (days <= 30) return "1-30";
  if (days <= 60) return "31-60";
  return "61+";
}

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const spreadsheetId = request.nextUrl.searchParams.get("spreadsheetId");
  if (!spreadsheetId) return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });

  try {
    const rows = await saReadRange(spreadsheetId, "HelperS!A:AJ");
    if (rows.length < 2) return NextResponse.json({ items: [], summary: { total: 0, count: 0, aging: {} } });

    const headers = rows[0];

    // หา payment cols จาก header: payment_1, payment_2, ... (ไม่นับ payment_type_*)
    const paymentCols: number[] = [];
    headers.forEach((h, i) => {
      if (/^payment_\d+$/i.test((h ?? "").toString().trim())) paymentCols.push(i);
    });

    const todayKey = new Date().toISOString().slice(0, 10);

    const items: {
      customer: string; program: string; branch: string;
      date: string; dateKey: string;
      invoiceAmount: number; totalPaid: number; outstanding: number;
      aging: string;
    }[] = [];

    for (const row of rows.slice(1)) {
      const invoiceAmount = parseNum(row[COL_AMOUNT]);
      if (invoiceAmount <= 0) continue;

      const totalPaid = paymentCols.reduce((s, c) => s + parseNum(row[c]), 0);
      const outstanding = Math.round((invoiceAmount - totalPaid) * 100) / 100;
      if (outstanding <= 0) continue;

      const dateKey = normDateKey((row[COL_DATE] ?? "").toString());
      items.push({
        customer:      (row[COL_CUST]   ?? "").toString().trim() || "ไม่ระบุ",
        program:       (row[COL_PROG]   ?? "").toString().trim(),
        branch:        (row[COL_BRANCH] ?? "").toString().trim(),
        date:          (row[COL_DATE]   ?? "").toString().trim(),
        dateKey,
        invoiceAmount,
        totalPaid,
        outstanding,
        aging: agingBucket(dateKey, todayKey),
      });
    }

    // Summary
    const total = items.reduce((s, r) => s + r.outstanding, 0);
    const aging: Record<string, number> = { "current": 0, "1-30": 0, "31-60": 0, "61+": 0 };
    items.forEach((r) => { aging[r.aging] = (aging[r.aging] || 0) + r.outstanding; });

    // Group by customer
    const byCustomer: Record<string, {
      customer: string; totalOutstanding: number; count: number; oldestDate: string; aging: string; branches: string[];
    }> = {};
    for (const item of items) {
      if (!byCustomer[item.customer]) {
        byCustomer[item.customer] = {
          customer: item.customer, totalOutstanding: 0, count: 0, oldestDate: item.dateKey, aging: item.aging, branches: [],
        };
      }
      const g = byCustomer[item.customer];
      g.totalOutstanding += item.outstanding;
      g.count++;
      if (item.dateKey && item.dateKey < g.oldestDate) { g.oldestDate = item.dateKey; g.aging = item.aging; }
      if (item.branch && !g.branches.includes(item.branch)) g.branches.push(item.branch);
    }

    return NextResponse.json({
      items,
      byCustomer: Object.values(byCustomer).sort((a, b) => b.totalOutstanding - a.totalOutstanding),
      summary: { total: Math.round(total * 100) / 100, count: items.length, aging },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
