/**
 * Leave Days (สำหรับหักค่าคอมมิชชั่น) API
 * path: app/api/payroll/leave-days/route.ts
 *
 * บันทึกวันลาแบบระบุวันที่จริง เฉพาะพนักงานที่ได้ค่าคอมมิชชั่น (hardcode)
 * ใช้เก็บเตรียมไว้สำหรับหักยอดขายวันนั้นออกจากพูลคอมมิชชั่น ก่อนคำนวณ Payroll_Transaction!K
 *
 * GET    /api/payroll/leave-days?employee=&period=   → list entries
 * POST   /api/payroll/leave-days   { employee, leaveDate, note }  → add entry
 * DELETE /api/payroll/leave-days?rowIndex=            → remove entry
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saAppendRow, getSheetsClient, saInvalidateCache, saLog } from "@/lib/google-sa";

const PAYROLL_SPREADSHEET_ID = "1zdaX43I39RbnpKww0RhEutYnrnTH96xnbWHHzo2tYVU";
const SHEET_NAME = "Leave_Commission_Days";
const HEADERS = ["timestamp", "recorded_by", "employee_name", "nickname", "leave_date", "period", "note"];

// ✅ Hardcode: เฉพาะพนักงานที่ได้ค่าคอมมิชชั่น (เรท > 0% ใน Helper2)
const ELIGIBLE_EMPLOYEES: { name: string; nickname: string }[] = [
  { name: " นางสาว ไอลดา บังพรม ", nickname: "หลิน" },
  { name: " นาย นพปฎล มณีประเสริฐสิทธิ์ ", nickname: "เอกซ์" },
  { name: " นางสาว ปนัดดา คงพระจันทร์ ", nickname: "เดือน" },
];

const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function periodOf(dateStr: string): string {
  // dateStr: yyyy-mm-dd
  const [y, m] = dateStr.split("-").map(Number);
  return `${THAI_MONTHS_SHORT[m - 1]} ${y}`;
}

async function ensureSheet(spreadsheetId: string) {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = (meta.data.sheets || []).some((s) => s.properties?.title === SHEET_NAME);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: SHEET_NAME } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!A1:G1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADERS] },
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const employee = request.nextUrl.searchParams.get("employee")?.trim() || "";
    const period = request.nextUrl.searchParams.get("period")?.trim() || "";

    const rows = await saReadRange(PAYROLL_SPREADSHEET_ID, `${SHEET_NAME}!A:G`, 0);
    if (rows.length < 2) return NextResponse.json({ success: true, entries: [] });

    const entries = rows.slice(1)
      .map((r, i) => ({
        rowIndex: i + 2,
        timestamp: r[0] ?? "",
        recordedBy: r[1] ?? "",
        employeeName: (r[2] ?? "").toString().trim(),
        nickname: r[3] ?? "",
        leaveDate: r[4] ?? "",
        period: r[5] ?? "",
        note: r[6] ?? "",
      }))
      .filter((e) => e.employeeName)
      .filter((e) => !employee || e.employeeName === employee.trim())
      .filter((e) => !period || e.period === period)
      .sort((a, b) => (a.leaveDate < b.leaveDate ? 1 : -1));

    return NextResponse.json({ success: true, entries, eligibleEmployees: ELIGIBLE_EMPLOYEES });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userEmail = ((token as any)?.email as string) || "";

    const { employee, leaveDate, note } = await request.json();
    if (!employee || !leaveDate)
      return NextResponse.json({ error: "Missing employee or leaveDate" }, { status: 400 });

    const match = ELIGIBLE_EMPLOYEES.find((e) => e.name.trim() === employee.trim());
    if (!match)
      return NextResponse.json({ error: "พนักงานคนนี้ไม่ได้อยู่ในรายชื่อที่ได้ค่าคอมมิชชั่น" }, { status: 403 });

    if (!/^\d{4}-\d{2}-\d{2}$/.test(leaveDate))
      return NextResponse.json({ error: "รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น yyyy-mm-dd)" }, { status: 400 });

    await ensureSheet(PAYROLL_SPREADSHEET_ID);

    const row = [
      new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
      userEmail,
      match.name,
      match.nickname,
      leaveDate,
      periodOf(leaveDate),
      note || "",
    ];

    await saAppendRow(PAYROLL_SPREADSHEET_ID, `${SHEET_NAME}!A:G`, row);
    saInvalidateCache(PAYROLL_SPREADSHEET_ID);

    await saLog(PAYROLL_SPREADSHEET_ID, {
      email: userEmail,
      action: "LEAVE_DAY_ADD",
      module: SHEET_NAME,
      detail: `${match.name.trim()} - ${leaveDate}`,
    });

    return NextResponse.json({ success: true, entry: row });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userEmail = ((token as any)?.email as string) || "";

    const rowIndex = Number(request.nextUrl.searchParams.get("rowIndex"));
    if (!rowIndex || rowIndex < 2)
      return NextResponse.json({ error: "Missing/invalid rowIndex" }, { status: 400 });

    const sheets = getSheetsClient();
    const meta = await sheets.spreadsheets.get({ spreadsheetId: PAYROLL_SPREADSHEET_ID });
    const sheet = (meta.data.sheets || []).find((s) => s.properties?.title === SHEET_NAME);
    if (!sheet) return NextResponse.json({ error: "Sheet not found" }, { status: 404 });

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: PAYROLL_SPREADSHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: sheet.properties!.sheetId!,
              dimension: "ROWS",
              startIndex: rowIndex - 1,
              endIndex: rowIndex,
            },
          },
        }],
      },
    });

    saInvalidateCache(PAYROLL_SPREADSHEET_ID);
    await saLog(PAYROLL_SPREADSHEET_ID, {
      email: userEmail,
      action: "LEAVE_DAY_DELETE",
      module: SHEET_NAME,
      detail: `rowIndex=${rowIndex}`,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
