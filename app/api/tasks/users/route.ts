/**
 * GET /api/tasks/users → รายชื่อ user ทุกคนใน client เดียวกัน (ยกเว้นตัวเอง)
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange } from "@/lib/google-sa";

const MASTER_SHEET_ID = process.env.MASTER_SHEET_ID!;

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userEmail = ((token as any)?.email as string || "").toLowerCase();

    const rows = await saReadRange(MASTER_SHEET_ID, "client_user!A:E");
    const userRow = rows.slice(1).find((r) => (r[1] ?? "").toString().toLowerCase().trim() === userEmail);
    if (!userRow) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const clientId = (userRow[0] ?? "").toString().trim();

    const users = rows.slice(1)
      .filter((r) => {
        const cId    = (r[0] ?? "").toString().trim();
        const email  = (r[1] ?? "").toString().toLowerCase().trim();
        const active = (r[3] ?? "").toString().toUpperCase() === "TRUE";
        return cId === clientId && email !== userEmail && email !== "" && active;
      })
      .map((r) => ({
        email: (r[1] ?? "").toString().toLowerCase().trim(),
        role:  (r[2] ?? "STAFF").toString().toUpperCase(),
      }));

    return NextResponse.json({ success: true, users });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
