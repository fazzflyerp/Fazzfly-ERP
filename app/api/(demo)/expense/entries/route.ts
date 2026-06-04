/**
 * GET  /api/expense/entries?spreadsheetId=&sheetName=&period=&branchId=
 * POST /api/expense/entries  — บันทึก expense entry
 * DELETE /api/expense/entries — ลบ entry (SA / ADMIN only)
 *
 * ชีท Expense: header row กำหนด column position
 * branch_id อยู่ที่ column I (index 8) เสมอ
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saAppendRow, saUpdateRow, saGetSheetMeta, saStructuralBatchUpdate, saInvalidateCache, saBatchUpdate } from "@/lib/google-sa";

const BRANCH_ID_COL = 8; // column I (0-based)

async function getRole(email: string): Promise<string> {
  try {
    const { saReadRange: read } = await import("@/lib/google-sa");
    const sid  = process.env.MASTER_SHEET_ID!;
    const rows = await read(sid, "client_user!A:C");
    const found = rows.slice(1).find((r: any[]) => (r[1] ?? "").toString().toLowerCase().trim() === email);
    return found ? (found[2] ?? "STAFF").toString().trim().toUpperCase() : "STAFF";
  } catch { return "STAFF"; }
}

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const spreadsheetId = searchParams.get("spreadsheetId");
    const sheetName     = searchParams.get("sheetName") || "Expense_Data";
    const period        = searchParams.get("period") || "";
    const branchId      = searchParams.get("branchId") || "";

    if (!spreadsheetId) return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });

    const rows = await saReadRange(spreadsheetId, `${sheetName}!A:Z`);
    if (rows.length < 2) return NextResponse.json({ entries: [], headers: rows[0] ?? [] });

    const headers = rows[0].map((h: any) => (h ?? "").toString().trim());

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
    const normPeriod = normP(period);

    // หา index ของ period column และ date column จาก header
    const periodColIdx = headers.findIndex((h: string) =>
      ["period", "งวด", "เดือน", "month"].includes(h.toLowerCase().trim())
    );
    const dateColIdx = headers.findIndex((h: string) => {
      const l = h.toLowerCase().trim();
      return l === "วันที่" || l === "date" || l.startsWith("วันที่") || l === "วันที่ทำรายการ";
    });

    const entries = rows.slice(1)
      .map((r: any[], i: number) => {
        const rowBranch = (r[BRANCH_ID_COL] ?? "").toString().trim().toLowerCase();

        // หา period จาก: 1) col A  2) period column  3) derive จาก date column
        let rowPeriod = normP((r[0] ?? "").toString().trim());
        if (!rowPeriod && periodColIdx > 0) {
          rowPeriod = normP((r[periodColIdx] ?? "").toString().trim());
        }
        if (!rowPeriod && dateColIdx >= 0) {
          const dv = (r[dateColIdx] ?? "").toString().trim();
          const dm = dv.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          if (dm) rowPeriod = `${dm[2].padStart(2, "0")}/${dm[3]}`;
        }

        const matchPeriod = !normPeriod || rowPeriod === normPeriod;
        const matchBranch = !branchId   || rowBranch === branchId.toLowerCase();
        if (!matchPeriod || !matchBranch) return null;

        const obj: Record<string, any> = { _rowIndex: i + 1 };
        headers.forEach((h: string, ci: number) => { obj[h || `col_${ci}`] = (r[ci] ?? "").toString(); });
        return obj;
      })
      .filter(Boolean);

    return NextResponse.json({ entries, headers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { spreadsheetId, sheetName = "Expense_Data", period, branchId, fields } = body;

    if (!spreadsheetId || !period || !branchId)
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    // Read header row
    const rows = await saReadRange(spreadsheetId, `${sheetName}!A1:Z1`, 0);
    const headerRow: string[] = (rows[0] ?? []).map((h: any) => (h ?? "").toString().trim().toLowerCase());

    // Build row array matching header order
    // Minimum length to cover column I (index 8)
    const maxCols = Math.max(headerRow.length, BRANCH_ID_COL + 1);
    const row: any[] = new Array(maxCols).fill("");

    // col A = สูตร Period ใน Google Sheets — ไม่เขียนทับ

    // Fill branch_id at col I
    row[BRANCH_ID_COL] = branchId;

    // Fill timestamp
    const tsCol = headerRow.findIndex((h) => h === "created_at" || h === "timestamp" || h === "วันที่บันทึก");
    if (tsCol >= 0) {
      const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
      const pad = (n: number) => n.toString().padStart(2, "0");
      row[tsCol] = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    }

    // Fill created_by
    const byCol = headerRow.findIndex((h) => h === "created_by" || h === "บันทึกโดย");
    if (byCol >= 0) row[byCol] = (token.email as string).toLowerCase().trim();

    // Fill dynamic config fields
    if (fields && typeof fields === "object") {
      Object.entries(fields as Record<string, any>).forEach(([key, value]) => {
        const ci = headerRow.findIndex((h) => h === key.toLowerCase());
        if (ci >= 0) row[ci] = value ?? "";
      });
    }

    await saAppendRow(spreadsheetId, `${sheetName}!A:Z`, row);
    saInvalidateCache(spreadsheetId);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { spreadsheetId, sheetName = "Expense_Data", rowIndex, fields } = await request.json();
    if (!spreadsheetId || !rowIndex || !fields)
      return NextResponse.json({ error: "Missing params" }, { status: 400 });

    // Read header row (bypass cache) — เริ่มจาก B เพื่อ map index ที่ถูกต้อง แต่ต้องนับ offset จาก A
    const rows = await saReadRange(spreadsheetId, `${sheetName}!A1:Z1`, 0);
    const headerRow: string[] = (rows[0] ?? []).map((h: any) => (h ?? "").toString().trim().toLowerCase());

    const sheetRow = rowIndex + 2; // +1 for header, +1 for 1-based

    // หา col index ของแต่ละ field ที่จะแก้ (ข้าม col A = index 0 เสมอ)
    const cellUpdates: Array<{ col: number; value: any }> = [];
    if (fields && typeof fields === "object") {
      Object.entries(fields as Record<string, any>).forEach(([key, value]) => {
        const ci = headerRow.findIndex((h) => h === key.toLowerCase());
        if (ci > 0) cellUpdates.push({ col: ci, value: value ?? "" }); // ci > 0 = skip col A
      });
    }

    if (!cellUpdates.length) return NextResponse.json({ ok: true });

    // batch เขียนแค่ cell ที่เปลี่ยน (ไม่แตะ col A และไม่ overwrite cell อื่น)
    await saBatchUpdate(spreadsheetId, cellUpdates.map(({ col, value }) => ({
      range: `${sheetName}!${String.fromCharCode(65 + col)}${sheetRow}`,
      values: [[value]],
    })));
    saInvalidateCache(spreadsheetId);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email = (token.email as string).toLowerCase().trim();
    const role  = await getRole(email);
    if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { spreadsheetId, sheetName = "Expense_Data", rowIndex } = await request.json();
    if (!spreadsheetId || !rowIndex) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const { sheetId } = await saGetSheetMeta(spreadsheetId, sheetName);
    await saStructuralBatchUpdate(spreadsheetId, [{
      deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex + 1 } },
    }]);

    saInvalidateCache(spreadsheetId);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
