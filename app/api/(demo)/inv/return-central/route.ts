/**
 * POST /api/inv/return-central
 * Super Admin only — ส่งคืนยาจากสาขากลับคลังกลาง
 *
 * Flow:
 *  1. ตัด qty จาก branch INV_Stock  (อ่าน A:Q รองรับ opened lots)
 *  2. คืน qty ให้ central INV_Lots (ตาม lot_id)
 *     - ถ้าเป็น opened lot (is_opened=true): คืนในหน่วย dispense_unit
 *       note ระบุว่า "ส่งคืนยาที่เปิดแล้ว"
 *  3. recordStockLedger → อัปเดต central Stock_Levels (WAC) + append INV_Transactions
 *  4. Log RETURN_CENTRAL ใน branch INV_BranchLog
 *
 * INV_Stock cols A:Q
 *   O(14)=parent_stock_id  P(15)=is_opened  Q(16)=opened_at
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  saReadRange, saUpdateRow, saAppendRow,
  saStructuralBatchUpdate, saInvalidateCache,
} from "@/lib/google-sa";
import { getInvAccess, thaiTimestamp, genId } from "@/lib/inv-access";
import { recordStockLedger } from "@/lib/inv-stock-ledger";

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

    if (!access.centralSheetId)
      return NextResponse.json({ error: "Central INV not configured" }, { status: 400 });

    const { stock_id, qty_return, branch_id, note = "" } = await request.json();
    if (!stock_id || !qty_return || Number(qty_return) <= 0)
      return NextResponse.json({ error: "stock_id และ qty_return ต้องมีค่า" }, { status: 400 });

    // Resolve branch info
    let branchSheetId  = access.branchSheetId;
    let branchName     = "";
    if (branch_id) {
      const b = (access.allBranchSheets as any[]).find((x) => x.branchId === branch_id);
      branchSheetId = b?.sheetId ?? null;
      branchName    = b?.branchName ?? branch_id;
    } else {
      // non-SA: use own branch name if available
      branchName = (access as any).branchName ?? "";
    }
    if (!branchSheetId)
      return NextResponse.json({ error: "Branch INV not configured" }, { status: 400 });

    const centralSid = access.centralSheetId;
    const qtyReturn  = Number(qty_return);
    const ts         = thaiTimestamp();

    // ── 1. Read branch INV_Stock (A:Q รวม opened lot columns) ────────────────
    // INV_Stock cols: A=stock_id(0) B=product_id(1) C=product_name(2) D=category(3) E=brand(4)
    //                F=unit(5) G=unit_pkg(6) H=lot_id(7) I=qty_received(8) J=qty_remaining(9)
    //                K=expiry_date(10) L=transfer_id(11) M=received_at(12) N=cost_per_unit(13)
    //                O=parent_stock_id(14) P=is_opened(15) Q=opened_at(16)
    const branchRows = await saReadRange(branchSheetId, "INV_Stock!A:Q", 0);
    const branchIdx  = branchRows.findIndex((r: any[], i: number) => i > 0 && (r[0] ?? "").toString() === stock_id);
    if (branchIdx < 1) return NextResponse.json({ error: "Stock entry not found" }, { status: 404 });

    const branchRow      = branchRows[branchIdx];
    const currentQty     = Number(branchRow[9]  ?? 0);
    const productName    = (branchRow[2]  ?? "").toString();
    const category       = (branchRow[3]  ?? "").toString();
    const brand          = (branchRow[4]  ?? "").toString();
    const unit           = (branchRow[5]  ?? "").toString();
    const lotId          = (branchRow[7]  ?? "").toString();
    const costPerUnit    = Number(branchRow[13] ?? 0);
    const isOpened       = (branchRow[15] ?? "").toString().toLowerCase() === "true";
    const parentStockId  = (branchRow[14] ?? "").toString(); // lot ต้นทางเดิม (ถ้ามี)

    if (qtyReturn > currentQty)
      return NextResponse.json({ error: `จำนวนเกินกว่าสต๊อค (${currentQty} ${unit})` }, { status: 400 });

    // ── 2. Deduct from branch stock ───────────────────────────────────────────
    const updatedBranch = [...branchRow];
    updatedBranch[9]    = currentQty - qtyReturn;
    await saUpdateRow(branchSheetId, `INV_Stock!A${branchIdx + 1}`, updatedBranch);

    // ── 3. Restore qty to central INV_Lots (column J = index 9) ──────────────
    // ถ้าเป็น opened lot → ต้องหา lot_id จาก parent_stock_id เพราะ lot เดิมอยู่ที่ source row
    // (opened lot ยังอ้างอิง lot_id เดิม — ใช้ lotId ตรงๆ ได้เลย)
    const targetLotId = lotId; // opened lot ยังใช้ lot_id ต้นทางเสมอ

    if (targetLotId) {
      const lotRows = await saReadRange(centralSid, "INV_Lots!A:O", 0);
      const lotIdx  = lotRows.findIndex((r: any[], i: number) => i > 0 && (r[0] ?? "").toString() === targetLotId);
      if (lotIdx >= 1) {
        const lotRow     = lotRows[lotIdx];
        const updatedLot = [...lotRow];
        updatedLot[9]    = Number(lotRow[9] ?? 0) + qtyReturn;
        await saUpdateRow(centralSid, `INV_Lots!A${lotIdx + 1}`, updatedLot);
      }
    }

    // ── 4. recordStockLedger → Stock_Levels (WAC) + INV_Transactions ─────────
    //       txnType = "IN" เพราะคลังกลางได้รับของคืน
    const openedSuffix = isOpened
      ? ` [ยาที่เปิดแล้ว${parentStockId ? ` / lot เดิม ${parentStockId}` : ""}]`
      : "";
    const returnNote = branchName
      ? `ส่งคืนจากสาขา ${branchName}${openedSuffix}${note ? `: ${note}` : ""}`
      : `ส่งคืนจากสาขา${openedSuffix}${note ? `: ${note}` : ""}`;

    await recordStockLedger({
      sid:         centralSid,
      productName,
      category,
      brand,
      unit,
      txnType:     "IN",
      qty:         qtyReturn,
      unitCost:    costPerUnit,   // ใช้ต้นทุนเดิมของ lot เพื่อ WAC ถูกต้อง
      referenceId: stock_id,
      note:        returnNote,
      createdBy:   email,
    });

    // ── 5. Log RETURN_CENTRAL ใน branch INV_BranchLog ────────────────────────
    await ensureBranchLog(branchSheetId);
    const logId  = await genId("LOG", branchSheetId, BLOG_SHEET);
    const ctxMsg = isOpened ? `→ คลังกลาง (ยาที่เปิดแล้ว ${unit})` : "→ คลังกลาง";
    await saAppendRow(branchSheetId, `${BLOG_SHEET}!A:J`, [
      logId, ts, "RETURN_CENTRAL", productName, lotId, stock_id,
      qtyReturn, ctxMsg, note, email,
    ]);

    saInvalidateCache(branchSheetId);
    saInvalidateCache(centralSid);
    return NextResponse.json({ ok: true, returned_qty: qtyReturn });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
