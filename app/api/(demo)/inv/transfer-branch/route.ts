/**
 * POST /api/inv/transfer-branch
 * Super Admin only — โอนยาข้ามสาขา
 * ตัด qty จากสาขาต้นทาง + เพิ่ม INV_Stock row ในสาขาปลายทาง + log INV_BranchLog ทั้งสองฝั่ง
 *
 * รองรับ opened lots (is_opened=true) — preserve parent_stock_id / is_opened / opened_at
 * INV_Stock cols A:Q
 *   A(0)=stock_id  B(1)=product_id  C(2)=product_name  D(3)=category  E(4)=brand
 *   F(5)=unit      G(6)=unit_pkg    H(7)=lot_id        I(8)=qty_received  J(9)=qty_remaining
 *   K(10)=expiry_date  L(11)=transfer_id  M(12)=received_at  N(13)=cost_per_unit
 *   O(14)=parent_stock_id  P(15)=is_opened  Q(16)=opened_at
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  saReadRange, saUpdateRow, saAppendRow,
  saStructuralBatchUpdate, saInvalidateCache,
} from "@/lib/google-sa";
import { getInvAccess, thaiTimestamp, genId } from "@/lib/inv-access";

const BLOG_SHEET   = "INV_BranchLog";
const BLOG_HEADERS = ["log_id","log_date","action_type","product_name","lot_id","stock_id","qty","context","note","recorded_by"];

async function ensureBranchLog(sheetId: string) {
  try {
    await saReadRange(sheetId, `${BLOG_SHEET}!A1`, 0);
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    if (!msg.includes("Unable to parse range") && !msg.includes("not found")) throw err;
    await saStructuralBatchUpdate(sheetId, [{ addSheet: { properties: { title: BLOG_SHEET } } }]);
    await saUpdateRow(sheetId, `${BLOG_SHEET}!A1:J1`, BLOG_HEADERS);
    saInvalidateCache(sheetId);
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access || access.role !== "SUPER_ADMIN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { stock_id, qty, from_branch_id, to_branch_id, note = "" } = await request.json();
    if (!stock_id || !qty || Number(qty) <= 0 || !from_branch_id || !to_branch_id)
      return NextResponse.json({ error: "ข้อมูลไม่ครบถ้วน" }, { status: 400 });

    if (from_branch_id === to_branch_id)
      return NextResponse.json({ error: "สาขาต้นทางและปลายทางต้องไม่เป็นสาขาเดียวกัน" }, { status: 400 });

    const allBranches  = access.allBranchSheets as any[];
    const fromBranch   = allBranches.find((b) => b.branchId === from_branch_id);
    const toBranch     = allBranches.find((b) => b.branchId === to_branch_id);
    if (!fromBranch) return NextResponse.json({ error: "ไม่พบสาขาต้นทาง" }, { status: 404 });
    if (!toBranch)   return NextResponse.json({ error: "ไม่พบสาขาปลายทาง" }, { status: 404 });

    const fromSheet    = fromBranch.sheetId;
    const toSheet      = toBranch.sheetId;
    const fromName     = fromBranch.branchName || from_branch_id;
    const toName       = toBranch.branchName   || to_branch_id;

    const ts      = thaiTimestamp();
    const qtyMove = Number(qty);

    // 1. Read source branch INV_Stock (A:Q รวม opened lot columns)
    const rows   = await saReadRange(fromSheet, "INV_Stock!A:Q", 0);
    const rowIdx = rows.findIndex((r: any[], i: number) => i > 0 && (r[0] ?? "").toString() === stock_id);
    if (rowIdx < 1) return NextResponse.json({ error: "Stock entry not found" }, { status: 404 });

    const row        = rows[rowIdx];
    const currentQty = Number(row[9] ?? 0);
    if (qtyMove > currentQty)
      return NextResponse.json({ error: `จำนวนเกินกว่าสต๊อค (${currentQty} ${row[5] ?? ""})` }, { status: 400 });

    const productName    = (row[2]  ?? "").toString();
    const lotId          = (row[7]  ?? "").toString();
    const isOpened       = (row[15] ?? "").toString();      // "true" / ""
    const parentStockId  = (row[14] ?? "").toString();      // อ้างอิง lot ต้นทางเดิม
    const openedAt       = (row[16] ?? "").toString();      // วันที่เปิดครั้งแรก

    // 2. Deduct from source
    const updatedRow = [...row];
    updatedRow[9]    = currentQty - qtyMove;
    await saUpdateRow(fromSheet, `INV_Stock!A${rowIdx + 1}`, updatedRow);

    // 3. Add to target branch as new INV_Stock row (A:Q)
    const newStockId = await genId("STK", toSheet, "INV_Stock");
    await saAppendRow(toSheet, "INV_Stock!A:Q", [
      newStockId,
      (row[1] ?? "").toString(),  // product_id
      productName,
      (row[3] ?? "").toString(),  // category
      (row[4] ?? "").toString(),  // brand
      (row[5] ?? "").toString(),  // unit
      (row[6] ?? "").toString(),  // unit_pkg
      lotId,
      qtyMove,                    // qty_received
      qtyMove,                    // qty_remaining
      (row[10] ?? "").toString(), // expiry_date  ← ยังคง expiry เดิม (รวม opened expiry)
      `TRF-${stock_id}`,          // transfer_id
      ts,                         // received_at
      Number(row[13] ?? 0),       // cost_per_unit
      parentStockId,              // O: parent_stock_id (สืบทอดจาก source)
      isOpened,                   // P: is_opened       (สืบทอด — ถ้าเปิดแล้วยังคง true)
      openedAt,                   // Q: opened_at       (สืบทอดวันที่เปิดครั้งแรก)
    ]);

    // 4. Log TRANSFER_OUT in source branch
    await ensureBranchLog(fromSheet);
    const logOutId = await genId("LOG", fromSheet, BLOG_SHEET);
    await saAppendRow(fromSheet, `${BLOG_SHEET}!A:J`, [
      logOutId, ts, "TRANSFER_OUT", productName, lotId, stock_id,
      qtyMove, `→ ${toName}`, note, email,
    ]);

    // 5. Log TRANSFER_IN in target branch
    await ensureBranchLog(toSheet);
    const logInId = await genId("LOG", toSheet, BLOG_SHEET);
    await saAppendRow(toSheet, `${BLOG_SHEET}!A:J`, [
      logInId, ts, "TRANSFER_IN", productName, lotId, newStockId,
      qtyMove, `← ${fromName}`, note, email,
    ]);

    saInvalidateCache(fromSheet);
    saInvalidateCache(toSheet);
    return NextResponse.json({ ok: true, new_stock_id: newStockId, moved_qty: qtyMove });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
