/**
 * GET  /api/crm/employees
 *   อ่านชีท "Employees" จาก MASTER_SHEET_ID แล้วกรองด้วย clientId ของ user
 *   ใช้ header row เพื่อ map columns อัตโนมัติ
 *
 *   Fields (ตาม config):
 *   staff_name | staff_id | position | nickname | base_salary | ot_cost
 *   late_cost | leave_cost | commission_amount | bank_account | start_date | end_date
 *
 *   ถ้ามี column client_id จะกรองให้อัตโนมัติ (รองรับชีทหลาย client)
 */
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange } from "@/lib/google-sa";

const MASTER_SHEET_ID = process.env.MASTER_SHEET_ID!;

function col(headers: string[], ...names: string[]): number {
  for (const n of names) {
    const i = headers.indexOf(n.toLowerCase().trim());
    if (i !== -1) return i;
  }
  return -1;
}

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // 1) clientId จาก client_user
    const userEmail = ((token as any)?.email as string || "").toLowerCase().trim();
    const userRows  = await saReadRange(MASTER_SHEET_ID, "client_user!A:E");
    const userRow   = userRows.slice(1).find(r => (r[1] ?? "").toString().toLowerCase().trim() === userEmail);
    if (!userRow) return NextResponse.json({ employees: [], hasEmployees: false });
    const clientId = (userRow[0] ?? "").toString().trim();

    // 2) อ่านชีท Employees จาก Master
    const values = await saReadRange(MASTER_SHEET_ID, "Employees");
    if (!values || values.length < 2) return NextResponse.json({ employees: [], hasEmployees: false });

    const headers = values[0].map((h: any) => (h ?? "").toString().toLowerCase().trim());

    const iClientId   = col(headers, "client_id",        "clientid");
    const iName       = col(headers, "staff_name",       "ชื่อพนักงาน");
    const iStaffId    = col(headers, "staff_id",          "id", "เลขบัตรประชาชน");
    const iPosition   = col(headers, "position",          "ตำแหน่ง");
    const iNickname   = col(headers, "nickname",          "ชื่อเล่น");
    const iEmail      = col(headers, "email",             "อีเมล");
    const iBaseSal    = col(headers, "base_salary",       "เงินเดือนพื้นฐาน (บาท)", "เงินเดือน");
    const iOt         = col(headers, "ot_cost",           "ค่าot(นาที)", "ค่าot");
    const iLate       = col(headers, "late_cost",         "ค่ามาสาย(นาที)", "ค่ามาสาย");
    const iLeave      = col(headers, "leave_cost",        "ค่าลางาน(วัน)", "ค่าลางาน");
    const iComm       = col(headers, "commission_amount", "ค่าคอม", "ค่าคอมมิชชั่น (%)");
    const iBank       = col(headers, "bank_account",      "ธนาคาร / เลขบัญชี", "เลขบัญชี / ธนาคาร");
    const iStart      = col(headers, "start_date",        "วันที่เริ่มงาน");
    const iEnd        = col(headers, "end_date",          "วันที่ออกจากงาน");
    const iLeaveQuota = col(headers, "leave_quota",       "โควต้าลา", "วันลาได้");

    function g(row: any[], idx: number) { return idx >= 0 ? (row[idx] ?? "").toString().trim() : ""; }
    function n(row: any[], idx: number) { const v = idx >= 0 ? Number(row[idx]) : NaN; return isNaN(v) ? 0 : v; }

    type EmpRow = {
      rowIndex: number; name: string; staffId: string; role: string; nickname: string;
      email: string; baseSalary: number; otCost: number; lateCost: number; leaveCost: number;
      commissionAmount: number; bankAccount: string; startDate: string; endDate: string;
      leave_quota: number;
    };

    const employees: EmpRow[] = values.slice(1)
      .map((row, ri): EmpRow | null => {
        if (iClientId >= 0 && (row[iClientId] ?? "").toString().trim() !== clientId) return null;
        const name = g(row, iName);
        if (!name) return null;
        let leave_quota = -1;
        if (iLeaveQuota >= 0) { leave_quota = Number(row[iLeaveQuota] ?? -1); if (isNaN(leave_quota)) leave_quota = -1; }
        return {
          rowIndex:         ri + 2,
          name,
          staffId:          g(row, iStaffId),
          role:             g(row, iPosition),
          nickname:         g(row, iNickname),
          email:            g(row, iEmail).toLowerCase(),
          baseSalary:       n(row, iBaseSal),
          otCost:           n(row, iOt),
          lateCost:         n(row, iLate),
          leaveCost:        n(row, iLeave),
          commissionAmount: n(row, iComm),
          bankAccount:      g(row, iBank),
          startDate:        g(row, iStart),
          endDate:          g(row, iEnd),
          leave_quota,
        };
      })
      .filter((e): e is EmpRow => e !== null);

    return NextResponse.json({ success: true, employees, hasEmployees: employees.length > 0 });

  } catch (err: any) {
    if (err.message?.includes("Unable to parse range") || err.message?.includes("not found") || err.message?.includes("badRequest")) {
      return NextResponse.json({ employees: [], hasEmployees: false });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
