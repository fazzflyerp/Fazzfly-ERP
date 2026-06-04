/**
 * GET /api/ar/sales-picker?from=YYYY-MM-DD&to=YYYY-MM-DD&spreadsheetId=?&includeAll=?
 *
 * ดึงรายการขาย (HelperS) เพื่อให้หน้า AR เลือกสร้างลูกหนี้
 *
 * หา spreadsheet อัตโนมัติ (ลำดับ priority):
 *   1. query param  ?spreadsheetId=  (override)
 *   2. client_db    → dbSheetId
 *   3. client_dashboard → spreadsheetId ของ dashboard ที่ active
 *
 * HelperS hardcoded cols (0-based) — เหมือนกับ /api/accounting/ar:
 *   A(0)  = วันที่
 *   F(5)  = ชื่อลูกค้า
 *   G(6)  = เบอร์โทร (ถ้ามี)
 *   I(8)  = โปรแกรม
 *   AE(30)= ยอดเงิน (invoice total)
 *   AG(32)= สาขา
 *   payment_* cols = หาจาก header row อัตโนมัติ
 *
 * Query params:
 *   from          YYYY-MM-DD  ตั้งแต่วันที่
 *   to            YYYY-MM-DD  ถึงวันที่
 *   spreadsheetId (optional)  override spreadsheet ที่จะอ่าน
 *   includeAll    "true"       แสดงทุกรายการ ไม่กรอง outstanding > 0
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange } from "@/lib/google-sa";
import { getInvAccess } from "@/lib/inv-access";

const MASTER_SHEET_ID = process.env.MASTER_SHEET_ID!;

const COL_DATE   = 0;
const COL_CUST   = 5;
const COL_PHONE  = 6;
const COL_PROG   = 8;
const COL_AMOUNT = 30;
const COL_BRANCH = 32;

const MAX_ROWS = 500;

function parseNum(v: any): number {
  const n = parseFloat((v ?? "").toString().replace(/,/g, "").replace(/[^\d.\-]/g, ""));
  return isNaN(n) ? 0 : n;
}

function normDate(raw: string): string {
  const s = (raw ?? "").toString().trim();
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return "";
}

function extractId(raw: string): string {
  const match = raw.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  return raw.trim().split("/edit")[0].split("?")[0].trim();
}

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access) return NextResponse.json({ error: "User not found" }, { status: 403 });

    const isSA = access.role === "SUPER_ADMIN";
    const sp   = request.nextUrl.searchParams;
    const from       = sp.get("from")         || "";
    const to         = sp.get("to")           || "";
    const includeAll = sp.get("includeAll")   === "true";
    const overrideId = sp.get("spreadsheetId") || "";

    // ── หา spreadsheet ที่มี HelperS ─────────────────────────────────────────
    // ลองตามลำดับ: override → dbSheetId → client_dashboard (ทุก entry)
    // หยุดทันทีที่พบ HelperS จริง

    // รวม candidates
    const candidates: string[] = [];
    if (overrideId) candidates.push(extractId(overrideId));
    if (access.dbSheetId) candidates.push(access.dbSheetId);

    // เพิ่ม client_dashboard spreadsheetIds ทั้งหมดที่ active
    const dashRows = await saReadRange(MASTER_SHEET_ID, "client_dashboard!A:I", 0)
      .catch(() => [] as any[][]);
    dashRows.slice(1).forEach((r) => {
      if ((r[1] ?? "").toString().trim() !== access.clientId) return;
      if ((r[6] ?? "").toString().toUpperCase() !== "TRUE") return;
      const raw = (r[3] ?? "").toString().trim();
      if (raw) {
        const id = extractId(raw);
        if (!candidates.includes(id)) candidates.push(id);
      }
    });

    if (candidates.length === 0) {
      return NextResponse.json({
        sales: [], total: 0, noDB: true,
        hint: "ไม่พบ spreadsheet ของ Sales — กรุณาระบุ spreadsheetId ด้วยตนเอง",
        debug: { clientId: access.clientId, dbSheetId: access.dbSheetId },
      });
    }

    // ── อ่าน HelperS — ลองทุก candidate ────────────────────────────────────
    let rows: any[][] = [];
    let helperSId = "";
    for (const cid of candidates) {
      try {
        const r = await saReadRange(cid, "HelperS!A:AJ", 0);
        if (r && r.length >= 2) { rows = r; helperSId = cid; break; }
      } catch {
        // ไม่มี sheet / permission → ลอง candidate ถัดไป
      }
    }

    if (!helperSId) {
      return NextResponse.json({
        sales: [], total: 0, noSheet: true,
        hint: `ลองแล้ว ${candidates.length} spreadsheet — ไม่พบ sheet "HelperS" ในไฟล์ใดเลย`,
        debug: { tried: candidates },
      });
    }

    if (rows.length < 2) return NextResponse.json({ sales: [], total: 0, spreadsheetId: helperSId });

    const headers = rows[0];

    // หา payment cols จาก header row (pattern: payment_1, payment_2, …)
    const paymentCols: number[] = [];
    headers.forEach((h: any, i: number) => {
      if (/^payment_\d+$/i.test((h ?? "").toString().trim())) paymentCols.push(i);
    });

    // ── Build branch lookup map: branchName/branchId → branchId ─────────────
    const branchIdMap = new Map<string, string>();
    const branchNameMap = new Map<string, string>();
    for (const b of access.allBranchSheets) {
      if (b.branchId)   branchIdMap.set(b.branchId.toLowerCase(),   b.branchId);
      if (b.branchName) branchIdMap.set(b.branchName.toLowerCase(), b.branchId);
      if (b.branchId)   branchNameMap.set(b.branchId.toLowerCase(),   b.branchName);
      if (b.branchName) branchNameMap.set(b.branchName.toLowerCase(), b.branchName);
    }
    function lookupBranchId(raw: string): string {
      return branchIdMap.get(raw.toLowerCase()) ?? "";
    }
    function lookupBranchName(raw: string): string {
      return branchNameMap.get(raw.toLowerCase()) ?? raw;
    }

    // ── Parse + Filter ────────────────────────────────────────────────────────
    const sales: {
      row_idx: number;
      date: string;
      customer_name: string;
      customer_phone: string;
      program: string;
      amount: number;
      paid: number;
      outstanding: number;
      branch: string;      // branchName (display)
      branch_id: string;   // branchId (for debt creation)
    }[] = [];

    for (let i = 1; i < rows.length; i++) {
      const r    = rows[i];
      const cust = (r[COL_CUST] ?? "").toString().trim();
      if (!cust) continue;

      const dateKey = normDate((r[COL_DATE] ?? "").toString());
      if (!dateKey) continue;

      // กรอง date range
      if (from && dateKey < from) continue;
      if (to   && dateKey > to)   continue;

      const amount = parseNum(r[COL_AMOUNT]);
      if (amount <= 0) continue;

      const paid        = paymentCols.reduce((s, c) => s + parseNum(r[c]), 0);
      const outstanding = Math.max(0, Math.round((amount - paid) * 100) / 100);

      // กรอง outstanding (ถ้าไม่ includeAll)
      if (!includeAll && outstanding <= 0) continue;

      // กรอง branch (ถ้าไม่ใช่ SA)
      const rowBranch = (r[COL_BRANCH] ?? "").toString().trim();
      if (!isSA && access.branchId) {
        if (rowBranch && rowBranch !== access.branchId && rowBranch !== access.branchName) continue;
      }

      const resolvedBranchId   = lookupBranchId(rowBranch) || (access.branchId ?? "");
      const resolvedBranchName = lookupBranchName(rowBranch) || rowBranch;

      sales.push({
        row_idx:       i + 1,
        date:          dateKey,
        customer_name: cust,
        customer_phone: (r[COL_PHONE] ?? "").toString().trim(),
        program:       (r[COL_PROG] ?? "").toString().trim(),
        amount,
        paid: Math.round(paid * 100) / 100,
        outstanding,
        branch:    resolvedBranchName,
        branch_id: resolvedBranchId,
      });

      if (sales.length >= MAX_ROWS) break;
    }

    // เรียงใหม่สุดก่อน
    sales.sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({
      sales,
      total: sales.length,
      spreadsheetId: helperSId,
      totalRows: rows.length - 1,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
