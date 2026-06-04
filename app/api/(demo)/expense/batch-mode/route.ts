/**
 * GET  /api/expense/batch-mode?spreadsheetId=
 * POST /api/expense/batch-mode  { spreadsheetId, mode: "daily" | "monthly" }
 *
 * เก็บโหมดใน Expense_FeeConfig เป็น row พิเศษ:
 *   field_name=__batch_mode__  |  label=<mode>  |  fee_pct=0  |  active=true  |  branch_id=__global__
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saWriteRange, saAppendRow, saInvalidateCache } from "@/lib/google-sa";

const SHEET      = "Expense_FeeConfig";
const FIELD_NAME = "__batch_mode__";
const BRANCH_ID  = "__global__";

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const spreadsheetId = request.nextUrl.searchParams.get("spreadsheetId") || "";
    if (!spreadsheetId) return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });

    const rows = await saReadRange(spreadsheetId, `${SHEET}!A:B`).catch(() => [] as any[][]);
    const mr   = rows.slice(1).find((r) => (r[0] ?? "").toString().trim() === FIELD_NAME);
    const mode = mr ? ((mr[1] ?? "daily").toString().trim() === "monthly" ? "monthly" : "daily") : "daily";

    return NextResponse.json({ mode });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { spreadsheetId, mode } = await request.json();
    if (!spreadsheetId || !["daily", "monthly"].includes(mode))
      return NextResponse.json({ error: "Invalid params" }, { status: 400 });

    // หา row ที่มีอยู่แล้ว
    const rows = await saReadRange(spreadsheetId, `${SHEET}!A:E`).catch(() => [] as any[][]);
    let existingRowNum = -1;
    for (let i = 1; i < rows.length; i++) {
      if ((rows[i][0] ?? "").toString().trim() === FIELD_NAME) {
        existingRowNum = i + 1; // 1-based sheet row
        break;
      }
    }

    if (existingRowNum > 0) {
      await saWriteRange(spreadsheetId, `${SHEET}!A${existingRowNum}:E${existingRowNum}`,
        [[FIELD_NAME, mode, 0, "true", BRANCH_ID]]);
    } else {
      await saAppendRow(spreadsheetId, `${SHEET}!A:E`, [FIELD_NAME, mode, 0, "true", BRANCH_ID]);
    }

    saInvalidateCache(spreadsheetId);
    return NextResponse.json({ ok: true, mode });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
