/**
 * Commission Adjust (หักค่าคอมมิชชั่นวันลา) API
 * path: app/api/payroll/commission-adjust/route.ts
 *
 * อ่านค่า Commission (K) ที่คำนวณอยู่แล้วใน Payroll_Transaction (มาจากสูตร ARRAYFORMULA เดิม)
 * แล้วหักสัดส่วนยอดขายของวันที่พนักงานลาออก โดย "ไม่แก้" สูตร/คอลัมน์ K เดิมเลย —
 * เขียนผลลัพธ์ลงคอลัมน์ใหม่ต่อท้าย (S/T/U) แทน เพื่อไม่เสี่ยงพัง ARRAYFORMULA ที่ครอบทั้งคอลัมน์อยู่
 *
 * สูตรหัก: deduction = (ยอดขายวันที่ลา / ยอดขายรวมย้อนหลัง 1 เดือน [I]) * Commission เดิม [K]
 *   → ใช้เรทที่ "ล็อกไว้แล้ว" ของงวดนั้น (K/I) คูณกับยอดขายวันที่ลา
 *
 * ตีความ (ข) ที่ยืนยันแล้ว: วันลาที่บันทึกไว้ (period = เดือนปฏิทินของวันลานั้น) หักออกจาก
 * Commission ของ "งวด Payroll เดียวกับเดือนที่ลา" ตรงๆ (ไม่สนใจว่า Commission งวดนั้นจริงๆ
 * คำนวณจากยอดขายเดือนก่อนหน้า)
 *
 * GET  /api/payroll/commission-adjust?period=ก.ค.%202026        → preview (ไม่เขียน)
 * POST /api/payroll/commission-adjust  { period, confirm:true } → คำนวณ + เขียนคอลัมน์ใหม่จริง
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saBatchUpdate, saGetSheetMeta, saInvalidateCache, saLog } from "@/lib/google-sa";

const PAYROLL_SPREADSHEET_ID = "1zdaX43I39RbnpKww0RhEutYnrnTH96xnbWHHzo2tYVU";
const TRANSACTION_SHEET = "Payroll_Transaction";
const LEAVE_SHEET = "Leave_Commission_Days";

// Payroll_Transaction columns (0-indexed, A=0)
const COL = { period: 0, employee: 1, salesTotal: 8, pool: 9, commission: 10 };
// New app-written columns (S,T,U → 1-indexed letters)
const NEW_COL_LETTERS = { deduction: "S", newCommission: "T", leaveDatesUsed: "U" };

const ELIGIBLE_EMPLOYEES = [
  " นางสาว ไอลดา บังพรม ",
  " นาย นพปฎล มณีประเสริฐสิทธิ์ ",
  " นางสาว ปนัดดา คงพระจันทร์ ",
].map((s) => s.trim());

function parseNum(v: any): number {
  if (v === null || v === undefined) return 0;
  const n = Number(String(v).replace(/[,\s]/g, ""));
  return isNaN(n) ? 0 : n;
}

// Helper!B stores dates as "d/m/yyyy"; leaveDate is "yyyy-mm-dd"
function toDMY(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return `${d}/${m}/${y}`;
}

async function computeAdjustments(period: string) {
  const [txRows, leaveRows, helperRows] = await Promise.all([
    saReadRange(PAYROLL_SPREADSHEET_ID, `${TRANSACTION_SHEET}!A:K`, 0),
    saReadRange(PAYROLL_SPREADSHEET_ID, `${LEAVE_SHEET}!A:G`, 0),
    saReadRange(PAYROLL_SPREADSHEET_ID, `Helper!A:O`, 0),
  ]);

  const leaveEntries = leaveRows.slice(1).filter(
    (r) => (r[5] ?? "").toString().trim() === period
  );

  const results: any[] = [];

  for (const empName of ELIGIBLE_EMPLOYEES) {
    // หาแถวใน Payroll_Transaction ของพนักงานคนนี้ ในงวดนี้
    let rowIndex = -1;
    let txRow: any[] = [];
    for (let i = 1; i < txRows.length; i++) {
      const r = txRows[i];
      if (
        (r[COL.period] ?? "").toString().trim() === period &&
        (r[COL.employee] ?? "").toString().trim() === empName
      ) {
        rowIndex = i + 1; // 1-based sheet row
        txRow = r;
        break;
      }
    }

    if (rowIndex === -1) {
      results.push({ employee: empName, found: false });
      continue;
    }

    const salesTotal = parseNum(txRow[COL.salesTotal]);
    const commission = parseNum(txRow[COL.commission]);

    const myLeaveEntries = leaveEntries.filter(
      (r) => (r[2] ?? "").toString().trim() === empName
    );

    let deductionTotal = 0;
    const leaveDetail: { date: string; daySales: number; deduction: number }[] = [];

    for (const entry of myLeaveEntries) {
      const leaveDate = (entry[4] ?? "").toString().trim(); // yyyy-mm-dd
      const dmy = toDMY(leaveDate);
      const daySales = helperRows
        .slice(1)
        .filter((r) => (r[1] ?? "").toString().trim() === dmy)
        .reduce((sum, r) => sum + parseNum(r[14]), 0); // Helper!O = ราคาปกติ

      const dayDeduction = salesTotal > 0 ? (daySales / salesTotal) * commission : 0;
      deductionTotal += dayDeduction;
      leaveDetail.push({ date: leaveDate, daySales, deduction: Math.round(dayDeduction * 100) / 100 });
    }

    const newCommission = Math.max(0, Math.round((commission - deductionTotal) * 100) / 100);

    results.push({
      employee: empName,
      found: true,
      rowIndex,
      period,
      salesTotal,
      commission,
      leaveDetail,
      deductionTotal: Math.round(deductionTotal * 100) / 100,
      newCommission,
    });
  }

  return results;
}

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const period = request.nextUrl.searchParams.get("period")?.trim();
    if (!period) return NextResponse.json({ error: "Missing period" }, { status: 400 });

    const results = await computeAdjustments(period);
    return NextResponse.json({ success: true, period, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userEmail = ((token as any)?.email as string) || "";

    const { period, confirm } = await request.json();
    if (!period) return NextResponse.json({ error: "Missing period" }, { status: 400 });
    if (!confirm) return NextResponse.json({ error: "Missing confirm:true — this writes to the live payroll sheet" }, { status: 400 });

    const results = await computeAdjustments(period);
    const writable = results.filter((r) => r.found);

    if (writable.length === 0)
      return NextResponse.json({ success: true, period, results, message: "ไม่พบแถวที่ต้องเขียน" });

    const data = writable.map((r) => ({
      range: `${TRANSACTION_SHEET}!${NEW_COL_LETTERS.deduction}${r.rowIndex}:${NEW_COL_LETTERS.leaveDatesUsed}${r.rowIndex}`,
      values: [[
        r.deductionTotal,
        r.newCommission,
        r.leaveDetail.map((d: any) => d.date).join(", "),
      ]],
    }));

    // เขียน header ของคอลัมน์ใหม่ไว้ด้วย (เผื่อยังไม่เคยเขียนมาก่อน)
    data.push({
      range: `${TRANSACTION_SHEET}!${NEW_COL_LETTERS.deduction}1:${NEW_COL_LETTERS.leaveDatesUsed}1`,
      values: [["หักคอมจากวันลา (App)", "Commission สุทธิหลังหักวันลา (App)", "วันลาที่ใช้คำนวณ (App)"]],
    });

    await saBatchUpdate(PAYROLL_SPREADSHEET_ID, data);
    saInvalidateCache(PAYROLL_SPREADSHEET_ID);

    await saLog(PAYROLL_SPREADSHEET_ID, {
      email: userEmail,
      action: "COMMISSION_ADJUST_WRITE",
      module: TRANSACTION_SHEET,
      detail: `period=${period}, employees=${writable.map((r) => r.employee.trim()).join("|")}`,
    });

    return NextResponse.json({ success: true, period, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
