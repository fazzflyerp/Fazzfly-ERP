/**
 * GET /api/finance/detail
 *   ?spreadsheetId=&type=revenue|cogs|expenses&period=MM/YYYY&branchId=&branchName=
 *
 * revenue  → HelperS — hardcoded cols: A วันที่, F ชื่อลูกค้า, I โปรแกรม, L จำนวนที่ใช้, AH พนักงานขาย, AI แพทย์, AJ ผู้ดูแล
 * cogs     → HelperU — auto-detect จาก header row
 * expenses → HelperE — auto-detect จาก header row
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange } from "@/lib/google-sa";

const HS_PERIOD      = 29; // HelperS col AD
const HS_BRANCH_NAME = 32; // HelperS col AG

// Revenue — hardcoded display columns (0-based)
const REVENUE_COLS: { idx: number; name: string }[] = [
  { idx:  0, name: "วันที่" },
  { idx:  8, name: "โปรแกรม" },
  { idx: 11, name: "จำนวนที่ใช้" },
  { idx: 30, name: "ยอดเงิน" },
  { idx: 32, name: "สาขา" },
];

const HU_PERIOD = 15; // HelperU col P
const HU_BRANCH = 14; // HelperU col O

const HE_PERIOD = 0; // HelperE col A
const HE_BRANCH = 8; // HelperE col I

const THAI_MM: Record<string, string> = {
  "ม.ค.": "01", "ก.พ.": "02", "มี.ค.": "03", "เม.ย.": "04",
  "พ.ค.": "05", "มิ.ย.": "06", "ก.ค.": "07", "ส.ค.": "08",
  "ก.ย.": "09", "ต.ค.": "10", "พ.ย.": "11", "ธ.ค.": "12",
};

// แปลง period ทุกรูปแบบ → "MM/YYYY"
// รองรับ: "เม.ย. 2026", "04/2026", "4/2026", "2026-04", "2026-04-01", "01/04/2026" (DD/MM/YYYY)
function normPeriod(p: string): string {
  const s = (p ?? "").toString().trim();
  if (!s) return "";

  // Thai abbreviated month
  for (const [th, mm] of Object.entries(THAI_MM)) {
    if (s.includes(th)) {
      const rest = s.replace(th, "").replace(/[^\d]/g, "");
      const yyyy = rest.length >= 4 ? rest.slice(-4) : rest;
      if (yyyy) return `${mm}/${yyyy}`;
    }
  }

  // YYYY-MM or YYYY-MM-DD
  const isoM = s.match(/^(\d{4})-(\d{2})/);
  if (isoM) return `${isoM[2]}/${isoM[1]}`;

  const parts = s.split("/");
  if (parts.length === 2) {
    // MM/YYYY
    return `${parts[0].padStart(2, "0")}/${parts[1]}`;
  }
  if (parts.length === 3) {
    // DD/MM/YYYY → take MM/YYYY
    return `${parts[1].padStart(2, "0")}/${parts[2]}`;
  }
  return s;
}

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const spreadsheetId = searchParams.get("spreadsheetId") || "";
    const type          = searchParams.get("type") || "";
    const period        = searchParams.get("period")      || "";
    const periodStart   = searchParams.get("periodStart") || "";
    const periodEnd     = searchParams.get("periodEnd")   || "";
    const branchId      = searchParams.get("branchId")   || "";
    const branchName    = searchParams.get("branchName") || "";

    // branchMap: { branchId → branchName } สำหรับแปลง ID → ชื่อสาขา
    let branchMap: Record<string, string> = {};
    try {
      const raw = searchParams.get("branchMap") || "";
      if (raw) branchMap = JSON.parse(raw);
    } catch {}

    if (!spreadsheetId || !type)
      return NextResponse.json({ error: "Missing: spreadsheetId, type" }, { status: 400 });

    let sheetRange: string;
    let periodCol: number;
    let branchCol: number;
    let filterByName: boolean;

    if (type === "revenue") {
      sheetRange   = "HelperS!A:AJ";
      periodCol    = HS_PERIOD;
      branchCol    = HS_BRANCH_NAME;
      filterByName = true;
    } else if (type === "cogs") {
      sheetRange   = "HelperU!A:P";
      periodCol    = HU_PERIOD;
      branchCol    = HU_BRANCH;
      filterByName = false;
    } else if (type === "expenses") {
      sheetRange   = "HelperE!A:I";
      periodCol    = HE_PERIOD;
      branchCol    = HE_BRANCH;
      filterByName = false;
    } else {
      return NextResponse.json({ error: "type ต้องเป็น revenue | cogs | expenses" }, { status: 400 });
    }

    const allRows = await saReadRange(spreadsheetId, sheetRange);
    if (!allRows || allRows.length < 2)
      return NextResponse.json({ headers: [], rows: [] });

    // skip rows that are completely empty (trailing blank rows in sheet)
    const dataRows = allRows.slice(1).filter((row) =>
      row.some((cell) => (cell ?? "").toString().trim() !== "")
    );

    // คอลัมน์ที่ซ่อนใน cogs
    const COGS_HIDE = new Set(["product_id", "category", "unit", "cost_per_units", "cost_per_unit", "period", "used_by"]);
    // expenses: rename English → Thai
    const EXP_RENAME: Record<string, string> = {
      date:             "วันที่",
      expense_date:     "วันที่",
      category:         "หมวดค่าใช้จ่าย",
      expense_category: "หมวดค่าใช้จ่าย",
      expense_type:     "หมวดค่าใช้จ่าย",
      "หมวดค่าใช้จ่าย (auto จาก master)": "หมวดค่าใช้จ่าย",
      amount:           "ยอดเงิน",
      total:            "ยอดเงิน",
      total_amount:     "ยอดเงิน",
      branch_id:        "สาขา",
    };
    // แสดงเฉพาะ 4 คอลัมน์นี้ เรียงตามลำดับ
    const EXP_ORDER = ["วันที่", "หมวดค่าใช้จ่าย", "ยอดเงิน", "สาขา"];
    // คอลัมน์ที่ซ่อนใน expenses
    const EXP_HIDE = new Set(["expense_id", "period"]);
    // rename header → ภาษาไทย
    const COGS_RENAME: Record<string, string> = {
      used_at:      "วันที่",
      usage_id:     "รหัสการใช้",
      product_name: "ชื่อสินค้า",
      lot_id:       "ล็อต",
      expiry_date:  "วันหมดอายุ",
      qty_used:     "จำนวนที่ใช้",
      quantity:     "จำนวน",
      doctor:       "แพทย์",
      note:         "หมายเหตุ",
      total_cost:   "ยอดต้นทุน",
      branch_id:    "สาขา",
    };
    const COGS_ORDER = ["วันที่", "ชื่อสินค้า", "จำนวนที่ใช้", "ยอดต้นทุน", "สาขา"];

    // Revenue ใช้ hardcoded cols, cogs/expenses ใช้ auto-detect จาก header row
    let headerCols: { idx: number; name: string; isBranchId?: boolean }[];
    if (type === "revenue") {
      headerCols = REVENUE_COLS;
    } else {
      const headerRow = allRows[0];
      let detected: { idx: number; name: string; isBranchId?: boolean }[] = [];
      headerRow.forEach((h, i) => {
        const raw = (h ?? "").toString().trim();
        if (!raw) return;
        const lc = raw.toLowerCase();
        if (type === "cogs" && COGS_HIDE.has(lc)) return;
        if (type === "expenses" && EXP_HIDE.has(lc)) return;
        const thaiName = type === "cogs"
          ? (COGS_RENAME[lc] || raw)
          : type === "expenses"
          ? (EXP_RENAME[lc] || raw)
          : raw;
        detected.push({ idx: i, name: thaiName, isBranchId: lc === "branch_id" });
      });

      // cogs: แสดงเฉพาะ 4 คอลัมน์ตาม COGS_ORDER เรียงตามลำดับที่ระบุ
      if (type === "cogs") {
        detected = COGS_ORDER
          .map((wanted) => detected.find((c) => c.name === wanted))
          .filter((c): c is NonNullable<typeof c> => c !== undefined);
      }

      // expenses: แสดงเฉพาะ 4 คอลัมน์ตาม EXP_ORDER เรียงตามลำดับที่ระบุ
      if (type === "expenses") {
        detected = EXP_ORDER
          .map((wanted) => detected.find((c) => c.name === wanted))
          .filter((c): c is NonNullable<typeof c> => c !== undefined);
      }

      headerCols = detected;
    }

    // "MM/YYYY" → YYYYMM number for range comparison
    function periodToNum(p: string): number {
      const [mm, yyyy] = normPeriod(p).split("/");
      if (!mm || !yyyy) return 0;
      return parseInt(yyyy) * 100 + parseInt(mm.padStart(2, "0"));
    }

    const normTarget = period ? normPeriod(period) : "";
    const numStart   = periodStart ? periodToNum(normPeriod(periodStart)) : 0;
    const numEnd     = periodEnd   ? periodToNum(normPeriod(periodEnd))   : 0;

    const filtered = dataRows.filter((row) => {
      const p = normPeriod((row[periodCol] ?? "").toString());
      if (normTarget) {
        if (p !== normTarget) return false;
      } else {
        const n = periodToNum(p);
        if (numStart && n < numStart) return false;
        if (numEnd   && n > numEnd)   return false;
      }

      if (filterByName && branchName) {
        const rowBranch = (row[branchCol] ?? "").toString().toLowerCase().trim();
        return rowBranch === branchName.toLowerCase().trim();
      }
      if (!filterByName && branchId) {
        const rowBranch = (row[branchCol] ?? "").toString().toLowerCase().trim();
        return rowBranch === branchId.toLowerCase().trim();
      }
      return true;
    });

    const rows = filtered.map((row) => {
      const obj: Record<string, string> = {};
      headerCols.forEach(({ idx, name, isBranchId }) => {
        let val = (row[idx] ?? "").toString();
        if (isBranchId && branchMap[val]) val = branchMap[val];
        obj[name] = val;
      });
      return obj;
    });

    // debug: ถ้า 0 rows ส่ง diagnostic info
    const passedPeriod = dataRows.filter((r) => {
      const p = normPeriod((r[periodCol] ?? "").toString());
      if (normTarget) return p === normTarget;
      const n = periodToNum(p);
      if (numStart && n < numStart) return false;
      if (numEnd   && n > numEnd)   return false;
      return true;
    });
    const headerRow = allRows[0] ?? [];
    const debugInfo = rows.length === 0 ? {
      normTarget,
      branchNameReceived: branchName,
      branchIdReceived: branchId,
      filterByName,
      passedPeriodFilter: passedPeriod.length,
      sampleBranchValues: passedPeriod.slice(0, 5).map((r) => (r[branchCol] ?? "").toString()),
      samplePeriods: dataRows.slice(0, 3).map((r) => ({
        raw:  (r[periodCol] ?? "").toString(),
        norm: normPeriod((r[periodCol] ?? "").toString()),
      })),
      totalDataRows: dataRows.length,
      // header ที่ col สำคัญ — ช่วยตรวจว่า index ถูกต้อง
      headerAtCols: {
        periodCol:  { idx: periodCol,  header: (headerRow[periodCol]  ?? "").toString() },
        branchCol:  { idx: branchCol,  header: (headerRow[branchCol]  ?? "").toString() },
      },
    } : undefined;

    return NextResponse.json({ headers: headerCols.map((h) => h.name), rows, ...(debugInfo ? { debug: debugInfo } : {}) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
