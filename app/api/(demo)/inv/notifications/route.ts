/**
 * GET  /api/inv/notifications  — unread notifications ของ user หรือ branch
 * POST /api/inv/notifications  — mark as read { notif_id } หรือ { markAllBranchId }
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saUpdateRow, saInvalidateCache } from "@/lib/google-sa";
import { getInvAccess } from "@/lib/inv-access";

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access || !access.centralSheetId)
      return NextResponse.json({ notifications: [] });

    const rows = await saReadRange(access.centralSheetId, "INV_Notification!A:H");

    const targetId = access.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : (access.branchId ?? "");

    const notifications = rows.slice(1)
      .map((r: any[], i: number) => ({
        _row: i + 2, // 1-based sheet row (header = row 1)
        notif_id:     (r[0] ?? "").toString(),
        target_email: (r[1] ?? "").toString(),
        branch_id:    (r[2] ?? "").toString(),
        type:         (r[3] ?? "").toString(),
        message:      (r[4] ?? "").toString(),
        ref_id:       (r[5] ?? "").toString(),
        is_read:      (r[6] ?? "FALSE").toString().toUpperCase() === "TRUE",
        created_at:   (r[7] ?? "").toString(),
      }))
      .filter((n) =>
        n.notif_id &&
        !n.is_read &&
        (n.target_email === targetId || n.branch_id === targetId ||
         (access.role === "SUPER_ADMIN" && n.target_email === "SUPER_ADMIN"))
      )
      .reverse()
      .slice(0, 50);

    return NextResponse.json({ notifications, unread: notifications.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access || !access.centralSheetId)
      return NextResponse.json({ error: "Not configured" }, { status: 400 });

    const body = await request.json();
    const { notif_id } = body;

    if (!notif_id) return NextResponse.json({ error: "Missing notif_id" }, { status: 400 });

    const sid  = access.centralSheetId;
    const rows = await saReadRange(sid, "INV_Notification!A:H", 0);

    const rowIdx = rows.findIndex(
      (r, i) => i > 0 && (r[0] ?? "").toString() === notif_id
    );
    if (rowIdx < 1) return NextResponse.json({ error: "Notification not found" }, { status: 404 });

    const row    = [...rows[rowIdx]];
    row[6]       = "TRUE";
    const sheetRow = rowIdx + 1;
    await saUpdateRow(sid, `INV_Notification!A${sheetRow}`, row);
    saInvalidateCache(sid);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
