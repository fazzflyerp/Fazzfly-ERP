/**
 * POST /api/expense/auto-fee/batch
 *
 * รองรับ 2 โหมด (อ่านจาก Expense_FeeConfig row __batch_mode__):
 *
 *  "daily"   — 1 แถวต่อวันที่ที่ลูกค้าทำรายการ (default)
 *  "monthly" — 1 แถวต่อเดือน รวมยอดทั้งเดือน ใช้วันสุดท้ายของเดือน
 *
 * ทั้ง 2 โหมด:
 * — col A เว้นว่าง, date ลง col B (expDateCol)
 * — write batch ครั้งเดียว + sortRange 1 call
 *
 * existingSet key: `${dd/mm/yyyy}|${branchId}|${normLabel}`
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  saReadRange,
  saGetSheetMeta,
  saStructuralBatchUpdate,
  saWriteRange,
  saInvalidateCache,
} from "@/lib/google-sa";

// ─── helpers ──────────────────────────────────────────────────────────────────

/** ตัด prefix "ค่าธรรมเนียม" + lowercase เพื่อใช้ compare */
function normLabel(s: string): string {
  const t = (s ?? "").trim().toLowerCase();
  return t.startsWith("ค่าธรรมเนียม") ? t.slice("ค่าธรรมเนียม".length).trim() : t;
}

/** column index → A, B, … Z, AA, AB, … */
function colLetter(n: number): string {
  let s = "";
  for (let c = n + 1; c > 0;) { c--; s = String.fromCharCode(65 + (c % 26)) + s; c = Math.floor(c / 26); }
  return s || "A";
}

/** หา column index จาก header array ด้วย regex patterns */
function findCol(headers: string[], ...pats: RegExp[]): { idx: number; name: string } | null {
  for (const p of pats) {
    const i = headers.findIndex((h) => p.test(h));
    if (i >= 0) return { idx: i, name: headers[i] };
  }
  return null;
}

/**
 * แปลง date string ต่างๆ → "dd/mm/yyyy"
 * รับ: Excel serial number / "dd/mm/yyyy" / "yyyy-mm-dd"
 */
function normalizeDateStr(s: any): string | null {
  const str = (s ?? "").toString().trim();
  if (!str) return null;

  // Excel serial number
  if (!isNaN(Number(str)) && Number(str) > 1000) {
    const base = new Date(Date.UTC(1899, 11, 30));
    base.setUTCDate(base.getUTCDate() + Number(str));
    const d = base.getUTCDate().toString().padStart(2, "0");
    const m = (base.getUTCMonth() + 1).toString().padStart(2, "0");
    const y = base.getUTCFullYear().toString();
    return `${d}/${m}/${y}`;
  }

  // dd/mm/yyyy (หรือ d/m/yyyy)
  const m1 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m1) return `${m1[1].padStart(2, "0")}/${m1[2].padStart(2, "0")}/${m1[3]}`;

  // yyyy-mm-dd
  const m2 = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return `${m2[3]}/${m2[2]}/${m2[1]}`;

  return null;
}

