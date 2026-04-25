/**
 * Payroll Upsert Row API
 * POST /api/payroll/upsert-row
 *
 * Submit payroll data — ถ้ามีแถวพนักงานคนนั้นอยู่แล้วในเดือนเดียวกัน → UPDATE
 * ถ้ายังไม่มี → INSERT ใหม่
 * date field → auto-fill ด้วย timestamp วันนี้ (ไม่ต้องกรอก)
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saUpdateRow, saAppendRow, saLog, saInvalidateCache } from "@/lib/google-sa";
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
  return period.trim().split(/\s+/)[0];
}

function colLetter(n: number): string {
  let letter = "";
  while (n > 0) {
    n--;
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26);
  }
  return letter;
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((token as any).error === "RefreshAccessTokenError")
      return NextResponse.json({ error: "Session expired", code: "TOKEN_EXPIRED" }, { status: 401 });

    const userEmail = ((token as any)?.email as string || "").toLowerCase();
    const { spreadsheetId, sheetName, fields, formData } = await request.json();

    if (!spreadsheetId || !sheetName || !fields || !formData)
      return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const access = await verifySheetAccess(userEmail, spreadsheetId);
    if (!access.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const lineItems: any[] = formData.lineItems || [];
    if (lineItems.length === 0)
      return NextResponse.json({ error: "No data" }, { status: 400 });

    // หา fields ที่สำคัญ
    const empField    = fields.find((f: any) => {
      const fn = (f.fieldName || "").toLowerCase();
      const lb = (f.label || "").toLowerCase();
      return fn.includes("employee") || lb.includes("พนักงาน");
    });
    const periodField = fields.find((f: any) => f.type === "period");
    const dateField   = fields.find((f: any) => f.type === "date");

    const getColIdx = (f: any) => (f?.order ? f.order - 1 : -1);
    const empColIdx    = getColIdx(empField);
    const periodColIdx = getColIdx(periodField);
    const dateColIdx   = getColIdx(dateField);
    const maxOrder     = Math.max(...fields.map((f: any) => f.order || 1));
    const lastColLetter = colLetter(maxOrder);

    const period   = currentPeriod();
    const curMonth = monthKey(period);
    const today    = todayStr();

    // อ่านข้อมูล sheet ทั้งหมด (bypass cache)
    const existing = await saReadRange(spreadsheetId, `${sheetName}!A:${lastColLetter}`, 0);
    const dataRows = existing.length > 1 ? existing.slice(1) : [];

    const results: { employee: string; action: "updated" | "inserted"; rowIndex?: number }[] = [];

    for (const item of lineItems) {
      // สร้าง row array จาก fields + order
      const row = Array(maxOrder).fill("");
      for (const f of fields) {
        const colIdx = getColIdx(f);
        if (colIdx < 0 || colIdx >= maxOrder) continue;
        if (f.type === "date") {
          row[colIdx] = today; // auto-fill timestamp
        } else if (f.type === "period") {
          row[colIdx] = item[f.fieldName] || period; // ใช้ค่าจาก form หรือ current period
        } else {
          row[colIdx] = item[f.fieldName] ?? "";
        }
      }

      const empValue = empColIdx >= 0 ? (row[empColIdx] || "").toString().trim() : "";

      // หาแถวที่ match: พนักงานคนนั้น + เดือนเดียวกัน
      let matchRowIndex = -1;
      if (empValue && empColIdx >= 0 && periodColIdx >= 0) {
        for (let i = 0; i < dataRows.length; i++) {
          const rowEmp    = (dataRows[i][empColIdx] || "").toString().trim();
          const rowPeriod = (dataRows[i][periodColIdx] || "").toString().trim();
          if (rowEmp === empValue && monthKey(rowPeriod) === curMonth) {
            matchRowIndex = i + 2; // +1 header, +1 for 1-based
            break;
          }
        }
      }

      if (matchRowIndex > 0) {
        // UPDATE existing row
        await saUpdateRow(spreadsheetId, `${sheetName}!A${matchRowIndex}:${lastColLetter}${matchRowIndex}`, row);
        results.push({ employee: empValue, action: "updated", rowIndex: matchRowIndex });
      } else {
        // INSERT new row
        await saAppendRow(spreadsheetId, `${sheetName}!A:A`, row);
        results.push({ employee: empValue, action: "inserted" });
      }
    }

    saInvalidateCache(spreadsheetId);

    await saLog(spreadsheetId, {
      email:   userEmail,
      action:  "PAYROLL_UPSERT",
      module:  sheetName,
      detail:  results.map(r => `${r.employee}:${r.action}`).join(", "),
    });

    return NextResponse.json({ success: true, results, period });

  } catch (error: any) {
    console.error("❌ [payroll/upsert-row]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
