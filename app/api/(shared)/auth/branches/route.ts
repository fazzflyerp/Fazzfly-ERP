/**
 * GET /api/auth/branches
 * คืน list สาขาทั้งหมดจาก client_user (ใช้สำหรับ central user เลือกสาขา)
 * อ่าน A:H → col G = branch_id, col H = branch_name
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange } from "@/lib/google-sa";

const MASTER_SHEET_ID = process.env.MASTER_SHEET_ID!;

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rows = await saReadRange(MASTER_SHEET_ID, "client_user!A:H");

    const seen = new Set<string>();
    const branches: { branchId: string; branchName: string }[] = [];

    rows.slice(1).forEach((row) => {
      const branchId   = (row[6] ?? "").toString().trim();
      const branchName = (row[7] ?? "").toString().trim();
      // ไม่เอา central — central คือ super admin ไม่ใช่สาขาจริง
      if (branchId && branchName && branchId.toLowerCase() !== "central" && !seen.has(branchId)) {
        seen.add(branchId);
        branches.push({ branchId, branchName });
      }
    });

    return NextResponse.json({ branches });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
