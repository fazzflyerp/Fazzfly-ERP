/**
 * Commission Config API
 *
 * GET  /api/payroll/commission-config?spreadsheetId=&branchId=
 *   → คืน sales staff list + tiers ต่อคน
 *
 * POST /api/payroll/commission-config
 *   body: { spreadsheetId, tiers: [{min, max, rate, nickname}] }
 *   → เขียนทับ Commission_Config sheet
 *
 * Commission_Config columns: A=min, B=max, C=rate%, D=nickname (ว่าง=ใช้กับทุกคนในสาขา)
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saWriteRange, saInvalidateCache, saGetSheetMeta, saStructuralBatchUpdate } from "@/lib/google-sa";
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

function parseNum(v: any) { const n = parseFloat((v ?? "").toString().replace(/,/g, "")); return isNaN(n) ? 0 : n; }

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const spreadsheetId = searchParams.get("spreadsheetId");
    const branchId      = (searchParams.get("branchId") || "").trim().toLowerCase();

    if (!spreadsheetId) return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });

    const userEmail = ((token as any)?.email as string || "").toLowerCase();
    const [access, role] = await Promise.all([
      verifySheetAccess(userEmail, spreadsheetId),
      getUserRole(userEmail),
    ]);
    if (!access.allowed && role !== "SUPER_ADMIN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // พนักงานขายในสาขา (ตำแหน่งมีคำว่า "ขาย")
    const empAll = await saReadRange(spreadsheetId, "Helper_EMP!A:S");
    const salesStaff = empAll.slice(1).filter((row) => {
      const status   = (row[12] || "").toString().trim().toUpperCase();
      const branch   = (row[15] || "").toString().trim().toLowerCase();
      const position = (row[2]  || "").toString();
      const branchOk = !branchId || branch === branchId;
      return status === "A" && position.includes("ขาย") && branchOk;
    }).map((row) => ({
      nickname:  (row[3] || "").toString().trim(),
      fullName:  (row[0] || "").toString().trim(),
      position:  (row[2] || "").toString().trim(),
      branchId:  (row[15]|| "").toString().trim(),
    }));

    // อ่าน Commission_Config
    let tiers: { min: number; max: number | null; rate: number; nickname: string }[] = [];
    try {
      const ccAll = await saReadRange(spreadsheetId, "Commission_Config!A:D");
      tiers = ccAll.slice(1)
        .filter((r) => r[0] !== undefined && r[0] !== "")
        .map((r) => ({
          min:      parseNum(r[0]),
          max:      r[1] !== undefined && r[1] !== "" ? parseNum(r[1]) : null,
          rate:     parseNum(r[2]),
          nickname: (r[3] || "").toString().trim(),
        }));
    } catch { /* ยังไม่มี sheet */ }

    return NextResponse.json({ success: true, salesStaff, tiers });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userEmail = ((token as any)?.email as string || "").toLowerCase();
    const { spreadsheetId, tiers } = await request.json();

    if (!spreadsheetId) return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });

    const [access, role] = await Promise.all([
      verifySheetAccess(userEmail, spreadsheetId),
      getUserRole(userEmail),
    ]);
    if (!access.allowed && role !== "SUPER_ADMIN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // สร้าง Commission_Config sheet ถ้ายังไม่มี
    try {
      await saGetSheetMeta(spreadsheetId, "Commission_Config");
    } catch {
      await saStructuralBatchUpdate(spreadsheetId, [
        { addSheet: { properties: { title: "Commission_Config" } } },
      ]);
    }

    const header = [["min", "max", "rate%", "nickname"]];
    const rows = (tiers || []).map((t: any) => [
      t.min ?? 0,
      t.max !== null && t.max !== undefined ? t.max : "",
      t.rate ?? 0,
      t.nickname ?? "",
    ]);

    await saWriteRange(spreadsheetId, "Commission_Config!A1", [...header, ...rows]);
    saInvalidateCache(spreadsheetId);

    return NextResponse.json({ success: true, saved: rows.length });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
