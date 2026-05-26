/**
 * GET   /api/inv/liabilities — list liabilities (?po_id=, ?status=PENDING|PAID)
 * PATCH /api/inv/liabilities — mark installment as paid { liability_id, paid_date? }
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  saReadRange, saUpdateRow, saInvalidateCache,
} from "@/lib/google-sa";
import { getInvAccess, thaiTimestamp } from "@/lib/inv-access";

const LIA_SHEET = "Liabilities";
const LIA_RANGE = "Liabilities!A:J";
const PO_RANGE  = "PO!A:AB";

function parseLia(r: any[]) {
  return {
    liability_id:   String(r[0] ?? ""),
    po_id:          String(r[1] ?? ""),
    supplier_name:  String(r[2] ?? ""),
    installment_no: String(r[3] ?? ""),
    due_date:       String(r[4] ?? ""),
    amount:         String(r[5] ?? ""),
    paid_date:      String(r[6] ?? ""),
    status:         String(r[7] ?? ""),
    note:           String(r[8] ?? ""),
    created_at:     String(r[9] ?? ""),
  };
}

async function authCtx(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.email) return null;
  const email = (token.email as string).toLowerCase().trim();
  const access = await getInvAccess(email);
  if (!access || access.role !== "SUPER_ADMIN") return null;
  const sid = access.centralSheetId;
  if (!sid) return null;
  return { email, sid };
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await authCtx(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const filterPoId  = searchParams.get("po_id") ?? "";
    const filterStatus = searchParams.get("status") ?? "";

    let rows: any[][] = [];
    try {
      rows = await saReadRange(ctx.sid, LIA_RANGE, 0);
    } catch {
      // Sheet ยังไม่มี → return empty
      return NextResponse.json({ liabilities: [] });
    }
    let liabilities = rows.slice(1).filter((r) => r[0]).map(parseLia);

    if (filterPoId)   liabilities = liabilities.filter((l) => l.po_id === filterPoId);
    if (filterStatus) liabilities = liabilities.filter((l) => l.status === filterStatus);

    return NextResponse.json({ liabilities });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await authCtx(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { liability_id, paid_date, note } = body;
    if (!liability_id) return NextResponse.json({ error: "liability_id required" }, { status: 400 });

    const sid = ctx.sid;
    const ts  = thaiTimestamp();
    const today = ts.split(" ")[0]; // DD/MM/YYYY

    // Find liability row
    const liaRows = await saReadRange(sid, LIA_RANGE, 0);
    const liaIdx  = liaRows.findIndex((r, i) => i > 0 && String(r[0] ?? "") === liability_id);
    if (liaIdx < 1) return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });

    const liaRow = [...liaRows[liaIdx]];
    while (liaRow.length < 10) liaRow.push("");

    if (String(liaRow[7]) === "PAID")
      return NextResponse.json({ error: "ชำระแล้ว" }, { status: 400 });

    const paidAmt = Number(liaRow[5] ?? 0);
    const poId    = String(liaRow[1] ?? "");

    // Update liability row
    liaRow[6] = paid_date || today;
    liaRow[7] = "PAID";
    if (note) liaRow[8] = note;
    await saUpdateRow(sid, `${LIA_SHEET}!A${liaIdx + 1}`, liaRow);

    // Update PO paid_amount and outstanding_amount
    if (poId) {
      const poRows = await saReadRange(sid, PO_RANGE, 0);
      const poIdx  = poRows.findIndex((r, i) => i > 0 && String(r[0] ?? "") === poId);
      if (poIdx >= 1) {
        const poRow = [...poRows[poIdx]];
        while (poRow.length < 28) poRow.push("");
        const newPaid = (Number(poRow[16] ?? 0)) + paidAmt;
        const newOutstanding = Math.max(0, Number(poRow[17] ?? 0) - paidAmt);
        poRow[16] = Math.round(newPaid * 100) / 100;
        poRow[17] = Math.round(newOutstanding * 100) / 100;
        await saUpdateRow(sid, `PO!A${poIdx + 1}`, poRow);
      }
    }

    saInvalidateCache(sid);
    return NextResponse.json({ ok: true, liability_id, paid_amount: paidAmt });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