/** แปลง "dd/mm/yyyy" → UTC milliseconds สำหรับ sort/compare */
function dateToMs(dateStr: string | null): number {
  if (!dateStr) return 0;
  const m = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return 0;
  return Date.UTC(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
}

/** วันสุดท้ายของเดือน "MM/YYYY" → "dd/mm/yyyy" */
function lastDayOfPeriod(period: string): string {
  const [mm, yyyy] = period.split("/");
  const last = new Date(parseInt(yyyy), parseInt(mm), 0).getDate();
  return `${last.toString().padStart(2, "0")}/${mm}/${yyyy}`;
}

/** แปลง "dd/mm/yyyy" → "MM/YYYY" (period) */
function periodFromDate(s: string): string | null {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[2]}/${m[3]}`;
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return `${m2[2]}/${m2[1]}`;
  return null;
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const {
      spreadsheetId,
      histSheetName   = "Expense Transaction",
      branchIds       = [] as string[],
      branchMapping   = [] as { branchId: string; branchName: string }[],
      salesConfigName = "Helper_Sales_config",
      salesDataName   = "Helper_Sales",
      dryRun          = false,
    } = body;

    if (!spreadsheetId || !Array.isArray(branchIds) || !branchIds.length)
      return NextResponse.json({ error: "Missing spreadsheetId or branchIds" }, { status: 400 });

    // ── map branchId ↔ branchName (lowercase) ─────────────────────────────────
    const idToName = new Map<string, string>(); // "branch_1" → "สาขาถนนจันทร์"
    const nameToId = new Map<string, string>(); // "สาขาถนนจันทร์" → "branch_1"
    for (const { branchId: bid, branchName: bname } of (branchMapping as any[])) {
      if (bid && bname) {
        idToName.set(bid.toLowerCase().trim(), bname.toLowerCase().trim());
        nameToId.set(bname.toLowerCase().trim(), bid.toLowerCase().trim());
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 1.  Helper_Sales_config → fieldColMap (field_name → 0-based col index)
    // ═══════════════════════════════════════════════════════════════════════════
    const fieldColMap: Record<string, number> = {};
    {
      const rows = await saReadRange(spreadsheetId, `${salesConfigName}!A:E`).catch(() => [] as any[][]);
      if (rows.length < 2) return NextResponse.json({ error: `ไม่พบข้อมูลใน ${salesConfigName}` }, { status: 400 });
      const hdr    = rows[0].map((h: any) => (h ?? "").toString().toLowerCase().trim());
      const fnIdx  = hdr.findIndex((h: string) => h === "field_name");
      const ordIdx = hdr.findIndex((h: string) => h === "order");
      if (fnIdx < 0 || ordIdx < 0)
        return NextResponse.json({ error: `${salesConfigName}: ไม่มี field_name / order column` }, { status: 400 });
      for (const r of rows.slice(1)) {
        const fn  = (r[fnIdx]  ?? "").toString().trim().toLowerCase();
        const ord = Number(r[ordIdx] ?? 0);
        if (fn && ord > 0) fieldColMap[fn] = ord - 1;
      }
    }

    const salesDateColIdx = fieldColMap["date"] ?? 0;
    const maxFieldCol     = Math.max(0, ...Object.values(fieldColMap));
    const salesEndCol     = colLetter(Math.min(maxFieldCol + 5, 51));

    // ─── 1.5  อ่าน batchMode จาก Expense_FeeConfig ────────────────────────────
    //   "daily"   = 1 แถว/วันที่จริง (default)
    //   "monthly" = 1 แถว/เดือน รวมยอด ใช้วันสุดท้าย
    let batchMode: "daily" | "monthly" = "daily";
    {
      const mr = await saReadRange(spreadsheetId, "Expense_FeeConfig!A:B").catch(() => [] as any[][]);
      const modeRow = mr.slice(1).find((r) => (r[0] ?? "").toString().trim() === "__batch_mode__");
      if (modeRow) batchMode = (modeRow[1] ?? "daily").toString().trim() === "monthly" ? "monthly" : "daily";
      console.log(`[batch] batchMode = ${batchMode}`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2.  Helper_Sales → salesGroupMap[groupKey][branchKey][fieldName] = sum
    //
    //   daily mode  : groupKey = "dd/mm/yyyy" (วันที่จริงของแต่ละรายการ)
    //   monthly mode: groupKey = "MM/YYYY"    (รวมยอดทั้งเดือน)
    // ═══════════════════════════════════════════════════════════════════════════
    type SalesGroupMap = Record<string, Record<string, Record<string, number>>>;
    const salesGroupMap: SalesGroupMap = {};
    let salesBranchCol = -1;

    {
      const rows = await saReadRange(spreadsheetId, `${salesDataName}!A:${salesEndCol}`, 0).catch(() => [] as any[][]);
      if (rows.length < 2) return NextResponse.json({ error: `ไม่พบข้อมูลใน ${salesDataName}` }, { status: 400 });

      const hdr = rows[0].map((h: any) => (h ?? "").toString().toLowerCase().trim());
      salesBranchCol = hdr.findIndex((h: string) =>
        ["branch_id", "branchid", "branch", "สาขา", "branch_name"].includes(h)
      );
      console.log(`[batch] ${salesDataName}!A:${salesEndCol} → ${rows.length} rows | branchCol=${salesBranchCol}`);

      for (const row of rows.slice(1)) {
        const dateStr = normalizeDateStr(row[salesDateColIdx]);
        if (!dateStr) continue;

        // กำหนด groupKey ตาม mode
        const groupKey = batchMode === "monthly" ? (periodFromDate(dateStr) ?? "") : dateStr;
        if (!groupKey) continue;

        const branchKey = salesBranchCol >= 0
          ? (row[salesBranchCol] ?? "").toString().trim().toLowerCase()
          : "";

        if (!salesGroupMap[groupKey])            salesGroupMap[groupKey] = {};
        if (!salesGroupMap[groupKey][branchKey]) salesGroupMap[groupKey][branchKey] = {};

        for (const [fn, colIdx] of Object.entries(fieldColMap)) {
          if (fn.startsWith("payment_") || fn === "total_sales") {
            const val = Number((row[colIdx] ?? "").toString().replace(/,/g, "")) || 0;
            salesGroupMap[groupKey][branchKey][fn] = (salesGroupMap[groupKey][branchKey][fn] ?? 0) + val;
          }
        }
      }
    }

    const discoveredKeys = Object.keys(salesGroupMap);
    if (!discoveredKeys.length)
      return NextResponse.json({ error: "ไม่พบข้อมูลยอดขายใน Helper_Sales" }, { status: 400 });

    // ═══════════════════════════════════════════════════════════════════════════
    // 3.  Expense_FeeConfig → branchFeeConfigs[branchId] = FeeConfig[]
    // ═══════════════════════════════════════════════════════════════════════════
    type FeeConfig = { field_name: string; label: string; fee_pct: number };
    const branchFeeConfigs = new Map<string, FeeConfig[]>();
    {
      const rows = await saReadRange(spreadsheetId, "Expense_FeeConfig!A:E").catch(() => [] as any[][]);
      if (rows.length < 2) return NextResponse.json({ error: "ยังไม่มี Expense_FeeConfig — กรุณาตั้งค่าก่อน" }, { status: 400 });

      const dedup = new Map<string, FeeConfig>();
      for (const r of rows.slice(1)) {
        const fn       = (r[0] ?? "").toString().trim().toLowerCase();
        const branchId = (r[4] ?? "").toString().trim();
        const active   = (r[3] ?? "true").toString().toLowerCase() !== "false";
        if (!fn || !branchId || !active) continue;

        const rawLabel = (r[1] ?? fn).toString().trim();
        const label    = fn.startsWith("payment_") && !rawLabel.startsWith("ค่าธรรมเนียม")
          ? `ค่าธรรมเนียม${rawLabel}` : rawLabel;
        const fee_pct  = Number((r[2] ?? "0").toString().replace("%", "").trim()) || 0;

        dedup.set(`${branchId}|||${fn}`, { field_name: fn, label, fee_pct });
      }
      for (const [key, cfg] of dedup) {
        const bid = key.split("|||")[0];
        if (!branchFeeConfigs.has(bid)) branchFeeConfigs.set(bid, []);
        branchFeeConfigs.get(bid)!.push(cfg);
      }
    }

    if (!branchFeeConfigs.size)
      return NextResponse.json({ error: "ไม่มี fee config — กรุณาตั้งค่าธรรมเนียม" }, { status: 400 });

    // ═══════════════════════════════════════════════════════════════════════════
    // 4.  Expense Transaction header → column positions
    // ═══════════════════════════════════════════════════════════════════════════
    let expHeaders: string[] = [];
    {
      const hRows = await saReadRange(spreadsheetId, `${histSheetName}!A1:Z1`, 0).catch(() => [] as any[][]);
      expHeaders = (hRows[0] ?? []).map((h: any) => (h ?? "").toString().trim());
    }
    if (!expHeaders.length)
      return NextResponse.json({ error: `ไม่พบ sheet "${histSheetName}"` }, { status: 400 });

    const expHLower  = expHeaders.map((h) => h.toLowerCase().trim());
    const catCol     = findCol(expHLower, /^หมวด/, /หมวด/, /^ประเภท/, /ประเภท/, /^category$/, /category/);
    const amtCol     = findCol(expHLower, /ยอดเงิน/, /^amount$/, /amount/, /จำนวนเงิน/, /^ยอด/);
    const chanCol    = findCol(expHLower, /ชำระ/, /^channel$/, /channel/, /ช่องทาง/);
    const expDateCol = findCol(expHLower, /^วันที่$/, /วันที่/, /^date$/);
    const branchCol  = findCol(expHLower, /^branch_id$/, /branchid/, /^branch$/, /สาขา/);
    const periodCol  = findCol(expHLower, /^period$/, /^งวด$/, /^เดือน$/, /^month$/);
    const branchColIdx = branchCol?.idx ?? 8;

    if (!catCol || !amtCol || !expDateCol)
      return NextResponse.json({ error: `Expense Transaction: ไม่พบ column หมวด/ยอดเงิน/วันที่` }, { status: 400 });

    console.log("[batch] Expense Transaction cols →", {
      cat: catCol.name, amt: amtCol.name, date: `${expDateCol.name}(idx=${expDateCol.idx})`,
      branch: branchCol?.name, period: periodCol?.name,
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 5.  อ่าน existing entries → existingSet
    //     key: `${dd/mm/yyyy}|${branchId}|${normLabel}`
    //     ใช้วันที่จาก expDateCol (col B) ตรงๆ ไม่รวมเป็น period อีกต่อไป
    //     เก็บ expRowCount ไว้สำหรับ write step (ไม่ต้อง read ซ้ำ)
    // ═══════════════════════════════════════════════════════════════════════════
    const existingSet = new Set<string>();
    let expRowCount = 0;
    {
      const allRows = await saReadRange(spreadsheetId, `${histSheetName}!A:Z`, 0).catch(() => [] as any[][]);
      expRowCount = allRows.length; // includes header row
      for (const r of allRows.slice(1)) {
        const lbl = (r[catCol.idx] ?? "").toString().trim();
        if (!lbl) continue;

        const dateStr = normalizeDateStr(r[expDateCol.idx]);
        if (!dateStr) continue;

        const rawBranch = (r[branchColIdx] ?? "").toString().trim().toLowerCase();
        const branchId  = nameToId.get(rawBranch) ?? rawBranch;

        existingSet.add(`${dateStr}|${branchId}|${normLabel(lbl)}`);
      }
      console.log(`[batch] existingSet: ${existingSet.size} entries`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 6.  คำนวณและสร้าง rowsToInsert
    //     1 แถว = 1 วันที่ × 1 branch × 1 fee type
    //     col A (index 0) เว้นว่าง — date ลง expDateCol.idx (col B = index 1)
    // ═══════════════════════════════════════════════════════════════════════════
    const maxCols = Math.max(
      expHeaders.length,
      branchColIdx + 1,
      (periodCol?.idx ?? 0) + 1,
      expDateCol.idx + 1,
    );

    type ResultRow = { date: string; branchId: string; saved: number; skipped: number; zeroAmt: number };
    const results: ResultRow[] = [];

    type PreviewRow = {
      dateStr: string; period: string; branchId: string; branchName: string;
      label: string; amount: number; channel: string; salesBase: number; feePct: number;
      status: "append" | "skip_existing" | "zero_sales" | "zero_pct";
    };
    const previewRows: PreviewRow[] = [];
    const rowsToInsert: { row: any[]; dateMs: number }[] = [];
    let totalSaved = 0, totalSkipped = 0;

    // เรียงจาก earliest → latest
    // daily: sort by date string; monthly: sort by period string "MM/YYYY"
    const sortedKeys = discoveredKeys.sort((a, b) => {
      if (batchMode === "monthly") {
        // "MM/YYYY" → compare as dates using last day of period
        return dateToMs(lastDayOfPeriod(a)) - dateToMs(lastDayOfPeriod(b));
      }
      return dateToMs(a) - dateToMs(b);
    });

    for (const branchId of branchIds) {
      const feeConfigs = branchFeeConfigs.get(branchId) ?? [];
      if (!feeConfigs.length) {
        console.log(`[batch] no fee config for "${branchId}" — skip`);
        continue;
      }

      const normBid    = branchId.toLowerCase().trim();
      const branchName = idToName.get(normBid) ?? "";

      for (const groupKey of sortedKeys) {
        // groupKey คือ dateStr (daily) หรือ period (monthly)
        // dateStr ที่จะเขียนลงชีท:
        const dateStr   = batchMode === "monthly" ? lastDayOfPeriod(groupKey) : groupKey;
        const period    = batchMode === "monthly" ? groupKey : (periodFromDate(groupKey) ?? "");

        const dateSums      = salesGroupMap[groupKey] ?? {};
        const allBranchKeys = Object.keys(dateSums);
        if (!allBranchKeys.length) continue;

        // ── หา branchSums สำหรับ branch นี้: id → name → partial ─────────────
        let branchSums: Record<string, number> | null = null;

        if (allBranchKeys.length === 1 && allBranchKeys[0] === "") {
          branchSums = dateSums[""];                          // ไม่มี branch column
        } else if (dateSums[normBid]) {
          branchSums = dateSums[normBid];                     // ตรง id
        } else if (branchName && dateSums[branchName]) {
          branchSums = dateSums[branchName];                  // ตรง name
          console.log(`[batch] ${dateStr}/${branchId} → matched by name "${branchName}"`);
        } else {
          const partial = allBranchKeys.find((k) =>
            k && (k.includes(normBid) || normBid.includes(k) || (branchName && k.includes(branchName)))
          );
          if (partial) {
            branchSums = dateSums[partial];
            console.log(`[batch] ${dateStr}/${branchId} → partial match "${partial}"`);
          }
        }

        if (!branchSums) {
          if (dryRun) {
            previewRows.push({
              dateStr, period: periodFromDate(dateStr) ?? "", branchId,
              branchName: idToName.get(normBid) ?? branchId,
              label:  `⚠ ไม่พบสาขาใน Helper_Sales (keys: ${allBranchKeys.slice(0, 3).join(", ")})`,
              amount: 0, channel: "", salesBase: 0, feePct: 0, status: "zero_sales",
            });
          }
          continue;
        }

        // fallback total_sales = sum of payment_* (ถ้าไม่มี total_sales field)
        if (!branchSums["total_sales"]) {
          const paySum = Object.entries(branchSums)
            .filter(([k]) => k.startsWith("payment_"))
            .reduce((s, [, v]) => s + v, 0);
          if (paySum > 0) branchSums = { ...branchSums, total_sales: paySum };
        }

        let saved = 0, skipped = 0, zeroAmt = 0;

        for (const fc of feeConfigs) {
          const isVat     = fc.field_name === "__vat__";
          const salesBase = isVat ? (branchSums["total_sales"] ?? 0) : (branchSums[fc.field_name] ?? 0);
          const feeAmt    = Math.round(salesBase * fc.fee_pct / 100 * 100) / 100;
          const existKey  = `${dateStr}|${normBid}|${normLabel(fc.label)}`;

          if (dryRun) {
            let status: "append" | "skip_existing" | "zero_sales" | "zero_pct";
            if (fc.fee_pct <= 0)                status = "zero_pct";
            else if (feeAmt <= 0)               status = "zero_sales";
            else if (existingSet.has(existKey)) status = "skip_existing";
            else                                status = "append";

            previewRows.push({
              dateStr, period, branchId,
              branchName: idToName.get(normBid) ?? branchId,
              label: fc.label, amount: feeAmt,
              channel: isVat ? "VAT" : "ค่าธรรมเนียม",
              salesBase, feePct: fc.fee_pct, status,
            });
            if (status === "append")        { existingSet.add(existKey); saved++; }
            else if (status === "skip_existing") skipped++;
            else                                 zeroAmt++;
            continue;
          }

          // ── non-dryRun: สร้าง row จริง ───────────────────────────────────────
          if (fc.fee_pct <= 0) continue;
          if (feeAmt <= 0)     { zeroAmt++; continue; }
          if (existingSet.has(existKey)) { skipped++; continue; }

          existingSet.add(existKey);

          const row = new Array(maxCols).fill("");
          // row[0] = "" (col A เว้นว่าง)
          row[expDateCol.idx] = dateStr;   // col B = index 1
          row[branchColIdx]   = branchId;
          row[catCol.idx]     = fc.label;
          row[amtCol.idx]     = feeAmt;
          if (chanCol)   row[chanCol.idx]   = isVat ? "VAT" : "ค่าธรรมเนียม";
          if (periodCol) row[periodCol.idx] = period;

          rowsToInsert.push({ row, dateMs: dateToMs(dateStr) });
          saved++;
        }

        if (saved + skipped + zeroAmt > 0)
          results.push({ date: dateStr, branchId, saved, skipped, zeroAmt });
        totalSaved   += saved;
        totalSkipped += skipped;
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 7.  Write: เขียนทุกแถวพร้อมกัน 1 call + sort sheet 1 call
    //
    //     แทนที่จะ insertDimension ทีละแถว (O(n) API calls ต่อเนื่อง ~3นาที)
    //     เราเขียน batch ครั้งเดียว แล้วให้ Sheets API sort ทั้ง sheet
    //     — ผลเหมือนกัน: แถวเรียงตาม date col เสมอ
    //     — API calls: 1 (saWriteRange) + 1 (saGetSheetMeta) + 1 (sortRange) = 3 calls
    // ═══════════════════════════════════════════════════════════════════════════
    if (!dryRun && rowsToInsert.length > 0) {
      console.log(`[batch] batch-writing ${rowsToInsert.length} rows...`);

      const allNewRows  = rowsToInsert.map((r) => r.row);
      const startRow    = expRowCount + 1;                       // 1-based, ต่อจากแถวสุดท้าย
      const endRow      = startRow + allNewRows.length - 1;
      const writeEndCol = colLetter(maxCols - 1);

      // ① เขียนทุกแถวพร้อมกัน 1 call — col A ว่าง (row[0] = "")
      await saWriteRange(
        spreadsheetId,
        `${histSheetName}!A${startRow}:${writeEndCol}${endRow}`,
        allNewRows,
      );

      // ② sort ทั้ง sheet ตาม date column (ข้าม header row 1) — 1 call
      const { sheetId } = await saGetSheetMeta(spreadsheetId, histSheetName);
      await saStructuralBatchUpdate(spreadsheetId, [{
        sortRange: {
          range:     { sheetId, startRowIndex: 1 },           // startRowIndex=1 = skip header (0-indexed)
          sortSpecs: [{ dimensionIndex: expDateCol.idx, sortOrder: "ASCENDING" }],
        },
      }]);

      saInvalidateCache(spreadsheetId);
      console.log(`[batch] done — wrote rows ${startRow}–${endRow}, sorted by col ${expDateCol.name}`);
    }

    console.log(`[batch] DONE totalSaved=${totalSaved} totalSkipped=${totalSkipped} dryRun=${dryRun}`);

    return NextResponse.json({
      ok: true,
      totalSaved,
      totalSkipped,
      dryRun,
      batchMode,
      results,
      previewRows: dryRun ? previewRows : undefined,
      dateMap:     dryRun ? salesGroupMap : undefined,   // key = dateStr (daily) or period (monthly)
      debugInfo:   dryRun ? {
        idToNameMap:       Object.fromEntries(idToName),
        dateMapDates:      Object.keys(salesGroupMap).slice(0, 10),
        dateMapBranches:   [...new Set(Object.values(salesGroupMap).flatMap((d) => Object.keys(d)))],
        feeConfigBranches: [...branchFeeConfigs.keys()],
        expDateColIdx:     expDateCol.idx,
        expDateColName:    expDateCol.name,
        batchMode,
      } : undefined,
      _debug: {
        branchIds,
        batchMode,
        idToNameMap:      Object.fromEntries(idToName),
        feeConfigBranches:[...branchFeeConfigs.keys()],
        salesGroupKeys:   Object.keys(salesGroupMap).slice(0, 5),
        salesGroupBranches: [...new Set(Object.values(salesGroupMap).flatMap((d) => Object.keys(d)))],
        existingSetSize:  existingSet.size,
        catCol:           catCol.name,
        amtCol:           amtCol.name,
        expDateCol:       `${expDateCol.name}(idx=${expDateCol.idx})`,
        periodCol:        periodCol?.name ?? null,
      },
    });
  } catch (err: any) {
    console.error("[batch] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
