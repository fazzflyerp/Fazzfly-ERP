/**
 * GET /api/expense/periods?spreadsheetId=&branchId=&sheetName=
 *
 * ถ้ามี sheetName → อ่าน period จากชีทนั้น (col A=period, col I idx8=branch_id)
 * ถ้าไม่มี sheetName → fallback อ่านจาก Payroll_Transaction (col A, col B)
 *
 * คืน unique periods เรียงจากใหม่ → เก่า (MM/YYYY desc)
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange } from "@/lib/google-sa";

const EXPENSE_BRANCH_COL = 8; // col I (0-based) ใน Expense sheet

const THAI_MM: Record<string, string> = {
  "ม.ค.": "01", "ก.พ.": "02", "มี.ค.": "03", "เม.ย.": "04",
  "พ.ค.": "05", "มิ.ย.": "06", "ก.ค.": "07", "ส.ค.": "08",
  "ก.ย.": "09", "ต.ค.": "10", "พ.ย.": "11", "ธ.ค.": "12",
};
const normP = (p: string): string => {
  const s = p.trim();
  for (const [th, mm] of Object.entries(THAI_MM)) {
    if (s.includes(th)) { const y = s.replace(th, "").trim(); if (y) return `${mm}/${y}`; }
  }
  const parts = s.split("/");
  return parts.length === 2 ? `${parts[0].padStart(2, "0")}/${parts[1]}` : s;
};

function sortPeriodDesc(a: string, b: string) {
  const parse = (s: string) => {
    const [m, y] = s.split("/");
    return parseInt(y || "0") * 100 + parseInt(m || "0");
  };
  return parse(b) - parse(a);
}

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const spreadsheetId = searchParams.get("spreadsheetId");
    const branchId      = searchParams.get("branchId") || "";
    const sheetName     = searchParams.get("sheetName") || "";

    if (!spreadsheetId)
      return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });

    const seen = new Set<string>();

    if (sheetName) {
      // อ่านจากชีทที่กำหนด — col A = period, col I (idx 8) = branch_id
      let rows: any[][];
      try {
        rows = await saReadRange(spreadsheetId, `${sheetName}!A:I`);
      } catch {
        return NextResponse.json({ periods: [] });
      }
      if (rows.length < 2) return NextResponse.json({ periods: [] });

      // detect header row: ถ้า row[0] ไม่ใช่ period format ให้ skip
      const firstVal = (rows[0]?.[0] ?? "").toString().trim();
      const hasHeader = isNaN(Number(firstVal.split("/")[0])) || firstVal.includes("/") === false || !/^\d{2}\/\d{4}$/.test(firstVal);
      const dataRows  = hasHeader ? rows.slice(1) : rows;

      dataRows.forEach((r: any[]) => {
        const rowPeriod = normP((r[0] ?? "").toString().trim());
        const rowBranch = (r[EXPENSE_BRANCH_COL] ?? "").toString().trim().toLowerCase();
        if (!rowPeriod) return;
        if (branchId && rowBranch !== branchId.toLowerCase()) return;
        seen.add(rowPeriod);
      });
    } else {
      // Fallback: Payroll_Transaction col A=period, col B=branch_id
      let rows: any[][];
      try {
        rows = await saReadRange(spreadsheetId, "Payroll_Transaction!A:B");
      } catch {
        return NextResponse.json({ periods: [] });
      }
      if (rows.length < 2) return NextResponse.json({ periods: [] });

      rows.slice(1).forEach((r: any[]) => {
        const rowPeriod = normP((r[0] ?? "").toString().trim());
        const rowBranch = (r[1] ?? "").toString().trim().toLowerCase();
        if (!rowPeriod) return;
        if (branchId && rowBranch !== branchId.toLowerCase()) return;
        seen.add(rowPeriod);
      });
    }

    const periods = Array.from(seen).sort(sortPeriodDesc);
    return NextResponse.json({ periods });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
