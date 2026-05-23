/**
 * Doctor Schedule API
 *
 * GET  /api/payroll/doctor-schedule?spreadsheetId=&period=&branchId=
 *   → คืน schedule ของหมอทั้งหมดในงวดนั้น + list หมอจาก Helper_EMP
 *
 * POST /api/payroll/doctor-schedule
 *   body: { spreadsheetId, period, branchId, entries: [{date, nickname, hours}] }
 *   → เขียนทับ Doctor_Schedule สำหรับ period+branch นั้น
 *
 * Doctor_Schedule columns (A-E):
 *   A: Period  B: Date  C: nickname  D: hours  E: branch_id
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saWriteRange, saAppendRows, saInvalidateCache } from "@/lib/google-sa";
import { verifySheetAccess } from "@/lib/verify-sheet-access";

const EMP_NICKNAME     = 3;
const EMP_POSITION     = 2;
const EMP_STATUS       = 12;
const EMP_BRANCH       = 15;
const EMP_SITTING_RATE = 16;
const EMP_COMM_RATE    = 17;

const SCH_PERIOD   = 0;
const SCH_DATE     = 1;
const SCH_NICKNAME = 2;
const SCH_HOURS    = 3;
const SCH_BRANCH   = 4;

function monthKey(period: string) { return period.trim().split(/\s+/)[0]; }
function parseNum(v: any) { const n = parseFloat((v ?? "").toString().replace(/,/g, "")); return isNaN(n) ? 0 : n; }

// ── GET ────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const spreadsheetId = searchParams.get("spreadsheetId");
    const period        = searchParams.get("period");
    const branchId      = (searchParams.get("branchId") || "").trim().toLowerCase();

    if (!spreadsheetId || !period)
      return NextResponse.json({ error: "Missing spreadsheetId or period" }, { status: 400 });

    const userEmail = ((token as any)?.email as string || "").toLowerCase();
    const access = await verifySheetAccess(userEmail, spreadsheetId);
    if (!access.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // หมอในสาขา
    const empAll = await saReadRange(spreadsheetId, "Helper_EMP!A:S");
    const doctors = empAll.slice(1).filter((row) => {
      const status   = (row[EMP_STATUS]   || "").toString().trim().toUpperCase();
      const branch   = (row[EMP_BRANCH]   || "").toString().trim().toLowerCase();
      const sitting  = parseNum(row[EMP_SITTING_RATE]);
      const commRate = parseNum(row[EMP_COMM_RATE]);
      const isDoctor = sitting > 0 || commRate > 0;
      const branchOk = !branchId || branch === branchId;
      return status === "A" && isDoctor && branchOk;
    }).map((row) => ({
      nickname:    (row[EMP_NICKNAME] || "").toString().trim(),
      position:    (row[EMP_POSITION] || "").toString().trim(),
      sittingRate: parseNum(row[EMP_SITTING_RATE]),
    }));

    // อ่าน schedule ที่มีอยู่
    let scheduleRows: any[][] = [];
    try {
      scheduleRows = await saReadRange(spreadsheetId, "Doctor_Schedule!A:E");
    } catch { /* sheet ยังไม่มี */ }

    const mk = monthKey(period);
    const entries: { date: string; nickname: string; hours: number }[] = [];

    (scheduleRows.length > 1 ? scheduleRows.slice(1) : []).forEach((row) => {
      const rPeriod = (row[SCH_PERIOD]   || "").toString().trim();
      const rBranch = (row[SCH_BRANCH]   || "").toString().trim().toLowerCase();
      const branchOk = !branchId || rBranch === branchId;
      if (monthKey(rPeriod) === mk && branchOk) {
        entries.push({
          date:     (row[SCH_DATE]     || "").toString().trim(),
          nickname: (row[SCH_NICKNAME] || "").toString().trim(),
          hours:    parseNum(row[SCH_HOURS]),
        });
      }
    });

    return NextResponse.json({ success: true, doctors, entries });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── POST ───────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userEmail = ((token as any)?.email as string || "").toLowerCase();
    const { spreadsheetId, period, branchId, entries } = await request.json();

    if (!spreadsheetId || !period || !branchId)
      return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const access = await verifySheetAccess(userEmail, spreadsheetId);
    if (!access.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const branchLower = branchId.toString().trim().toLowerCase();
    const mk = monthKey(period);

    // อ่าน sheet เดิม
    let allRows: any[][] = [];
    try {
      allRows = await saReadRange(spreadsheetId, "Doctor_Schedule!A:E");
    } catch { /* ยังไม่มี sheet */ }

    const header = allRows.length > 0 ? allRows[0] : ["Period","Date","nickname","hours","branch_id"];
    const dataRows = allRows.length > 1 ? allRows.slice(1) : [];

    // กรองเอาแถวที่ไม่ใช่ period+branch นี้ออก (เก็บของสาขา/งวดอื่นไว้)
    const kept = dataRows.filter((row) => {
      const rPeriod = (row[SCH_PERIOD] || "").toString().trim();
      const rBranch = (row[SCH_BRANCH] || "").toString().trim().toLowerCase();
      return !(monthKey(rPeriod) === mk && rBranch === branchLower);
    });

    // แถวใหม่จาก entries ที่ส่งมา (hours > 0 เท่านั้น)
    const newRows = (entries || [])
      .filter((e: any) => e.hours > 0 && e.nickname && e.date)
      .map((e: any) => [period, e.date, e.nickname, e.hours, branchId]);

    const finalData = [header, ...kept, ...newRows];

    await saWriteRange(spreadsheetId, "Doctor_Schedule!A1", finalData);
    saInvalidateCache(spreadsheetId);

    return NextResponse.json({ success: true, saved: newRows.length });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
