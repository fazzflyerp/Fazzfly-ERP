/**
 * POST /api/payroll/calc-branch
 *
 * โหมด 1 — init (ต้นเดือน):
 *   คำนวณ ค่าคอม/ค่ามือ/ค่านั่ง จาก Sales เดือนที่แล้ว
 *   สร้าง/เขียนทับแถว Payroll_Transaction (preserve manual fields ถ้ามีอยู่แล้ว)
 *
 * โหมด 2 — recalc (หลังกรอก manual):
 *   ไม่ดึง Sales ใหม่ — ใช้ค่า sales/commission/ค่ามือ/ค่านั่งที่อยู่ในแถวเดิม
 *   คำนวณยอดรวมใหม่จาก manual fields ที่กรอกมา
 *
 * Body: { spreadsheetId, salesSheetName, period, branchId, mode?: "init" | "recalc" }
 *
 * Payroll_Transaction columns (0-based, A-AI = 35 cols):
 *  0  A  Period
 *  1  B  ชื่อพนักงาน
 *  2  C  ชื่อเล่น
 *  3  D  ID
 *  4  E  เงินเดือนพื้นฐาน
 *  5  F  เงินเดือนต่อวัน
 *  6  G  วันทำงาน
 *  7  H  เงินเดือนที่ได้
 *  8  I  ยอดขายย้อนหลัง 1 เดือน
 *  9  J  ค่าคอมรวม
 * 10  K  Commission ย้อนหลัง 1 เดือน (period label)
 * 11  L  ค่ามือ
 * 12  M  Bonus
 * 13  N  วันลา                    ← manual
 * 14  O  เรทการลางาน
 * 15  P  หักจากวันลา
 * 16  Q  สาย(นาที)                ← manual
 * 17  R  เรทการมาสาย
 * 18  S  หักมาสาย
 * 19  T  OT(นาที)                 ← manual
 * 20  U  เรทOT
 * 21  V  โบนัสOT
 * 22  W  เบิกเงินล่วงหน้า         ← manual
 * 23  X  ประกันสังคม
 * 24  Y  หัก ณ ที่จ่าย (ภ.ง.ด.3)
 * 25  Z  อื่นๆ                    ← manual
 * 26  AA รวมเงินรับ
 * 27  AB รวมการหัก
 * 28  AC รวมรายได้
 * 29  AD ธนาคาร/เลขบัญชี
 * 30  AE ตำแหน่ง
 * 31  AF branch_id
 * 32  AG ชั่วโมงนั่ง (หมอ)
 * 33  AH เรทค่านั่ง
 * 34  AI ค่านั่งรวม
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  saReadRange,
  saWriteRange,
  saAppendRows,
  saLog,
  saInvalidateCache,
} from "@/lib/google-sa";
import { verifySheetAccess } from "@/lib/verify-sheet-access";

const MASTER_SHEET_ID = process.env.MASTER_SHEET_ID!;
const ALLOWED_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "BRANCH_MANAGER"];

async function getUserRole(userEmail: string): Promise<string> {
  try {
    const rows = await saReadRange(MASTER_SHEET_ID, "client_user!A:C");
    const found = rows.slice(1).find((r) => (r[1] ?? "").toString().toLowerCase().trim() === userEmail);
    return found ? (found[2] ?? "STAFF").toString().trim().toUpperCase() : "STAFF";
  } catch { return "STAFF"; }
}

// ── Helper_EMP columns (0-based) ───────────────────────────────────────────
const EMP = {
  fullName:       0,  // A ชื่อพนักงาน
  id:             1,  // B ID
  position:       2,  // C ตำแหน่ง
  nickname:       3,  // D ชื่อเล่น
  baseSalary:     4,  // E เงินเดือนพื้นฐาน
  otRate:         5,  // F ค่าOT/นาที
  lateRate:       6,  // G ค่ามาสาย/นาที
  leaveRate:      7,  // H ค่าลา/วัน
  bankAccount:    8,  // I ธนาคาร/เลขบัญชี
  withholdTax:    9,  // J หัก ณ ที่จ่าย (ภ.ง.ด.3) — fixed amount per employee
  status:        12,  // M Status (A = active)
  branchId:      15,  // P branch_id
  sittingRate:   16,  // Q sitting_rate (หมอ)
  commissionRate:17,  // R commission_rate % (หมอ)
};

// ── Sales transaction columns (0-based) ────────────────────────────────────
const SALES = {
  status:      7,   // H สถานะ (ปกติ / ใช้คอร์สเก่า / ตัดคอร์ส / ...)
  program:     8,   // I ชื่อโปรแกรม
  notUsed:     10,  // K ยังไม่ใช้ (TRUE = ข้าม)
  normalPrice: 14,  // O ยอดราคาปกติ
  btStaff:     21,  // V พนักงาน BT (ใช้กรอง ค่ามือ)
  doctor:      22,  // W แพทย์
  nurseFee:    24,  // Y ค่ามือ
  period:      29,  // AD Period
  branchId:    32,  // AG branch_id
  salesStaff:  33,  // AH พนักงานขาย (ใช้กรอง ยอดขาย+ค่าคอม)
  df:          34,  // AI DF — ใช้เมื่อสถานะเป็น ใช้คอร์สเก่า/ตัดคอร์ส/ใช้ของแถม
};

// สถานะที่ใช้ col AI แทน col O
const COURSE_STATUSES = new Set(["ใช้คอร์สเก่า", "ตัดคอร์ส", "ใช้ของแถม"]);

// ── Payroll_Transaction columns (0-based) ──────────────────────────────────
const PAY_TOTAL_COLS = 35;
const PAY = {
  period:       0,
  fullName:     1,
  nickname:     2,
  id:           3,
  baseSalary:   4,
  dailyRate:    5,
  workDays:     6,
  earnedSalary: 7,
  salesTotal:   8,
  commission:   9,
  commPeriod:  10,  // label ว่าคำนวณจากเดือนไหน
  nurseFee:    11,
  bonus:       12,
  leaveDays:   13,  // ← manual
  leaveRate:   14,
  leaveDeduct: 15,
  lateMin:     16,  // ← manual
  lateRate:    17,
  lateDeduct:  18,
  otMin:       19,  // ← manual
  otRate:      20,
  otBonus:     21,
  advance:     22,  // ← manual
  socialSec:   23,
  withholdTax: 24,
  other:       25,  // ← manual
  totalIn:     26,
  totalDeduct: 27,
  netPay:      28,
  bank:        29,
  position:    30,
  branchId:    31,
  sittingHours:32,
  sittingRate: 33,
  sittingTotal:34,
};

const THAI_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const WORK_DAYS_PER_MONTH = 26;

function parseNum(v: any): number {
  if (!v && v !== 0) return 0;
  const s = v.toString().replace(/,/g, "").replace(/\s/g, "");
  if (s === "-" || s === "") return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// เปรียบเทียบ "พ.ค. 2026" → "พ.ค. 2026" (month + year)
function monthKey(period: string): string {
  return period.trim().split(/\s+/).slice(0, 2).join(" ");
}

// "พ.ค. 2026" → "เม.ย. 2026"
function prevPeriod(period: string): string {
  const parts = period.trim().split(/\s+/);
  const monthAbbr = parts[0];
  const year      = parseInt(parts[1] || "0");
  const idx = THAI_MONTHS.indexOf(monthAbbr);
  if (idx < 0) return period;
  if (idx === 0) return `${THAI_MONTHS[11]} ${year - 1}`;
  return `${THAI_MONTHS[idx - 1]} ${year}`;
}


function calcTieredCommission(
  amount: number,
  tiers: { min: number; max: number; rate: number }[]
): number {
  if (!tiers.length) return 0;
  let result = 0;
  let remaining = amount;
  for (const tier of tiers) {
    if (remaining <= 0) break;
    const bandSize = tier.max === Infinity ? remaining : Math.max(0, tier.max - tier.min);
    const inBand = Math.min(remaining, bandSize);
    result += inBand * (tier.rate / 100);
    remaining -= inBand;
  }
  return result;
}

function buildRow(params: {
  emp: any[];
  period: string;
  branchId: string;
  salesPeriod: string;
  salesTotal: number;
  commission: number;
  nurseFee: number;
  sittingHours: number;
  manual: { leaveDays: number; lateMin: number; otMin: number; advance: number; other: number };
}): any[] {
  const { emp, period, branchId, salesPeriod, salesTotal, commission, nurseFee, sittingHours, manual } = params;

  const baseSalary   = parseNum(emp[EMP.baseSalary]);
  const otRate       = parseNum(emp[EMP.otRate]);
  const lateRate     = parseNum(emp[EMP.lateRate]);
  const leaveRate    = parseNum(emp[EMP.leaveRate]);
  const socialSec    = 0; // ไม่มีใน Helper_EMP — กรอก manual ใน sheet ได้
  const sittingRate  = parseNum(emp[EMP.sittingRate]);

  const dailyRate    = baseSalary > 0 ? +(baseSalary / WORK_DAYS_PER_MONTH).toFixed(2) : 0;
  const workDays     = Math.max(0, WORK_DAYS_PER_MONTH - manual.leaveDays);
  const earnedSalary = baseSalary; // full salary, leave deducted separately

  const leaveDeduct  = manual.leaveDays * leaveRate;
  const lateDeduct   = manual.lateMin   * lateRate;
  const otBonus      = manual.otMin     * otRate;
  const sittingTotal = sittingHours     * sittingRate;

  const bonus = 0; // ให้กรอก manual ใน sheet ได้

  const totalIn     = earnedSalary + commission + nurseFee + bonus + otBonus + sittingTotal;
  const withholdTaxAmt = parseNum(emp[EMP.withholdTax]);
  const totalDeduct = leaveDeduct + lateDeduct + manual.advance + socialSec + withholdTaxAmt + manual.other;
  const netPay      = totalIn - totalDeduct;

  const row = Array(PAY_TOTAL_COLS).fill("");
  row[PAY.period]        = period;
  row[PAY.fullName]      = (emp[EMP.fullName] || "").toString().trim();
  row[PAY.nickname]      = (emp[EMP.nickname] || "").toString().trim();
  row[PAY.id]            = (emp[EMP.id]       || "").toString().trim();
  row[PAY.baseSalary]    = baseSalary;
  row[PAY.dailyRate]     = dailyRate;
  row[PAY.workDays]      = workDays;
  row[PAY.earnedSalary]  = earnedSalary;
  row[PAY.salesTotal]    = salesTotal;
  row[PAY.commission]    = commission;
  row[PAY.commPeriod]    = salesPeriod;
  row[PAY.nurseFee]      = nurseFee;
  row[PAY.bonus]         = bonus;
  row[PAY.leaveDays]     = manual.leaveDays;
  row[PAY.leaveRate]     = leaveRate;
  row[PAY.leaveDeduct]   = leaveDeduct;
  row[PAY.lateMin]       = manual.lateMin;
  row[PAY.lateRate]      = lateRate;
  row[PAY.lateDeduct]    = lateDeduct;
  row[PAY.otMin]         = manual.otMin;
  row[PAY.otRate]        = otRate;
  row[PAY.otBonus]       = otBonus;
  row[PAY.advance]       = manual.advance;
  row[PAY.socialSec]     = socialSec;
  row[PAY.withholdTax]   = withholdTaxAmt;
  row[PAY.other]         = manual.other;
  row[PAY.totalIn]       = totalIn;
  row[PAY.totalDeduct]   = totalDeduct;
  row[PAY.netPay]        = netPay;
  row[PAY.bank]          = (emp[EMP.bankAccount] || "").toString().trim();
  row[PAY.position]      = (emp[EMP.position]    || "").toString().trim();
  row[PAY.branchId]      = branchId;
  row[PAY.sittingHours]  = sittingHours;
  row[PAY.sittingRate]   = sittingRate;
  row[PAY.sittingTotal]  = sittingTotal;

  return row;
}

// ── Route ──────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((token as any).error === "RefreshAccessTokenError")
      return NextResponse.json({ error: "Session expired" }, { status: 401 });

    const userEmail = ((token as any)?.email as string || "").toLowerCase();
    const {
      spreadsheetId, salesSpreadsheetId, salesSheetName, period, branchId,
      mode = "init",
      manualOverrides = {} as Record<string, { leaveDays?: number; lateMin?: number; otMin?: number; advance?: number; other?: number }>,
    } = await request.json();

    const hrSheetId    = spreadsheetId;
    const salesSheetId = salesSpreadsheetId || spreadsheetId;

    if (!hrSheetId || !salesSheetName || !period || !branchId)
      return NextResponse.json(
        { error: "Missing: spreadsheetId, salesSheetName, period, branchId" },
        { status: 400 }
      );

    const [access, role] = await Promise.all([
      verifySheetAccess(userEmail, hrSheetId),
      getUserRole(userEmail),
    ]);
    if (!access.allowed && !ALLOWED_ROLES.includes(role))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (salesSheetId !== hrSheetId) {
      const salesAccess = await verifySheetAccess(userEmail, salesSheetId);
      if (!salesAccess.allowed && !ALLOWED_ROLES.includes(role))
        return NextResponse.json({ error: "Forbidden (sales sheet)" }, { status: 403 });
    }
    const branchLower    = branchId.toString().trim().toLowerCase();
    const salesPeriod    = prevPeriod(period); // เงินเดือน พ.ค. → ดึงยอดขาย เม.ย.
    const salesMonthKey  = monthKey(salesPeriod);

    // ── 1. Helper_EMP ──────────────────────────────────────────────────────
    const empAll = await saReadRange(hrSheetId, "Helper_EMP!A:S");
    const empRows = empAll.slice(1).filter((row) => {
      const status    = (row[EMP.status]   || "").toString().trim().toUpperCase();
      const empBranch = (row[EMP.branchId] || "").toString().trim().toLowerCase();
      return status === "A" && empBranch === branchLower;
    });

    if (empRows.length === 0)
      return NextResponse.json({ success: true, message: "ไม่มีพนักงาน active ในสาขานี้", count: 0 });

    // ── 2. Payroll_Transaction — อ่านเพื่อ preserve manual fields ─────────
    const payAll   = await saReadRange(hrSheetId, "Payroll_Transaction!A:AI", 0);
    const payData  = payAll.length > 1 ? payAll.slice(1) : [];

    const existingMap = new Map<string, { rowIndex: number; row: any[] }>();
    payData.forEach((row, i) => {
      const rPeriod = (row[PAY.period]   || "").toString().trim();
      const rBranch = (row[PAY.branchId] || "").toString().trim().toLowerCase();
      const rNick   = (row[PAY.nickname] || "").toString().trim();
      if (monthKey(rPeriod) === monthKey(period) && rBranch === branchLower && rNick) {
        existingMap.set(rNick, { rowIndex: i + 2, row });
      }
    });

    // ── 3. Sales (init mode เท่านั้น) ─────────────────────────────────────
    let salesRows: any[][] = [];
    let commissionTiers: { min: number; max: number; rate: number }[] = [];

    if (mode === "init") {
      const salesAll = await saReadRange(salesSheetId, `${salesSheetName}!A:AI`, 0); // bypass cache, include col AI = DF
      // debug: log first 3 rows' period values + total rows
      const samplePeriods = salesAll.slice(1, 4).map((r) => ({
        col29: r[29], col33: r[33], rowLen: r.length
      }));
      console.log(`[payroll] salesAll=${salesAll.length} rows, salesMonthKey="${salesMonthKey}", samples=`, JSON.stringify(samplePeriods));
      // กรองแค่ period — nickname ของพนักงานแต่ละคน (col AH/V/W) เป็น unique identifier อยู่แล้ว
      salesRows = salesAll.slice(1).filter((row) => {
        const rPeriod = (row[SALES.period] || "").toString().trim();
        return monthKey(rPeriod) === salesMonthKey;
      });

      // Commission_Config — col A=min, B=max, C=rate%, D=nickname หรือ branch_id
      // ถ้า D เป็น nickname → tier เฉพาะคน, ถ้า D ว่าง/branch_id → tier default สาขา
      try {
        const ccAll = await saReadRange(hrSheetId, "Commission_Config!A:D");
        commissionTiers = ccAll.slice(1)
          .filter((r) => r[0] !== undefined && r[0] !== "")
          .map((r) => ({
            min:      parseNum(r[0]),
            max:      r[1] !== undefined && r[1] !== "" ? parseNum(r[1]) : Infinity,
            rate:     parseNum(r[2]),
            nickname: (r[3] || "").toString().trim(), // ชื่อเล่นเฉพาะคน หรือว่าง=ทุกคน
          }))
          .sort((a, b) => a.min - b.min);
      } catch { /* Commission_Config ไม่มี = ค่าคอม 0 */ }
    }

    // ── 4. คำนวณแต่ละคน ───────────────────────────────────────────────────
    const toAppend: any[][] = [];
    const results: any[] = [];

    for (const emp of empRows) {
      const nickname       = (emp[EMP.nickname] || "").toString().trim();
      const sittingRate    = parseNum(emp[EMP.sittingRate]);
      const commissionRate = parseNum(emp[EMP.commissionRate]);
      if (!nickname) continue;

      const isDoctor = sittingRate > 0 || commissionRate > 0;
      const isSales  = !isDoctor && (emp[EMP.position] || "").toString().includes("ขาย");
      const isBT     = !isDoctor && !isSales &&
        ((emp[EMP.position] || "").toString().includes("ผู้ช่วย") ||
         (emp[EMP.position] || "").toString().includes("พยาบาล"));

      // ดึง manual fields — ถ้า request ส่ง manualOverrides มาให้ใช้นั้น, ไม่งั้นใช้จาก sheet
      const existing = existingMap.get(nickname);
      const override = (manualOverrides as any)[nickname] || {};
      const manual = {
        leaveDays:    override.leaveDays    !== undefined ? parseNum(override.leaveDays)    : (existing ? parseNum(existing.row[PAY.leaveDays])    : 0),
        lateMin:      override.lateMin      !== undefined ? parseNum(override.lateMin)      : (existing ? parseNum(existing.row[PAY.lateMin])      : 0),
        otMin:        override.otMin        !== undefined ? parseNum(override.otMin)        : (existing ? parseNum(existing.row[PAY.otMin])        : 0),
        advance:      override.advance      !== undefined ? parseNum(override.advance)      : (existing ? parseNum(existing.row[PAY.advance])      : 0),
        other:        override.other        !== undefined ? parseNum(override.other)        : (existing ? parseNum(existing.row[PAY.other])        : 0),
        sittingHours: override.sittingHours !== undefined ? parseNum(override.sittingHours) : (existing ? parseNum(existing.row[PAY.sittingHours]) : 0),
      };

      // ค่าจาก Sales (init = คำนวณใหม่, recalc = ใช้จาก existing row)
      let salesTotal = 0, commission = 0, nurseFee = 0;
      const sittingHours = manual.sittingHours;

      if (mode === "init") {
        const myBT     = salesRows.filter((r) => (r[SALES.btStaff]    || "").toString().trim() === nickname);
        const mySales  = salesRows.filter((r) => (r[SALES.salesStaff] || "").toString().trim() === nickname);
        const myDoctor = salesRows.filter((r) => (r[SALES.doctor]     || "").toString().trim() === nickname);

        if (isDoctor) {
          // กรองแถวที่ไม่นับ: มัดจำ, เปิดMember (ไม่ว่าจะมีช่องว่างหรือไม่), ยังไม่ใช้=TRUE
          const validDocRows = myDoctor.filter((r) => {
            const prog    = (r[SALES.program] || "").toString().replace(/\s/g, ""); // strip spaces
            const notUsed = (r[SALES.notUsed] || "").toString().trim().toUpperCase();
            if (prog.includes("มัดจำ") || prog.includes("เปิดMember")) return false;
            if (notUsed === "TRUE") return false;
            return true;
          });
          // debug: log แต่ละแถวที่ผ่าน filter
          console.log(`[payroll:doctor] ${nickname} validDocRows=${validDocRows.length}`, validDocRows.map((r) => ({
            status: r[SALES.status], prog: r[SALES.program], notUsed: r[SALES.notUsed], colO: r[SALES.normalPrice], colAI: r[SALES.df]
          })));
          // ถ้า status เป็น ใช้คอร์สเก่า/ตัดคอร์ส/ใช้ของแถม → ใช้ col AI (DF), ไม่งั้นใช้ col O
          salesTotal = validDocRows.reduce((s, r) => {
            const status = (r[SALES.status] || "").toString().trim();
            const val    = COURSE_STATUSES.has(status) ? parseNum(r[SALES.df]) : parseNum(r[SALES.normalPrice]);
            return s + val;
          }, 0);
          commission   = salesTotal * (commissionRate / 100); // DF หมอ
        } else if (isSales) {
          salesTotal = mySales.reduce((s, r) => s + parseNum(r[SALES.normalPrice]), 0);
          // ค่าคอม: ใช้ tier ของคนนี้ก่อน → fallback tier สาขา (ไม่มี nickname)
          const personalTiers = commissionTiers.filter((t) => (t as any).nickname === nickname);
          const tiersToUse    = personalTiers.length > 0 ? personalTiers : commissionTiers.filter((t) => !(t as any).nickname);
          commission = calcTieredCommission(salesTotal, tiersToUse);
        } else if (isBT) {
          nurseFee = myBT.reduce((s, r) => s + parseNum(r[SALES.nurseFee]), 0);
        }
      } else {
        // recalc: เอาจากแถวเดิม ไม่ดึง Sales ใหม่
        if (existing) {
          salesTotal   = parseNum(existing.row[PAY.salesTotal]);
          commission   = parseNum(existing.row[PAY.commission]);
          nurseFee     = parseNum(existing.row[PAY.nurseFee]);
        }
      }

      const row = buildRow({
        emp, period, branchId, salesPeriod,
        salesTotal, commission, nurseFee, sittingHours, manual,
      });

      const empType = isDoctor ? "doctor" : isSales ? "sales" : isBT ? "bt" : "general";
      results.push({
        nickname,
        fullName:     (emp[EMP.fullName]  || "").toString().trim(),
        position:     (emp[EMP.position]  || "").toString().trim(),
        baseSalary:   parseNum(emp[EMP.baseSalary]),
        type:         empType,
        salesTotal,
        commission:   isDoctor ? 0 : commission,
        df:           isDoctor ? commission : 0,
        nurseFee,
        sittingHours,
        sittingRate,
        sittingTotal: sittingHours * sittingRate,
        withholdTax:  parseNum(emp[EMP.withholdTax]),
        totalIn:      parseNum(row[PAY.totalIn]),
        totalDeduct:  parseNum(row[PAY.totalDeduct]),
        net:          parseNum(row[PAY.netPay]),
        // ละเอียด
        salesPeriod,
        dailyRate:    parseNum(row[PAY.dailyRate]),
        workDays:     parseNum(row[PAY.workDays]),
        leaveDays:    manual.leaveDays,
        leaveRate:    parseNum(emp[EMP.leaveRate]),
        leaveDeduct:  parseNum(row[PAY.leaveDeduct]),
        lateMin:      manual.lateMin,
        lateRate:     parseNum(emp[EMP.lateRate]),
        lateDeduct:   parseNum(row[PAY.lateDeduct]),
        otMin:        manual.otMin,
        otRate:       parseNum(emp[EMP.otRate]),
        otBonus:      parseNum(row[PAY.otBonus]),
        advance:      manual.advance,
        other:        manual.other,
      });

      if (existing) {
        await saWriteRange(
          hrSheetId,
          `Payroll_Transaction!A${existing.rowIndex}:AI${existing.rowIndex}`,
          [row]
        );
      } else {
        toAppend.push(row);
      }
    }

    if (toAppend.length > 0) {
      await saAppendRows(hrSheetId, "Payroll_Transaction!A:A", toAppend);
    }

    saInvalidateCache(hrSheetId);
    if (salesSheetId !== hrSheetId) saInvalidateCache(salesSheetId);

    await saLog(hrSheetId, {
      email:  userEmail,
      action: `PAYROLL_${mode.toUpperCase()}`,
      module: "Payroll_Transaction",
      detail: `period=${period} salesRef=${salesPeriod} branch=${branchId} count=${results.length}`,
    });

    return NextResponse.json({
      success: true,
      mode,
      period,
      salesPeriod,
      branchId,
      count: results.length,
      results,
    });

  } catch (error: any) {
    console.error("❌ [payroll/calc-branch]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
