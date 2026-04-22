/**
 * =============================================================================
 * FILE: app/api/auth/user-role/route.ts
 * =============================================================================
 * GET /api/auth/user-role
 *
 * อ่านชีท client_user ผ่าน Service Account แล้วคืน role ของ user ที่ login
 *
 * client_user columns:
 *   A: client_id | B: user_email | C: role | D: is_active | E: notes
 *
 * Roles: SUPER_ADMIN | ADMIN | STAFF
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange } from "@/lib/google-sa";

const MASTER_SHEET_ID = process.env.MASTER_SHEET_ID!;
const SHEET_NAME      = "client_user";

// ─── Server-side cache (TTL 5 นาที) ─────────────────────────────────────────
interface RoleEntry {
  clientId: string;
  role: string;
  expiry: number;
}
const _roleCache = new Map<string, RoleEntry>(); // key = email
const TTL_MS = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    // 1. ดึง session
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = (token.email as string).toLowerCase();

    // 2. เช็ค cache
    const cached = _roleCache.get(email);
    if (cached && Date.now() < cached.expiry) {
      return NextResponse.json({ clientId: cached.clientId, role: cached.role, cached: true });
    }

    // 3. อ่าน client_user ผ่าน SA
    const rows = await saReadRange(MASTER_SHEET_ID, `${SHEET_NAME}!A:E`);

    // 4. หา user จาก email (column B = index 1)
    const found = rows.slice(1).find((row) => {
      const rowEmail = (row[1] ?? "").toString().toLowerCase().trim();
      return rowEmail === email;
    });

    if (!found) {
      return NextResponse.json(
        { error: "User not found", code: "USER_NOT_FOUND" },
        { status: 403 }
      );
    }

    const clientId = (found[0] ?? "").toString().trim();
    const role     = (found[2] ?? "STAFF").toString().trim().toUpperCase();
    const isActive = (found[3] ?? "").toString().toUpperCase() === "TRUE";

    if (!isActive) {
      return NextResponse.json(
        { error: "Account is inactive", code: "ACCOUNT_INACTIVE" },
        { status: 403 }
      );
    }

    // 5. บันทึก cache
    _roleCache.set(email, { clientId, role, expiry: Date.now() + TTL_MS });

    return NextResponse.json({ clientId, role });

  } catch (error: any) {
    console.error("❌ [user-role] Error:", error.message);
    return NextResponse.json(
      { error: "Failed to get user role", message: error.message },
      { status: 500 }
    );
  }
}

// ─── Utility: ล้าง cache เมื่อ admin อัปเดต role ────────────────────────────
export function clearRoleCache(email?: string) {
  if (email) {
    _roleCache.delete(email.toLowerCase());
  } else {
    _roleCache.clear();
  }
}
