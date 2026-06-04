/**
 * POST /api/ar/pay
 *
 * บันทึกรับชำระหนี้
 * Body: { debt_id, inst_id?, amount, payment_method?, note? }
 *
 * Actions:
 *   1. ตรวจ debt + ยอดไม่เกิน remaining
 *   2. อัพเดต AR_Debts: paid_amount, remaining, status
 *   3. ถ้ามี inst_id → อัพเดต AR_Installments: paid_amount, paid_date, status
 *   4. Append AR_Payments (log)
 *
 * AR_Payments columns (A:J):
 *   payment_id | paid_at | debt_id | inst_id | amount |
 *   payment_method | customer_name | branch_id | note | recorded_by
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  saReadRange, saUpdateRow, saAppendRow,
  saStructuralBatchUpdate, saInvalidateCache,
} from "@/lib/google-sa";
import { getInvAccess, thaiTimestamp, genId, todayStr } from "@/lib/inv-access";

const PAY_SHEET   = "AR_Payments";
const PAY_HEADERS = [
  "payment_id","paid_at","debt_id","inst_id","amount",
  "payment_method","customer_name","branch_id","note","recorded_by",
];

async function ensurePaySheet(sid: string) {
  try {
    await saReadRange(sid, `${PAY_SHEET}!A1`, 0);
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    if (!msg.includes("Unable to parse range") && !msg.includes("not found")) throw err;
    await saStructuralBatchUpdate(sid, [{ addSheet: { properties: { title: PAY_SHEET } } }]);
    await saUpdateRow(sid, `${PAY_SHEET}!A1:J1`, PAY_HEADERS);
    saInvalidateCache(sid);
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access?.centralSheetId)
      return NextResponse.json({ error: "AR not configured" }, { status: 400 });

    const {
      debt_id, inst_id = "",
      amount, payment_method = "เงินสด", note = "",
    } = await request.json();

    if (!debt_id || !amount || Number(amount) <= 0)
      return NextResponse.json({ error: "กรุณาระบุ debt_id และยอดชำระ" }, { status: 400 });

    const sid    = access.centralSheetId;
    const ts     = thaiTimestamp();
    const payAmt = Number(amount);

    // ── 1. ดึง debt row ──────────────────────────────────────────────────────
    const debtRows = await saReadRange(sid, "AR_Debts!A:P", 0);
    const debtIdx  = debtRows.findIndex((r, i) => i > 0 && r[0]?.toString() === debt_id);
    if (debtIdx < 1)
      return NextResponse.json({ error: "ไม่พบรายการหนี้" }, { status: 404 });

    const debtRow        = debtRows[debtIdx];
    const currentPaid    = Number(debtRow[6] ?? 0);
    const currentRemain  = Number(debtRow[7] ?? 0);
    const customerName   = debtRow[2]?.toString() ?? "";
    const branchId       = debtRow[11]?.toString() ?? "";

    if (payAmt > currentRemain + 0.01) // tolerance เศษสตางค์
      return NextResponse.json({
        error: `ยอดชำระเกินคงค้าง: ค้างอยู่ ฿${currentRemain.toLocaleString("th-TH")}`,
      }, { status: 409 });

    const newPaid   = Math.round((currentPaid + payAmt) * 100) / 100;
    const newRemain = Math.max(0, Math.round((currentRemain - payAmt) * 100) / 100);
    const newStatus = newRemain <= 0 ? "settled" : "active";

    // ── 2. อัพเดต AR_Debts ────────────────────────────────────────────────────
    const updatedDebt = [...debtRow];
    updatedDebt[6]  = newPaid;
    updatedDebt[7]  = newRemain;
    updatedDebt[13] = newStatus;
    await saUpdateRow(sid, `AR_Debts!A${debtIdx + 1}`, updatedDebt);

    // ── 3. อัพเดต AR_Installments ─────────────────────────────────────────────
    if (inst_id) {
      const instRows = await saReadRange(sid, "AR_Installments!A:J", 0);
      const instIdx  = instRows.findIndex((r, i) => i > 0 && r[0]?.toString() === inst_id);
      if (instIdx >= 1) {
        const instRow     = [...instRows[instIdx]];
        const instAmt     = Number(instRow[4] ?? 0);
        const prevInstPaid = Number(instRow[5] ?? 0);
        const newInstPaid  = Math.round((prevInstPaid + payAmt) * 100) / 100;
        const today        = todayStr(); // YYYY-MM-DD
        instRow[5] = newInstPaid;
        instRow[6] = today;
        instRow[7] = newInstPaid >= instAmt - 0.01 ? "paid" : "partial";
        instRow[9] = ts;
        await saUpdateRow(sid, `AR_Installments!A${instIdx + 1}`, instRow);
      }
    }

    // ── 4. Append AR_Payments ─────────────────────────────────────────────────
    await ensurePaySheet(sid);
    const payId = await genId("ARPAY", sid, PAY_SHEET);
    await saAppendRow(sid, `${PAY_SHEET}!A:J`, [
      payId, ts, debt_id, inst_id, payAmt,
      payment_method, customerName, branchId, note, email,
    ]);

    saInvalidateCache(sid);

    return NextResponse.json({
      ok: true,
      payment_id:    payId,
      new_paid:      newPaid,
      new_remaining: newRemain,
      status:        newStatus,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
