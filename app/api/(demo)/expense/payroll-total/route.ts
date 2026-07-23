/**
 * GET /api/expense/payroll-total?spreadsheetId=&period=&branchId=
 * ดึงยอดรวมเงินเดือนพนักงานจาก Payroll_Transaction
 * - col A (idx 0)  = period
 * - col B  (idx 1)  = branch_id
 * - col Q  (idx 16) = สุทธิ (net pay)
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange } from "@/lib/google-sa";

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const spreadsheetId  = searchParams.get("spreadsheetId");
    const period         = searchParams.get("period") || "";
    const branchId       = searchParams.get("branchId") || "";
    const payrollSheet   = searchParams.get("payrollSheet") || "Helper payroll";

    if (!spreadsheetId)
      return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });

    const rows = await saReadRange(spreadsheetId, `${payrollSheet}!A:AJ`).catch(() => [] as any[][]);
    if (rows.length === 0) return NextResponse.json({ total: 0, count: 0, sheetMissing: true });
    if (rows.length < 2)   return NextResponse.json({ total: 0, count: 0 });

    const THAI_MM: Record<string, string> = {
      "ม.ค.": "01", "ก.พ.": "02", "มี.ค.": "03", "เม.ย.": "04",
      "พ.ค.": "05", "มิ.ย.": "06", "ก.ค.": "07", "ส.ค.": "08",
      "ก.ย.": "09", "ต.ค.": "10", "พ.ย.": "11", "ธ.ค.": "12",
    };
    const normP = (p: string): string => {
      const s = p.trim();
      for (const [th, mm] of Object.entries(THAI_MM)) {
        if (s.includes(th)) {
          const y = s.replace(th, "").trim();
          if (y) return `${mm}/${y}`;
        }
      }
      const parts = s.split("/");
      return parts.length === 2 ? `${parts[0].padStart(2, "0")}/${parts[1]}` : s;
    };
    const normPeriod = normP(period);

    // หา column index จาก header row อัตโนมัติ
    const headers = (rows[0] ?? []).map((h: any) => (h ?? "").toString().trim().toLowerCase());
    const branchCol = headers.findIndex((h: string) => h === "branch_id" || h === "สาขา" || h === "branch");
    const netPayCol = headers.findIndex((h: string) =>
      h.includes("รวมรายได้") || h === "สุทธิ" || h.includes("net") || h.includes("รวมสุทธิ")
    );

    // fallback ถ้าหา header ไม่เจอ
    const bColBase = branchCol >= 0 ? branchCol : 30;
    const nColBase = netPayCol >= 0 ? netPayCol : 27;

    // ชีทบางอันมี hidden column ที่ API อ่านได้แต่ไม่อยู่ใน header row
    // เทียบ data row length vs header length แล้ว offset อัตโนมัติ
    const firstDataRow = rows[1] ?? [];
    const colOffset = Math.max(0, firstDataRow.length - headers.length);
    const bCol = bColBase + colOffset;
    const nCol = nColBase + colOffset;

    const data = rows.slice(1).filter((r: any[]) => {
      const rowPeriod   = normP((r[0] ?? "").toString().trim());
      const rowBranchId = (r[bCol] ?? "").toString().trim().toLowerCase();
      const matchPeriod  = !normPeriod || rowPeriod === normPeriod;
      const matchBranch  = !branchId   || rowBranchId === branchId.toLowerCase();
      return matchPeriod && matchBranch;
    });

    const total = data.reduce((sum: number, r: any[]) => sum + (Number(r[nCol]) || 0), 0);

    const sample = rows.slice(1, 4).map((r: any[]) => ({
      p: normP((r[0] ?? "").toString().trim()),
      b: (r[bCol] ?? "").toString().trim(),
      net: r[nCol],
    }));

    // dump header row พร้อม index เพื่อ debug
    const headerDump = headers.map((h: string, i: number) => `${i}:${h}`).join(", ");

    return NextResponse.json({ total, count: data.length, period, normPeriod, branchId, colOffset, bCol, nCol, sample, headerDump });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
