/**
 * GET /api/auth/branch-check
 *
 * อ่านชีท client_user A:H คืน branchId + branchName ของ user ที่ login
 *
 * client_user columns:
 *   A: client_id | B: user_email | C: role | D: is_active | E: notes | F: (skip) | G: branch_id | H: branch_name
 *
 * Response: { branchId: string | null, branchName: string | null }
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange } from "@/lib/google-sa";

const MASTER_SHEET_ID = process.env.MASTER_SHEET_ID!;
const SHEET_NAME = "client_user";

// Server-side cache 5 min
interface CacheEntry { branchId: string | null; branchName: string | null; role: string; expiry: number }
const _cache = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = (token.email as string).toLowerCase();

    const cached = _cache.get(email);
    if (cached && Date.now() < cached.expiry) {
      return NextResponse.json({ branchId: cached.branchId, branchName: cached.branchName, role: cached.role, cached: true });
    }

    const rows = await saReadRange(MASTER_SHEET_ID, `${SHEET_NAME}!A:H`);

    const found = rows.slice(1).find((row) => {
      const rowEmail = (row[1] ?? "").toString().toLowerCase().trim();
      return rowEmail === email;
    });

    if (!found) {
      return NextResponse.json({ error: "User not found" }, { status: 403 });
    }

    const rawBranchId   = (found[6] ?? "").toString().trim();
    const rawBranchName = (found[7] ?? "").toString().trim();
    const role          = (found[2] ?? "STAFF").toString().trim().toUpperCase();

    const branchId   = rawBranchId.length   > 0 ? rawBranchId   : null;
    const branchName = rawBranchName.length > 0 ? rawBranchName : null;

    _cache.set(email, { branchId, branchName, role, expiry: Date.now() + TTL_MS });

    return NextResponse.json({ branchId, branchName, role });
  } catch (error: any) {
    console.error("❌ [branch-check] Error:", error.message);
    return NextResponse.json(
      { error: "Failed to check branch", message: error.message },
      { status: 500 }
    );
  }
}
