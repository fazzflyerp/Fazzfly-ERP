/**
 * POST /api/auth/sync-drive-token
 *
 * เรียกอัตโนมัติหลัง Admin login — บันทึก refresh token ลง client_master col I
 * - ไม่ต้องกดปุ่มใด ๆ
 * - เรียกซ้ำได้ — update เฉพาะถ้า token เปลี่ยน (ประหยัด quota)
 * - STAFF → skip เงียบ ๆ
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saWriteRange } from "@/lib/google-sa";
import { invalidateAdminDriveCache } from "@/lib/admin-drive";

const MASTER_SHEET_ID = process.env.MASTER_SHEET_ID!;

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ ok: false }, { status: 401 });

    const email        = (token.email as string).toLowerCase();
    const refreshToken = (token as any).refreshToken as string | undefined;
    if (!refreshToken) return NextResponse.json({ ok: true, skipped: true });

    // เช็ค role
    const userRows = await saReadRange(MASTER_SHEET_ID, "client_user!A:E");
    const userRow  = userRows.slice(1).find(
      (r) => (r[1] ?? "").toString().toLowerCase().trim() === email
    );
    if (!userRow) return NextResponse.json({ ok: true, skipped: true });

    const role     = (userRow[2] ?? "").toString().toUpperCase();
    const clientId = (userRow[0] ?? "").toString().trim();

    // STAFF ไม่ต้องทำอะไร
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json({ ok: true, skipped: true });
    }

    // อ่าน client_master!A:I
    const rows = await saReadRange(MASTER_SHEET_ID, "client_master!A:I");
    if (rows.length === 0) return NextResponse.json({ ok: true, skipped: true });

    const headers   = rows[0];
    const clientCol = headers.findIndex((h: string) => h.toLowerCase() === "client_id");
    let tokenColIdx = headers.findIndex((h: string) => h.toLowerCase() === "admin_refresh_token");

    // สร้าง header col I ถ้ายังไม่มี
    if (tokenColIdx === -1) {
      tokenColIdx = 8; // col I (0-indexed)
      await saWriteRange(MASTER_SHEET_ID, "client_master!I1", [["admin_refresh_token"]]);
    }

    const colLetter = String.fromCharCode(65 + tokenColIdx); // I = index 8

    // หา row ของ clientId นี้
    for (let i = 1; i < rows.length; i++) {
      const rowClientId   = (rows[i][clientCol] ?? "").toString().trim();
      const existingToken = (rows[i][tokenColIdx] ?? "").toString().trim();
      if (rowClientId !== clientId) continue;
      if (existingToken === refreshToken) break; // ไม่เปลี่ยน → skip

      await saWriteRange(
        MASTER_SHEET_ID,
        `client_master!${colLetter}${i + 1}`,
        [[refreshToken]]
      );
      invalidateAdminDriveCache(clientId);
      console.log(`✅ sync-drive-token: ${email} (${clientId}) → col ${colLetter} updated`);
      break;
    }

    return NextResponse.json({ ok: true });

  } catch (error: any) {
    console.warn("⚠️ sync-drive-token failed (non-critical):", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 200 });
  }
}
