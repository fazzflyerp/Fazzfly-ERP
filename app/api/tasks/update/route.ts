/**
 * Tasks Update API
 * PATCH /api/tasks/update  → { taskId, status?, isRead? }
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saWriteRange } from "@/lib/google-sa";
import { getClientMainSheet } from "@/lib/client-spreadsheet";

const MASTER_SHEET_ID = process.env.MASTER_SHEET_ID!;
const TASKS_SHEET = "tasks";

export async function PATCH(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userEmail = ((token as any)?.email as string || "").toLowerCase();
    const body = await request.json();
    const { taskId, status, isRead } = body;
    if (!taskId) return NextResponse.json({ error: "Missing taskId" }, { status: 400 });

    // หา clientId ของ user
    const userRows = await saReadRange(MASTER_SHEET_ID, "client_user!A:E");
    const userRow = userRows.slice(1).find(
      (r) => (r[1] ?? "").toString().toLowerCase().trim() === userEmail
    );
    if (!userRow) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const clientId = (userRow[0] ?? "").toString().trim();

    const spreadsheetId = await getClientMainSheet(clientId);
    if (!spreadsheetId)
      return NextResponse.json({ error: "No spreadsheet configured for this client" }, { status: 404 });

    const rows = await saReadRange(spreadsheetId, `${TASKS_SHEET}!A:I`);
    const rowIdx = rows.slice(1).findIndex((r) => r[0]?.toString() === taskId);
    if (rowIdx === -1) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const sheetRow = rowIdx + 2;
    const row = [...rows[rowIdx + 1]];
    while (row.length < 9) row.push("");

    if (status  !== undefined) row[6] = status;
    if (isRead  !== undefined) row[8] = isRead.toString();

    await saWriteRange(spreadsheetId, `${TASKS_SHEET}!A${sheetRow}:I${sheetRow}`, [row]);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("❌ [tasks PATCH]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
