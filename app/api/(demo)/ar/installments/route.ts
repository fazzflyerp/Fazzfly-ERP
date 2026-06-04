/**
 * GET /api/ar/installments?debt_id=AR-YYYYMMDD-XXX
 *
 * คืนตารางงวดทั้งหมดของ debt_id นั้น
 * status "pending" ที่เลย due_date แล้วจะถูก mark เป็น "overdue" อัตโนมัติ (on-read)
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange } from "@/lib/google-sa";
import { getInvAccess } from "@/lib/inv-access";

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access?.centralSheetId)
      return NextResponse.json({ error: "Not configured" }, { status: 400 });

    const debtId = request.nextUrl.searchParams.get("debt_id");
    if (!debtId) return NextResponse.json({ error: "Missing debt_id" }, { status: 400 });

    const rows = await saReadRange(access.centralSheetId, "AR_Installments!A:J", 0);

    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    today.setHours(0, 0, 0, 0);

    const installments = rows.slice(1)
      .filter((r) => (r[1] ?? "").toString().trim() === debtId)
      .map((r) => {
        const dueDate  = r[3]?.toString() ?? "";
        const paidAmt  = Number(r[5] ?? 0);
        const amount   = Number(r[4] ?? 0);
        let   status   = r[7]?.toString() ?? "pending";

        // Mark overdue on-read
        if (status === "pending" && dueDate) {
          const due = new Date(dueDate + "T00:00:00");
          if (!isNaN(due.getTime()) && due < today) status = "overdue";
        }

        return {
          inst_id:        r[0]?.toString() ?? "",
          debt_id:        r[1]?.toString() ?? "",
          installment_no: Number(r[2] ?? 0),
          due_date:       dueDate,
          amount,
          paid_amount:    paidAmt,
          paid_date:      r[6]?.toString() ?? "",
          status,
          note:           r[8]?.toString() ?? "",
        };
      })
      .sort((a, b) => a.installment_no - b.installment_no);

    return NextResponse.json({ installments });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
