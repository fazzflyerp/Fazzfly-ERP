/**
 * POST /api/inv/undo-transfer
 * Super Admin only — ยกเลิก/undo การโอนสต๊อคที่อนุมัติไปแล้ว
 *
 * Flow:
 *  1. อ่าน INV_Request → ดึง lot_id, qty_approved, branch_id, transfer_id
 *  2. อ่าน INV_Transfer → ยืนยัน lot / qty
 *  3. คืน qty กลับ INV_Lots (central)
 *  4. Zero out INV_Stock row ในสาขา (ตาม transfer_id)
 *  5. Mark INV_Request status = REVERSED
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saUpdateRow, saInvalidateCache } from "@/lib/google-sa";
import { getInvAccess, thaiTimestamp } from "@/lib/inv-access";

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

    const { request_id } = await request.json();
    if (!request_id)
      return NextResponse.json({ error: "request_id required" }, { status: 400 });

    const sid = access.centralSheetId;
    const ts  = thaiTimestamp();

    // 1. Find INV_Request row
    const reqRows = await saReadRange(sid, "INV_Request!A:P", 0);
    const reqRowIdx = reqRows.findIndex((r, i) => i > 0 && (r[0] ?? "").toString() === request_id);
    if (reqRowIdx < 1) return NextResponse.json({ error: "Request not found" }, { status: 404 });

    const reqRow        = reqRows[reqRowIdx];
    const branchId      = (reqRow[1] ?? "").toString();
    const productName   = (reqRow[4] ?? "").toString();
    const unit          = (reqRow[5] ?? "").toString();
    const qtyApproved   = Number(reqRow[7] ?? 0);
    const lotId         = (reqRow[8] ?? "").toString();
    const currentStatus = (reqRow[10] ?? "").toString().toUpperCase();

    if (currentStatus !== "APPROVED")
      return NextResponse.json({ error: "สามารถ Undo ได้เฉพาะ Request ที่ APPROVED เท่านั้น" }, { status: 409 });

    if (!lotId || !qtyApproved)
      return NextResponse.json({ error: "ไม่พบข้อมูล lot หรือ qty_approved" }, { status: 400 });

    // 2. Find branch spreadsheet
    const branchSheet = access.allBranchSheets.find((b) => b.branchId === branchId);
    if (!branchSheet)
      return NextResponse.json({ error: `ไม่พบ Branch spreadsheet สำหรับ ${branchId}` }, { status: 400 });

    const bSid = branchSheet.sheetId;

    // 3. Find transfer_id from INV_Transfer (col B = request_id)
    const tfrRows = await saReadRange(sid, "INV_Transfer!A:L", 0);
    const tfrRow  = tfrRows.find((r, i) => i > 0 && (r[1] ?? "").toString() === request_id);
    const transferId = tfrRow ? (tfrRow[0] ?? "").toString() : "";

    // 4. Restore qty to INV_Lots (central)
    const lotsRows  = await saReadRange(sid, "INV_Lots!A:O", 0);
    const lotRowIdx = lotsRows.findIndex((r, i) => i > 0 && (r[0] ?? "").toString() === lotId);
    if (lotRowIdx < 1)
      return NextResponse.json({ error: `Lot ${lotId} ไม่พบ` }, { status: 404 });

    const lotRow        = lotsRows[lotRowIdx];
    const currentQty    = Number(lotRow[9] ?? 0);
    const updatedLotRow = [...lotRow];
    updatedLotRow[9]    = currentQty + qtyApproved;
    await saUpdateRow(sid, `INV_Lots!A${lotRowIdx + 1}`, updatedLotRow);

    // 5. Zero out INV_Stock in branch (find by transfer_id at col L = index 11)
    let usedAlready = 0;
    if (transferId) {
      const stockRows = await saReadRange(bSid, "INV_Stock!A:M", 0);
      for (let i = 1; i < stockRows.length; i++) {
        const r = stockRows[i];
        if ((r[11] ?? "").toString() !== transferId) continue;

        const qtyRemaining = Number(r[9] ?? 0);
        usedAlready = qtyApproved - qtyRemaining;

        const updatedRow = [...r];
        updatedRow[9] = 0; // zero out qty_remaining
        await saUpdateRow(bSid, `INV_Stock!A${i + 1}`, updatedRow);
        break;
      }
    }

    // 6. Mark INV_Request as REVERSED
    const updatedReqRow  = [...reqRow];
    updatedReqRow[10]    = "REVERSED";
    updatedReqRow[11]    = `Undo by ${email} at ${ts}${usedAlready > 0 ? ` (ใช้ไปแล้ว ${usedAlready} ${unit})` : ""}`;
    updatedReqRow[14]    = email;
    updatedReqRow[15]    = ts;
    await saUpdateRow(sid, `INV_Request!A${reqRowIdx + 1}`, updatedReqRow);

    saInvalidateCache(sid);
    saInvalidateCache(bSid);

    return NextResponse.json({
      ok: true,
      restored_qty: qtyApproved,
      lot_id: lotId,
      used_already: usedAlready,
      warning: usedAlready > 0
        ? `⚠ สาขาใช้สินค้าไปแล้ว ${usedAlready} ${unit} ก่อน Undo — สต๊อคที่ส่งคืนคลังกลางเป็นจำนวนเต็ม (${qtyApproved} ${unit})`
        : null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
