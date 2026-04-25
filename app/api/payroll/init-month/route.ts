/**
 * Payroll Init Month API
 * POST /api/payroll/init-month
 *
 * เรียกเมื่อเปิด payroll form — สร้างแถว skeleton (timestamp + ชื่อพนักงาน) สำหรับเดือนปัจจุบัน
 * ถ้าเดือนนี้มีแถวอยู่แล้ว → ข้ามทุกคนที่มีแล้ว (ไม่ duplicate)
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saAppendRows, saInvalidateCache } from "@/lib/google-sa";
import { verifySheetAccess } from "@/lib/verify-sheet-access";

const THAI_MONTHS_SHORT = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

function currentPeriod(): string {
  const now = new Date();
  return `${THAI_MONTHS_SHORT[now.getMonth()]} ${now.getFullYear()}`;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function monthKey(period: string): string {
  // "เม.ย. 2026" → "เม.ย."  |  "เมษายน 2026" → "เมษายน"
  return period.trim().split(/\s+/)[0];
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((token as any).error === "RefreshAccessTokenError")
      return NextResponse.json({ error: "Session expired", code: "TOKEN_EXPIRED" }, { status: 401 });

    const userEmail = ((token as any)?.email as string || "").toLowerCase();
    const { spreadsheetId, sheetName, fields } = await request.json();

    if (!spreadsheetId || !sheetName || !fields)
      return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const access = await verifySheetAccess(userEmail, spreadsheetId);
    if (!access.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // หา employee field, period field, date field จาก config
    const empField = fields.find((f: any) => {
      const fn = (f.fieldName || "").toLowerCase();
      const lb = (f.label || "").toLowerCase();
      return fn.includes("employee") || lb.includes("พนักงาน");
    });
    const periodField = fields.find((f: any) => f.type === "period");
    const dateField   = fields.find((f: any) => f.type === "date");

    if (!empField || !empField.helper)
      return NextResponse.json({ skipped: true, reason: "No employee dropdown with helper found" });

    // ดึง employee list จาก helper
    const helperRows = await saReadRange(spreadsheetId, `${empField.helper}!A:B`);
    const HEADER_KW  = ["id","name","label","ชื่อ","รหัส"];
    const firstRow   = helperRows[0] || [];
    const hasHeader  = firstRow.some((c: any) => HEADER_KW.includes((c || "").toString().trim().toLowerCase()));
    const empRows    = hasHeader ? helperRows.slice(1) : helperRows;
    const employees  = empRows.map((r: any[]) => (r[0] || "").toString().trim()).filter(Boolean);

    if (employees.length === 0)
      return NextResponse.json({ skipped: true, reason: "Employee list is empty" });

    // อ่านข้อมูล sheet ปัจจุบัน
    const period  = currentPeriod();
    const curMonth = monthKey(period);
    const existing = await saReadRange(spreadsheetId, `${sheetName}!A:AZ`, 0);
    const dataRows = existing.length > 1 ? existing.slice(1) : [];

    // หา colIndex จาก order (order - 1)
    const getColIdx = (f: any) => f?.order ? f.order - 1 : -1;
    const empColIdx    = getColIdx(empField);
    const periodColIdx = getColIdx(periodField);

    // พนักงานที่มีแถวอยู่แล้วในเดือนนี้
    const alreadyInited = new Set<string>();
    if (empColIdx >= 0 && periodColIdx >= 0) {
      for (const row of dataRows) {
        const rowEmp    = (row[empColIdx] || "").toString().trim();
        const rowPeriod = (row[periodColIdx] || "").toString().trim();
        if (rowEmp && monthKey(rowPeriod) === curMonth) {
          alreadyInited.add(rowEmp);
        }
      }
    }

    // พนักงานที่ยังไม่มีแถว
    const toInit = employees.filter((e: string) => !alreadyInited.has(e));
    if (toInit.length === 0)
      return NextResponse.json({ skipped: true, reason: "All employees already initialized", period });

    // หา maxOrder เพื่อกำหนดขนาด row
    const maxOrder = Math.max(...fields.map((f: any) => f.order || 1));
    const dateColIdx   = getColIdx(dateField);
    const today        = todayStr();

    const newRows = toInit.map((empName: string) => {
      const row = Array(maxOrder).fill("");
      if (dateColIdx >= 0 && dateColIdx < maxOrder)   row[dateColIdx]   = today;
      if (empColIdx >= 0 && empColIdx < maxOrder)     row[empColIdx]    = empName;
      if (periodColIdx >= 0 && periodColIdx < maxOrder) row[periodColIdx] = period;
      return row;
    });

    await saAppendRows(spreadsheetId, `${sheetName}!A:A`, newRows);
    saInvalidateCache(spreadsheetId);

    return NextResponse.json({ initialized: true, period, count: newRows.length, employees: toInit });

  } catch (error: any) {
    console.error("❌ [payroll/init-month]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
