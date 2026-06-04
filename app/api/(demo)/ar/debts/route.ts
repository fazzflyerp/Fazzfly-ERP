/**
 * GET  /api/ar/debts        — รายการลูกหนี้ทั้งหมด (SA=ทุกสาขา, BRANCH=สาขาตัวเอง)
 * POST /api/ar/debts        — สร้างลูกหนี้ใหม่ + auto-generate ตารางงวด
 *
 * AR_Debts columns (A:P):
 *   debt_id | created_at | customer_name | customer_phone | debt_type |
 *   total_amount | paid_amount | remaining | installment_count |
 *   first_due_date | source_ref | branch_id | branch_name |
 *   status | note | created_by
 *   (index)  0         1              2              3              4
 *            5             6             7          8
 *            9              10           11         12
 *            13     14    15
 *
 * AR_Installments columns (A:J):
 *   inst_id | debt_id | installment_no | due_date | amount |
 *   paid_amount | paid_date | status | note | updated_at
 *   (index) 0        1         2               3          4
 *           5             6          7        8      9
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  saReadRange, saUpdateRow, saAppendRow,
  saStructuralBatchUpdate, saInvalidateCache,
} from "@/lib/google-sa";
import { getInvAccess, thaiTimestamp, genId, todayStr } from "@/lib/inv-access";

// ── Sheet definitions ────────────────────────────────────────────────────────
const DEBTS_SHEET   = "AR_Debts";
const DEBTS_HEADERS = [
  "debt_id","created_at","customer_name","customer_phone","debt_type",
  "total_amount","paid_amount","remaining","installment_count",
  "first_due_date","source_ref","branch_id","branch_name",
  "status","note","created_by",
];

const INST_SHEET   = "AR_Installments";
const INST_HEADERS = [
  "inst_id","debt_id","installment_no","due_date","amount",
  "paid_amount","paid_date","status","note","updated_at",
];

// ── Helper ───────────────────────────────────────────────────────────────────
async function ensureSheet(sid: string, name: string, headers: string[], range: string) {
  try {
    await saReadRange(sid, `${name}!A1`, 0);
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    if (!msg.includes("Unable to parse range") && !msg.includes("not found")) throw err;
    await saStructuralBatchUpdate(sid, [{ addSheet: { properties: { title: name } } }]);
    await saUpdateRow(sid, range, headers);
    saInvalidateCache(sid);
  }
}

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access?.centralSheetId)
      return NextResponse.json({ error: "AR not configured (ต้องตั้งค่า INV Central ก่อน)" }, { status: 400 });

    const sid   = access.centralSheetId;
    const isSA  = access.role === "SUPER_ADMIN";

    // อ่าน 2 sheets พร้อมกัน
    const [debtRows, instRows] = await Promise.all([
      saReadRange(sid, `${DEBTS_SHEET}!A:P`, 0).catch(() => [] as any[][]),
      saReadRange(sid, `${INST_SHEET}!A:J`, 0).catch(() => [] as any[][]),
    ]);

    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    today.setHours(0, 0, 0, 0);

    // Build installment index: debt_id → rows[]
    const instByDebt = new Map<string, any[][]>();
    for (const r of instRows.slice(1)) {
      const did = (r[1] ?? "").toString().trim();
      if (!did) continue;
      if (!instByDebt.has(did)) instByDebt.set(did, []);
      instByDebt.get(did)!.push(r);
    }

    const debts = debtRows.slice(1)
      .filter((r) => r[0])
      .map((r) => {
        const debtId    = r[0]?.toString() ?? "";
        const remaining = Number(r[7] ?? 0);
        const branchId  = r[11]?.toString() ?? "";

        // Compute live status
        let status: string;
        if (remaining <= 0) {
          status = "settled";
        } else {
          const hasOverdue = (instByDebt.get(debtId) ?? []).some((i) => {
            if ((i[7] ?? "").toString() !== "pending") return false;
            const due = new Date((i[3] ?? "").toString() + "T00:00:00");
            return !isNaN(due.getTime()) && due < today;
          });
          status = hasOverdue ? "overdue" : "active";
        }

        // Next pending installment (earliest due_date)
        const pending = (instByDebt.get(debtId) ?? [])
          .filter((i) => (i[7] ?? "").toString() === "pending")
          .sort((a, b) => (a[3] ?? "").toString().localeCompare((b[3] ?? "").toString()));

        const nxt = pending[0] ?? null;

        return {
          debt_id:          debtId,
          created_at:       r[1]?.toString() ?? "",
          customer_name:    r[2]?.toString() ?? "",
          customer_phone:   r[3]?.toString() ?? "",
          debt_type:        r[4]?.toString() ?? "credit",
          total_amount:     Number(r[5] ?? 0),
          paid_amount:      Number(r[6] ?? 0),
          remaining,
          installment_count: Number(r[8] ?? 1),
          first_due_date:   r[9]?.toString() ?? "",
          source_ref:       r[10]?.toString() ?? "",
          branch_id:        branchId,
          branch_name:      r[12]?.toString() ?? "",
          status,
          note:             r[14]?.toString() ?? "",
          created_by:       r[15]?.toString() ?? "",
          // runtime extras
          next_due_date:    nxt ? nxt[3]?.toString() : null,
          next_due_amount:  nxt ? Number(nxt[4] ?? 0) : null,
          next_inst_id:     nxt ? nxt[0]?.toString() : null,
          pending_count:    pending.length,
        };
      })
      .filter((d) => isSA || d.branch_id === access.branchId);

    return NextResponse.json({ debts, spreadsheetId: sid });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── POST ─────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access?.centralSheetId)
      return NextResponse.json({ error: "AR not configured" }, { status: 400 });

    const {
      customer_name, customer_phone = "",
      debt_type = "credit",           // "installment" | "credit"
      total_amount, down_payment = 0,
      installment_count = 1,
      first_due_date,                 // YYYY-MM-DD
      branch_id, branch_name,
      source_ref = "", note = "",
    } = await request.json();

    if (!customer_name || !total_amount || Number(total_amount) <= 0)
      return NextResponse.json({ error: "กรุณาระบุชื่อลูกค้าและยอดหนี้" }, { status: 400 });
    if (!first_due_date)
      return NextResponse.json({ error: "กรุณาระบุวันครบกำหนดงวดแรก" }, { status: 400 });

    const sid         = access.centralSheetId;
    const ts          = thaiTimestamp();
    const totalAmt    = Number(total_amount);
    const downAmt     = Number(down_payment) || 0;
    const remaining   = totalAmt - downAmt;
    const instCount   = Math.max(1, Number(installment_count) || 1);
    const useBranch   = branch_id   || access.branchId   || "";
    const useBranchNm = branch_name || access.branchName || "";

    // Ensure sheets exist
    await Promise.all([
      ensureSheet(sid, DEBTS_SHEET, DEBTS_HEADERS, `${DEBTS_SHEET}!A1:P1`),
      ensureSheet(sid, INST_SHEET, INST_HEADERS,   `${INST_SHEET}!A1:J1`),
    ]);

    // Generate debt ID
    const debtId = await genId("AR", sid, DEBTS_SHEET);

    // Append AR_Debts
    await saAppendRow(sid, `${DEBTS_SHEET}!A:P`, [
      debtId, ts, customer_name, customer_phone, debt_type,
      totalAmt, downAmt, remaining, instCount,
      first_due_date, source_ref, useBranch, useBranchNm,
      "active", note, email,
    ]);

    // Generate installment schedule
    // งวดสุดท้ายรับส่วนที่เหลือ (กันเศษ)
    const baseAmt = Math.floor((remaining / instCount) * 100) / 100;
    const lastAmt = Math.round((remaining - baseAmt * (instCount - 1)) * 100) / 100;

    const firstDue = new Date(first_due_date + "T00:00:00");

    for (let i = 0; i < instCount; i++) {
      // ใช้ debt_id เป็น base แทน genId เพื่อไม่ให้ query ซ้ำ N รอบ
      const instNo = i + 1;
      const instId = `${debtId.replace(/^AR-/, "INST-")}-${String(instNo).padStart(2, "0")}`;

      const dueDate = new Date(firstDue);
      dueDate.setMonth(dueDate.getMonth() + i);
      const dueDateStr = dueDate.toISOString().slice(0, 10);
      const amount = i === instCount - 1 ? lastAmt : baseAmt;

      await saAppendRow(sid, `${INST_SHEET}!A:J`, [
        instId, debtId, instNo, dueDateStr, amount,
        0, "", "pending", "", ts,
      ]);
    }

    saInvalidateCache(sid);

    return NextResponse.json({
      ok: true,
      debt_id: debtId,
      installments_created: instCount,
      remaining,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
