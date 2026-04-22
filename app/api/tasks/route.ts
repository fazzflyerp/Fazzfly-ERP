/**
 * Tasks API
 * GET  /api/tasks  → ดึง tasks ของ user ปัจจุบัน
 * POST /api/tasks  → สร้าง task ใหม่
 *
 * tasks sheet columns (Client's own spreadsheet):
 * A: taskId | B: clientId | C: assignerEmail | D: assigneeEmail
 * E: title  | F: dueDate  | G: status        | H: createdAt | I: isRead
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saAppendRow } from "@/lib/google-sa";
import { getClientMainSheet } from "@/lib/client-spreadsheet";

const MASTER_SHEET_ID = process.env.MASTER_SHEET_ID!;
const TASKS_SHEET = "tasks";

async function ensureTasksSheet(spreadsheetId: string): Promise<void> {
  const { getSheetsClient } = await import("@/lib/google-sa");
  const sheets = getSheetsClient();
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const exists = (meta.data.sheets || []).some((s) => s.properties?.title === TASKS_SHEET);
    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: TASKS_SHEET } } }] },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${TASKS_SHEET}!A1:I1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [["taskId","clientId","assignerEmail","assigneeEmail","title","dueDate","status","createdAt","isRead"]],
        },
      });
    }
  } catch (err: any) {
    console.warn("ensureTasksSheet:", err.message);
  }
}

function parseTask(row: any[], idx: number) {
  return {
    taskId:        row[0] ?? `task_${idx}`,
    clientId:      row[1] ?? "",
    assignerEmail: row[2] ?? "",
    assigneeEmail: row[3] ?? "",
    title:         row[4] ?? "",
    dueDate:       row[5] ?? "",
    status:        row[6] ?? "pending",
    createdAt:     row[7] ?? "",
    isRead:        row[8]?.toString().toLowerCase() === "true",
  };
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userEmail = ((token as any)?.email as string || "").toLowerCase();

    const userRows = await saReadRange(MASTER_SHEET_ID, "client_user!A:E");
    const userRow = userRows.slice(1).find(
      (r) => (r[1] ?? "").toString().toLowerCase().trim() === userEmail
    );
    if (!userRow) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const clientId = (userRow[0] ?? "").toString().trim();

    const spreadsheetId = await getClientMainSheet(clientId);
    if (!spreadsheetId)
      return NextResponse.json({ error: "No spreadsheet configured for this client" }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") || "inbox";

    await ensureTasksSheet(spreadsheetId);

    let rows: any[][] = [];
    try {
      rows = await saReadRange(spreadsheetId, `${TASKS_SHEET}!A:I`);
    } catch { rows = []; }

    const tasks = rows.slice(1)
      .map((r, i) => parseTask(r, i))
      .filter((t) => {
        if (mode === "inbox") return t.assigneeEmail === userEmail;
        if (mode === "sent")  return t.assignerEmail === userEmail;
        return t.assigneeEmail === userEmail || t.assignerEmail === userEmail;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const unreadCount = tasks.filter((t) => !t.isRead && t.assigneeEmail === userEmail).length;

    return NextResponse.json({ success: true, tasks, unreadCount });

  } catch (error: any) {
    console.error("❌ [tasks GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userEmail = ((token as any)?.email as string || "").toLowerCase();

    const userRows = await saReadRange(MASTER_SHEET_ID, "client_user!A:E");
    const userRow = userRows.slice(1).find(
      (r) => (r[1] ?? "").toString().toLowerCase().trim() === userEmail
    );
    if (!userRow) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const clientId = (userRow[0] ?? "").toString().trim();

    const spreadsheetId = await getClientMainSheet(clientId);
    if (!spreadsheetId)
      return NextResponse.json({ error: "No spreadsheet configured for this client" }, { status: 404 });

    const body = await request.json();
    const { assigneeEmail, title, dueDate } = body;
    if (!assigneeEmail || !title)
      return NextResponse.json({ error: "Missing assigneeEmail or title" }, { status: 400 });

    await ensureTasksSheet(spreadsheetId);

    const taskId   = `T${Date.now()}`;
    const createdAt = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });

    await saAppendRow(spreadsheetId, `${TASKS_SHEET}!A:I`, [
      taskId, clientId, userEmail, assigneeEmail.toLowerCase(),
      title, dueDate || "", "pending", createdAt, "false",
    ]);

    return NextResponse.json({ success: true, taskId });

  } catch (error: any) {
    console.error("❌ [tasks POST]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
