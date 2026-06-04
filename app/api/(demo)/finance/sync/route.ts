/**
 * GET  /api/finance/sync?spreadsheetId=&sheetName=Finance&branchId=&branchName=
 *   → อ่าน Helpers ทั้ง 3 แล้วคืน computed totals ต่อ period (periods มาจาก Helpers ไม่ใช่ Finance)
 *
 * POST /api/finance/sync
 *   { spreadsheetId, sheetName, branchId, branchName }
 *   → เขียน A (period), B (รายได้), C (ต้นทุน), E (ค่าใช้จ่าย) ลง Finance sheet
 *   → period ใหม่ = append row, period มีแล้ว = update
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saBatchUpdate, saAppendRow, saInvalidateCache } from "@/lib/google-sa";

// ── Finance sheet columns (0-based) ──────────────────────────────────────────
const F_PERIOD  = 0; // col A — period
const F_REVENUE = 1; // col B — รายได้รวม   ← HelperS
const F_COGS    = 2; // col C — ต้นทุนขาย   ← HelperU
// col D (3) = กำไรขั้นต้น — formula, ไม่เขียน
const F_EXPENSE = 4; // col E — ค่าใช้จ่ายรวม ← HelperE

// ── HelperS columns (0-based) ─────────────────────────────────────────────────
// A=0 … AD=29, AE=30, AF=31, AG=32
const HS_PERIOD      = 29; // col AD — period (MM/YYYY หรือ Thai)
const HS_AMOUNT      = 30; // col AE — ยอดรวมสุทธิ
const HS_BRANCH_NAME = 32; // col AG — ชื่อสาขา (ไม่ใช่ ID)

// ── HelperU columns (0-based) ─────────────────────────────────────────────────
const HU_AMOUNT = 13; // col N — total_cost
const HU_BRANCH = 14; // col O — branch_id
const HU_PERIOD = 15; // col P — period (MM/YYYY)

// ── HelperE columns (0-based) ─────────────────────────────────────────────────
const HE_PERIOD = 0; // col A — period
const HE_AMOUNT = 5; // col F — ยอดเงิน
const HE_BRANCH = 8; // col I — branch_id

// ── Period normalizer → MM/YYYY ───────────────────────────────────────────────
const THAI_MM: Record<string, string> = {
  "ม.ค.": "01", "ก.พ.": "02", "มี.ค.": "03", "เม.ย.": "04",
  "พ.ค.": "05", "มิ.ย.": "06", "ก.ค.": "07", "ส.ค.": "08",
  "ก.ย.": "09", "ต.ค.": "10", "พ.ย.": "11", "ธ.ค.": "12",
};

function normPeriod(p: string): string {
  const s = (p ?? "").toString().trim();
  for (const [th, mm] of Object.entries(THAI_MM)) {
    if (s.includes(th)) {
      const y = s.replace(th, "").trim();
      if (y) return `${mm}/${y}`;
    }
  }
  const parts = s.split("/");
  return parts.length === 2 ? `${parts[0].padStart(2, "0")}/${parts[1]}` : s;
}

function parseNum(v: any): number {
  const n = parseFloat((v ?? "").toString().replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

// ── Aggregate HelperS (filter by branchName) ──────────────────────────────────
function aggregateHelperS(
  rows: any[][],
  branchName: string // ชื่อสาขา (empty = ทั้งหมด)
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const row of rows) {
    const p = normPeriod((row[HS_PERIOD] ?? "").toString());
    if (!p) continue;
    if (branchName) {
      const rowName = (row[HS_BRANCH_NAME] ?? "").toString().toLowerCase().trim();
      if (rowName !== branchName.toLowerCase().trim()) continue;
    }
    map[p] = (map[p] || 0) + parseNum(row[HS_AMOUNT]);
  }
  return map;
}

// ── Aggregate HelperU / HelperE (filter by branchId) ─────────────────────────
function aggregateByBranchId(
  rows: any[][],
  periodCol: number,
  amountCol: number,
  branchCol: number,
  branchId: string
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const row of rows) {
    const p = normPeriod((row[periodCol] ?? "").toString());
    if (!p) continue;
    if (branchId) {
      const b = (row[branchCol] ?? "").toString().toLowerCase().trim();
      if (b !== branchId.toLowerCase().trim()) continue;
    }
    map[p] = (map[p] || 0) + parseNum(row[amountCol]);
  }
  return map;
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const spreadsheetId = searchParams.get("spreadsheetId");
    const sheetName     = searchParams.get("sheetName") || "Finance";
    const branchId      = searchParams.get("branchId")   || "";
    const branchName    = searchParams.get("branchName") || "";

    if (!spreadsheetId) return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });

    const [finRows, helperS, helperE, helperU] = await Promise.all([
      saReadRange(spreadsheetId, `${sheetName}!A:H`).catch(() => [] as any[][]),
      saReadRange(spreadsheetId, "HelperS!A:AJ").catch(() => [] as any[][]),
      saReadRange(spreadsheetId, "HelperE!A:I").catch(() => [] as any[][]),
      saReadRange(spreadsheetId, "HelperU!A:P").catch(() => [] as any[][]),
    ]);

    // Aggregate helpers → { "04/2026": total }
    const revenueMap = aggregateHelperS(helperS.slice(1), branchName);
    const cogsMap    = aggregateByBranchId(helperU.slice(1), HU_PERIOD, HU_AMOUNT, HU_BRANCH, branchId);
    const expMap     = aggregateByBranchId(helperE.slice(1), HE_PERIOD, HE_AMOUNT, HE_BRANCH, branchId);

    // รวม periods จาก Helpers (ไม่ใช่จาก Finance sheet)
    const allPeriods = new Set<string>([
      ...Object.keys(revenueMap),
      ...Object.keys(cogsMap),
      ...Object.keys(expMap),
    ]);

    // Map Finance sheet สำหรับ current values (ค่าที่อยู่ในชีทตอนนี้)
    const finByPeriod: Record<string, any> = {};
    finRows.slice(1).forEach((r, idx) => {
      const p = normPeriod((r[F_PERIOD] ?? "").toString());
      if (p) finByPeriod[p] = { row: r, rowIndex: idx + 2 };
    });

    const rows = Array.from(allPeriods)
      .sort() // MM/YYYY sorts correctly
      .map((normP) => {
        const fin = finByPeriod[normP];
        const r   = fin?.row ?? [];
        return {
          rowIndex:   fin?.rowIndex ?? null,
          period:     normP,
          normPeriod: normP,
          inFinance:  !!fin,
          current: {
            revenue:     parseNum(r[F_REVENUE]),
            cogs:        parseNum(r[F_COGS]),
            expenses:    parseNum(r[F_EXPENSE]),
            grossProfit: parseNum(r[3]),
            netProfit:   parseNum(r[5]),
            grossMargin: (r[6] ?? "").toString(),
            netMargin:   (r[7] ?? "").toString(),
          },
          computed: {
            revenue:  revenueMap[normP] || 0,
            cogs:     cogsMap[normP]    || 0,
            expenses: expMap[normP]     || 0,
          },
        };
      });

    // debug: แนบถ้า revenue = 0 ทุกงวด
    const totalRevenue = rows.reduce((s, r) => s + r.computed.revenue, 0);
    const debugSync = totalRevenue === 0 && helperS.length > 1 ? {
      branchNameReceived: branchName,
      helperSRows: helperS.length - 1,
      sampleHelperS: helperS.slice(1, 4).map((r) => ({
        period:     (r[HS_PERIOD]      ?? "").toString(),
        periodNorm: normPeriod((r[HS_PERIOD] ?? "").toString()),
        amount:     (r[HS_AMOUNT]      ?? "").toString(),
        branchName: (r[HS_BRANCH_NAME] ?? "").toString(),
      })),
      revenueMapEntries: Object.entries(revenueMap).slice(0, 5),
    } : undefined;

    return NextResponse.json({ rows, ...(debugSync ? { debugSync } : {}) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── POST (sync → write to Finance sheet) ─────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { spreadsheetId, sheetName = "Finance", branchId = "", branchName = "" } = await request.json();
    if (!spreadsheetId) return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });

    const [finRows, helperS, helperE, helperU] = await Promise.all([
      saReadRange(spreadsheetId, `${sheetName}!A:H`).catch(() => [] as any[][]),
      saReadRange(spreadsheetId, "HelperS!A:AJ").catch(() => [] as any[][]),
      saReadRange(spreadsheetId, "HelperE!A:I").catch(() => [] as any[][]),
      saReadRange(spreadsheetId, "HelperU!A:P").catch(() => [] as any[][]),
    ]);

    const revenueMap = aggregateHelperS(helperS.slice(1), branchName);
    const cogsMap    = aggregateByBranchId(helperU.slice(1), HU_PERIOD, HU_AMOUNT, HU_BRANCH, branchId);
    const expMap     = aggregateByBranchId(helperE.slice(1), HE_PERIOD, HE_AMOUNT, HE_BRANCH, branchId);

    const allPeriods = Array.from(new Set([
      ...Object.keys(revenueMap),
      ...Object.keys(cogsMap),
      ...Object.keys(expMap),
    ])).sort();

    if (allPeriods.length === 0) return NextResponse.json({ ok: true, synced: 0 });

    // Build map period → row number (1-based) จาก Finance sheet ปัจจุบัน
    const finPeriodToRow: Record<string, number> = {};
    finRows.slice(1).forEach((r, idx) => {
      const p = normPeriod((r[F_PERIOD] ?? "").toString());
      if (p) finPeriodToRow[p] = idx + 2; // +1 header, +1 for 1-based
    });

    const batchData: { range: string; values: any[][] }[] = [];
    let appended = 0;

    for (const period of allPeriods) {
      const revenue  = revenueMap[period] || 0;
      const cogs     = cogsMap[period]    || 0;
      const expenses = expMap[period]     || 0;

      if (finPeriodToRow[period]) {
        // อัปเดต row ที่มีอยู่แล้ว — เขียนแค่ B, C, E (ไม่แตะ A, D, F-H)
        const rowNum = finPeriodToRow[period];
        batchData.push(
          { range: `${sheetName}!B${rowNum}`, values: [[revenue]]  },
          { range: `${sheetName}!C${rowNum}`, values: [[cogs]]     },
          { range: `${sheetName}!E${rowNum}`, values: [[expenses]] },
        );
      } else {
        // period ใหม่ — append row ใหม่ (A=period, B=revenue, C=cogs, E=expenses)
        const newRow: (string | number)[] = ["", "", "", "", ""];
        newRow[F_PERIOD]  = period;
        newRow[F_REVENUE] = revenue;
        newRow[F_COGS]    = cogs;
        newRow[F_EXPENSE] = expenses;
        await saAppendRow(spreadsheetId, `${sheetName}!A:E`, newRow);
        appended++;
      }
    }

    // เขียน MAP formula สำหรับ GM% (G2) และ NM% (H2) — เขียนทุกครั้งเพื่อให้ครอบคลุม row ใหม่
    batchData.push(
      {
        range: `${sheetName}!G2`,
        values: [[`=MAP(A2:A,LAMBDA(p,IF(p="","",IF(SUMIF(A:A,p,B:B)=0,0,SUMIF(A:A,p,D:D)/SUMIF(A:A,p,B:B)))))`]],
      },
      {
        range: `${sheetName}!H2`,
        values: [[`=MAP(A2:A,LAMBDA(p,IF(p="","",IF(SUMIF(A:A,p,B:B)=0,0,SUMIF(A:A,p,F:F)/SUMIF(A:A,p,B:B)))))`]],
      },
    );

    if (batchData.length > 0) {
      await saBatchUpdate(spreadsheetId, batchData);
    }

    saInvalidateCache(spreadsheetId);
    return NextResponse.json({ ok: true, synced: allPeriods.length, updated: Math.floor((batchData.length - 2) / 3), appended });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
