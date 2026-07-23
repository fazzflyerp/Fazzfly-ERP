/**
 * POST /api/expense/auto-fee
 *
 * คำนวณค่าธรรมเนียมช่องทางชำระ + VAT จาก Helper_Sales
 * แล้ว auto-append entries ลง histSheetName (Expense Transaction)
 *
 * Flow:
 *  1. อ่าน Helper_Sales_config → สร้าง field_name → col_index map
 *  2. อ่าน Helper_Sales → กรอง rows ที่ตรงกับ period → รวม payment sums + total_sales
 *  3. อ่าน Expense_FeeConfig → ดึง % ที่ตั้งไว้
 *  4. คำนวณ fee_amount ต่อช่องทาง + VAT
 *  5. ถ้า dryRun=true → คืนแค่ preview (ไม่บันทึก)
 *  6. อ่าน header ของ histSheetName → map column positions
 *  7. Append entry ต่อ fee/VAT ที่มียอด > 0
 *
 * Body: {
 *   spreadsheetId: string
 *   histSheetName: string       // "Expense Transaction"
 *   period: string              // "MM/YYYY"
 *   branchId: string
 *   dryRun?: boolean
 *   salesConfigName?: string    // default "Helper_Sales_config"
 *   salesDataName?: string      // default "Helper_Sales"
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saAppendRow, saUpdateRow, saInvalidateCache } from "@/lib/google-sa";

const BRANCH_ID_COL = 8; // col I (0-based) ถ้าหาไม่เจอจาก header

function colLetter(idx: number): string {
  let s = "", n = idx + 1;
  while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
  return s || "A";
}

/** แปลง date string DD/MM/YYYY หรือ YYYY-MM-DD เป็น "MM/YYYY" */
function extractPeriod(dateStr: string): string | null {
  const s = (dateStr ?? "").toString().trim();
  const d1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (d1) return `${d1[2].padStart(2, "0")}/${d1[3]}`;
  const d2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (d2) return `${d2[2]}/${d2[1]}`;
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const {
      spreadsheetId,
      histSheetName   = "Expense Transaction",
      period,
      branchId,
      dryRun          = false,
      salesConfigName = "Helper_Sales_config",
      salesDataName   = "Helper_Sales",
    } = body;

    if (!spreadsheetId || !period || !branchId)
      return NextResponse.json({ error: "Missing spreadsheetId, period, or branchId" }, { status: 400 });

    const targetPeriod = period.trim(); // "MM/YYYY"

    // ── 1. อ่าน Helper_Sales_config → field_name → col_index (0-based) ─────────
    const fieldColMap: Record<string, number> = {};
    try {
      const rows = await saReadRange(spreadsheetId, `${salesConfigName}!A:E`);
      if (rows.length >= 2) {
        const hdrs   = rows[0].map((h: any) => (h ?? "").toString().toLowerCase().trim());
        const fnIdx  = hdrs.findIndex((h: string) => h === "field_name");
        const ordIdx = hdrs.findIndex((h: string) => h === "order");
        if (fnIdx >= 0 && ordIdx >= 0) {
          rows.slice(1).forEach((r: any[]) => {
            const fn  = (r[fnIdx]  ?? "").toString().trim();
            const ord = Number(r[ordIdx] ?? 0);
            if (fn && ord > 0) fieldColMap[fn] = ord - 1; // convert 1-based order → 0-based index
          });
        }
      }
    } catch {
      return NextResponse.json({ error: `ไม่พบ ${salesConfigName} ในชีท` }, { status: 400 });
    }

    const dateColIdx = fieldColMap["date"] ?? 0;

    // ── 2. อ่าน Helper_Sales → รวม sums ต่อ period + branch ──────────────────
    const sums: Record<string, number> = {};
    let salesRowsTotal = 0;
    let salesRowsMatched = 0;
    let salesBranchColIdx = -1;

    try {
      const salesRows = await saReadRange(spreadsheetId, `${salesDataName}!A:ZZ`, 0);
      salesRowsTotal = salesRows.length - 1;

      // หา branch column จาก header row ของ Helper_Sales โดยตรง
      // (ไม่ผ่าน fieldColMap เพราะ field_name อาจต่างจากชื่อ header จริง)
      if (salesRows.length > 0) {
        const hdr = salesRows[0].map((h: any) => (h ?? "").toString().toLowerCase().trim());
        const branchPatterns = ["branch_id", "branchid", "branch", "สาขา", "branch_name"];
        salesBranchColIdx = hdr.findIndex((h: string) => branchPatterns.includes(h));
      }

      const normBranchId = branchId.toLowerCase().trim();

      // รอบแรก: กรองทั้ง period + branch
      salesRows.slice(1).forEach((row: any[]) => {
        const rowPeriod = extractPeriod((row[dateColIdx] ?? "").toString());
        if (rowPeriod !== targetPeriod) return;

        if (salesBranchColIdx >= 0) {
          const rowBranch = (row[salesBranchColIdx] ?? "").toString().trim().toLowerCase();
          if (rowBranch && rowBranch !== normBranchId) return;
        }

        salesRowsMatched++;
        Object.entries(fieldColMap).forEach(([fn, colIdx]) => {
          if (fn.startsWith("payment_") || fn === "total_sales") {
            const val = Number((row[colIdx] ?? "").toString().replace(/,/g, "") || 0);
            sums[fn] = (sums[fn] || 0) + val;
          }
        });
      });

      // Fallback: ถ้าไม่มี row ตรงสาขาเลย (branch column ไม่ตรง format หรือไม่มี branch column)
      // → ใช้ยอดรวมทั้งหมดของ period แทน แต่ log warning ไว้
      const sumsTotal = Object.values(sums).reduce((a, b) => a + b, 0);
      if (sumsTotal === 0 && salesBranchColIdx < 0) {
        // ไม่มี branch column เลย → ปกติ ใช้ยอดรวม period ทั้งหมด (ไม่มีอะไรต้อง fallback)
        console.warn(`[auto-fee] no branch column in ${salesDataName} — using all rows for period ${targetPeriod}`);
      } else if (sumsTotal === 0 && salesBranchColIdx >= 0 && salesRowsMatched === 0) {
        // มี branch column แต่ไม่มี row ตรง → อาจ format ต่าง → fallback ใช้ทั้งหมด
        console.warn(`[auto-fee] branch col found (${salesBranchColIdx}) but 0 rows matched branchId="${branchId}" — falling back to all rows`);
        salesRows.slice(1).forEach((row: any[]) => {
          const rowPeriod = extractPeriod((row[dateColIdx] ?? "").toString());
          if (rowPeriod !== targetPeriod) return;
          salesRowsMatched++;
          Object.entries(fieldColMap).forEach(([fn, colIdx]) => {
            if (fn.startsWith("payment_") || fn === "total_sales") {
              const val = Number((row[colIdx] ?? "").toString().replace(/,/g, "") || 0);
              sums[fn] = (sums[fn] || 0) + val;
            }
          });
        });
      }
    } catch {
      return NextResponse.json({ error: `ไม่พบ ${salesDataName} ในชีท` }, { status: 400 });
    }
    console.log(`[auto-fee] branchId="${branchId}" salesBranchColIdx=${salesBranchColIdx} total=${salesRowsTotal} matched=${salesRowsMatched} sums=`, sums);

    // ── 3. อ่าน Expense_FeeConfig — กรองเฉพาะสาขานี้ ─────────────────────────
    type FeeConfig = { field_name: string; label: string; fee_pct: number; active: boolean };
    // ใช้ Map เพื่อ deduplicate: ถ้า field_name ซ้ำ ให้ row หลังสุดชนะ
    const feeConfigMap = new Map<string, FeeConfig>();
    try {
      const feeRows = await saReadRange(spreadsheetId, "Expense_FeeConfig!A:E");
      feeRows.slice(1).forEach((r: any[]) => {
        const fn        = (r[0] ?? "").toString().trim();
        const rowBranch = (r[4] ?? "").toString().trim();
        const active    = (r[3] ?? "").toString().toLowerCase() !== "false";
        if (!fn || !active) return;
        // กรองเฉพาะ branchId นี้ (ถ้า rowBranch ว่าง = legacy row ไม่มี branch → ข้าม)
        if (rowBranch !== branchId) return;
        const rawLabel = (r[1] ?? fn).toString().trim();
        // เติม prefix "ค่าธรรมเนียม" สำหรับ payment channels (ไม่ใส่กับ VAT หรือ field ที่มี prefix แล้ว)
        const label = fn.startsWith("payment_") && !rawLabel.startsWith("ค่าธรรมเนียม")
          ? `ค่าธรรมเนียม${rawLabel}`
          : rawLabel;
        console.log(`[auto-fee] feeConfig fn="${fn}" rawLabel="${rawLabel}" → label="${label}"`);
        feeConfigMap.set(fn, {
          field_name: fn,
          label,
          fee_pct:    Number(r[2] ?? 0),
          active,
        });
      });
    } catch {
      return NextResponse.json({ error: "ยังไม่มี Expense_FeeConfig — กรุณาตั้งค่าก่อน" }, { status: 400 });
    }

    const feeConfigs = Array.from(feeConfigMap.values());

    if (!feeConfigs.length)
      return NextResponse.json({ error: "ไม่มี config ที่ active — กรุณาตั้งค่าธรรมเนียม" }, { status: 400 });

    // ── 4. คำนวณ fee ต่อ channel ─────────────────────────────────────────────
    type FeeCalcResult = {
      field_name: string;
      label: string;
      sales_sum: number;
      fee_pct: number;
      fee_amount: number;
      type: "fee" | "vat";
    };

    const calculations: FeeCalcResult[] = feeConfigs
      .filter((fc) => fc.fee_pct > 0)
      .map((fc): FeeCalcResult => {
        const isVat     = fc.field_name === "__vat__";
        const salesSum  = isVat ? (sums["total_sales"] || 0) : (sums[fc.field_name] || 0);
        const feeAmount = Math.round(salesSum * fc.fee_pct / 100 * 100) / 100;
        return {
          field_name: fc.field_name,
          label:      fc.label,
          sales_sum:  salesSum,
          fee_pct:    fc.fee_pct,
          fee_amount: feeAmount,
          type:       isVat ? "vat" : "fee",
        };
      });

    const totalFees = calculations.reduce((s, c) => s + c.fee_amount, 0);

    // ── 5. dryRun → คืน preview เฉยๆ ────────────────────────────────────────
    if (dryRun) {
      return NextResponse.json({
        calculations,
        totalFees: Math.round(totalFees * 100) / 100,
        period: targetPeriod,
        branchId,
        sums,
      });
    }

    // ── 6. อ่าน header ของ histSheetName ─────────────────────────────────────
    let headers: string[] = [];
    try {
      const hRows = await saReadRange(spreadsheetId, `${histSheetName}!A1:Z1`, 0);
      headers = (hRows[0] ?? []).map((h: any) => (h ?? "").toString().trim());
    } catch {
      return NextResponse.json({ error: `ไม่พบ sheet "${histSheetName}"` }, { status: 400 });
    }

    const hLower = headers.map((h) => h.toLowerCase().trim());

    const findCol = (...patterns: RegExp[]) => {
      for (const p of patterns) {
        const idx = hLower.findIndex((h) => p.test(h));
        if (idx >= 0) return { idx, name: headers[idx] };
      }
      return null;
    };

    const catCol    = findCol(/^หมวด/, /หมวด/, /^ประเภท/, /ประเภท/, /^category$/, /category/, /^รายการ$/);
    const amtCol    = findCol(/ยอดเงิน/, /^amount$/, /amount/, /จำนวนเงิน/, /^ยอด/);
    const chanCol   = findCol(/ชำระ/, /^channel$/, /channel/, /ช่องทาง/);
    const dateCol   = findCol(/^วันที่$/, /วันที่/, /^date$/);
    const branchCol = findCol(/^branch_id$/, /branchid/, /^branch$/, /สาขา/);
    const srcCol    = findCol(/^source$/, /^auto_source$/, /source/);
    const periodCol = findCol(/^period$/, /^งวด$/, /^เดือน$/, /^month$/);

    const branchColIdx = branchCol?.idx ?? BRANCH_ID_COL;

    // debug — จะเห็นใน server log ว่า headers ที่ชีทมีอะไรบ้าง และ match column ได้มั้ย
    console.log("[auto-fee] headers:", headers);
    console.log("[auto-fee] catCol:", catCol, "amtCol:", amtCol, "periodCol:", periodCol, "branchCol:", branchCol);

    // วันสุดท้ายของเดือน (DD/MM/YYYY)
    const [mm, yyyy] = targetPeriod.split("/");
    const lastDay    = new Date(parseInt(yyyy), parseInt(mm), 0).getDate();
    const dateStr    = `${lastDay.toString().padStart(2, "0")}/${mm}/${yyyy}`;

    // ── helpers ──────────────────────────────────────────────────────────────────
    // normalize period → "MM/YYYY" รองรับทั้ง "05/2026", "5/2026", "พ.ค. 2026"
    const THAI_MM: Record<string, string> = {
      "ม.ค.": "01", "ก.พ.": "02", "มี.ค.": "03", "เม.ย.": "04",
      "พ.ค.": "05", "มิ.ย.": "06", "ก.ค.": "07", "ส.ค.": "08",
      "ก.ย.": "09", "ต.ค.": "10", "พ.ย.": "11", "ธ.ค.": "12",
    };
    const normPeriodStr = (p: string): string => {
      const t = p.trim();
      // Thai month format: "พ.ค. 2026" → "05/2026"
      for (const [th, mm] of Object.entries(THAI_MM)) {
        if (t.includes(th)) {
          const y = t.replace(th, "").trim();
          if (y) return `${mm}/${y}`;
        }
      }
      // "MM/YYYY" or "M/YYYY" → normalize leading zero
      const parts = t.split("/");
      return parts.length === 2 ? `${parts[0].padStart(2, "0")}/${parts[1].trim()}` : t;
    };
    // normalize label → lowercase + ตัด prefix "ค่าธรรมเนียม" ออก
    const normLbl = (s: string) => {
      const t = s.trim().toLowerCase();
      return t.startsWith("ค่าธรรมเนียม") ? t.slice("ค่าธรรมเนียม".length).trim() : t;
    };

    const normTarget  = normPeriodStr(targetPeriod);
    const normBranch  = branchId.toLowerCase().trim();

    // ── 7. อ่าน existing entries — เพื่อ SKIP ถ้าเคยมีแล้ว (idempotent) ─────────
    // key = normalized label (ไม่มี prefix, lowercase)
    const existingMap = new Map<string, { rowNum: number; row: any[] }>();
    // ต้องมี catCol หรือ amtCol จึงจะ build map ได้ (ถ้าไม่มีเลย → ไม่ check → อาจ INSERT ซ้ำ)
    const labelLookupCol = catCol; // ใช้ catCol เป็น key หลัก
    if (labelLookupCol) {
      const allRows = await saReadRange(spreadsheetId, `${histSheetName}!A:Z`, 0);
      allRows.slice(1).forEach((r: any[], i: number) => {
        // ── กรองงวด — อ่านจาก dateCol แล้ว extract MM/YYYY (ไม่พึ่ง col A formula) ──
        const rawDate = dateCol ? (r[dateCol.idx] ?? "").toString() : "";
        const rp = rawDate ? (extractPeriod(rawDate) ?? "") : "";
        if (rp && rp !== normTarget) return;

        // ── กรองสาขา (case-insensitive) ──────────────────────────────────────
        const rb = (r[branchColIdx] ?? "").toString().trim().toLowerCase();
        if (rb && rb !== normBranch) return;

        const lbl = (r[labelLookupCol.idx] ?? "").toString().trim();
        if (!lbl) return;

        // key = normalized label (without prefix, lowercase)
        // "โอน K Bank" และ "ค่าธรรมเนียมโอน K Bank" → key เดียวกัน
        existingMap.set(normLbl(lbl), { rowNum: i + 2, row: r });
      });
      console.log("[auto-fee] existingMap keys:", [...existingMap.keys()]);
    }

    let saved = 0, skipped = 0, updated = 0;
    const maxCols = Math.max(headers.length, branchColIdx + 1);

    for (const calc of calculations) {
      if (calc.fee_amount <= 0) continue;

      const lookupKey = normLbl(calc.label);
      const existing = labelLookupCol ? existingMap.get(lookupKey) : undefined;
      console.log(`[auto-fee] calc="${calc.label}" key="${lookupKey}" existing=${existing ? `row${existing.rowNum}` : "none"}`);

      if (existing) {
        if (amtCol) {
          const oldAmt = Number((existing.row[amtCol.idx] ?? "").toString().replace(/,/g, "")) || 0;
          if (Math.abs(oldAmt - calc.fee_amount) >= 0.01) {
            // ยอดเปลี่ยน → UPDATE เฉพาะ cell amount
            await saUpdateRow(
              spreadsheetId,
              `${histSheetName}!${colLetter(amtCol.idx)}${existing.rowNum}`,
              [calc.fee_amount],
            );
            updated++;
            continue;
          }
        }
        skipped++;
        continue;
      }

      // ไม่มีแถวเดิม → INSERT ใหม่
      const row: any[] = new Array(maxCols).fill("");
      row[branchColIdx] = branchId;
      if (catCol)  row[catCol.idx]  = calc.label;
      if (amtCol)  row[amtCol.idx]  = calc.fee_amount;
      if (chanCol) row[chanCol.idx] = calc.type === "vat" ? "VAT" : "ค่าธรรมเนียม";
      if (dateCol) row[dateCol.idx] = dateStr;
      if (srcCol)  row[srcCol.idx]  = "AUTO_FEE";

      // ข้าม col A (Period formula) — เขียนตั้งแต่ col B เป็นต้นไป
      await saAppendRow(spreadsheetId, `${histSheetName}!B:Z`, row.slice(1));
      saved++;
    }

    saInvalidateCache(spreadsheetId);

    console.log(`[auto-fee] DONE branchId="${branchId}" period="${targetPeriod}" saved=${saved} updated=${updated} skipped=${skipped}`);
    return NextResponse.json({
      ok: true,
      calculations,
      totalFees: Math.round(totalFees * 100) / 100,
      saved,
      updated,
      skipped,
      period: targetPeriod,
      branchId,
      _debug: {
        catCol: catCol?.name ?? null,
        amtCol: amtCol?.name ?? null,
        periodCol: periodCol?.name ?? null,
        branchCol: branchCol?.name ?? null,
        salesBranchColIdx,
        salesRowsMatched,
        existingMapSize: existingMap.size,
        normTarget,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
