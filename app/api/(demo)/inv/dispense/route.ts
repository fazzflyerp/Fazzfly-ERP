/**
 * POST /api/inv/dispense
 *
 * Super Admin — จ่ายสินค้าออกจากคลังกลางไปสาขา โดยไม่ต้องรอสาขาส่ง Request
 *
 * Flow: สร้าง INV_Request (status=APPROVED ทันที) + ตัด Lot + Transfer + INV_Stock บสาขา
 *
 * Body: {
 *   branch_id: string
 *   lot_id:    string
 *   qty:       number
 *   note?:     string
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saUpdateRow, saAppendRow, saInvalidateCache } from "@/lib/google-sa";
import { getInvAccess, genId, thaiTimestamp } from "@/lib/inv-access";
import { recordStockLedger } from "@/lib/inv-stock-ledger";

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

    const { branch_id, lot_id, qty, note } = await request.json();
    if (!branch_id || !lot_id || !qty || Number(qty) <= 0)
      return NextResponse.json({ error: "กรุณาระบุ branch_id, lot_id, qty" }, { status: 400 });

    const sid    = access.centralSheetId;
    const qtyNum = Number(qty);
    const ts     = thaiTimestamp();

    // ── หา branch ──────────────────────────────────────────────────────────────
    const branchSheet = access.allBranchSheets.find((b) => b.branchId === branch_id);
    if (!branchSheet)
      return NextResponse.json({ error: `ไม่พบสาขา ${branch_id}` }, { status: 400 });
    const branchName = branchSheet.branchName;
    const bSid       = branchSheet.sheetId;

    // ── อ่าน Lot ───────────────────────────────────────────────────────────────
    const lotsRows = await saReadRange(sid, "INV_Lots!A:P", 0);
    const lotRowIdx = lotsRows.findIndex(
      (r, i) => i > 0 && (r[0] ?? "").toString() === lot_id
    );
    if (lotRowIdx < 1)
      return NextResponse.json({ error: `Lot ไม่พบ: ${lot_id}` }, { status: 404 });

    const lotRow      = lotsRows[lotRowIdx];
    const qtyRemaining = Number(lotRow[9] ?? 0);
    if (qtyRemaining < qtyNum)
      return NextResponse.json({
        error: `สินค้าไม่เพียงพอ: ต้องการ ${qtyNum} คงเหลือ ${qtyRemaining}`,
      }, { status: 409 });

    const productId   = (lotRow[1]  ?? "").toString();
    const productName = (lotRow[2]  ?? "").toString();
    const category    = (lotRow[3]  ?? "").toString();
    const brand       = (lotRow[4]  ?? "").toString();
    const unit        = (lotRow[5]  ?? "").toString();
    const unitPkg     = (lotRow[6]  ?? "").toString();
    const expiryDate  = (lotRow[10] ?? "").toString();
    const costPerUnit = Number(lotRow[15] ?? 0);

    // ── Generate IDs ──────────────────────────────────────────────────────────
    const [requestId, transferId, stockId] = await Promise.all([
      genId("REQ", sid,  "INV_Request"),
      genId("TRF", sid,  "INV_Transfer"),
      genId("STK", bSid, "INV_Stock"),
    ]);

    // ── 1. สร้าง INV_Request (status=APPROVED ทันที) ──────────────────────────
    // cols: A=request_id B=branch_id C=branch_name D=product_id E=product_name
    //       F=unit G=qty_requested H=qty_approved I=lot_id J=expiry_date
    //       K=status L=note M=requested_by N=requested_at O=reviewed_by P=reviewed_at
    await saAppendRow(sid, "INV_Request!A:P", [
      requestId, branch_id, branchName,
      productId, productName, unit,
      qtyNum,    // qty_requested
      qtyNum,    // qty_approved
      lot_id,
      expiryDate,
      "APPROVED",
      note || "จ่ายโดยตรงจากคลังกลาง",
      email,     // requested_by (central admin จ่ายให้)
      ts,        // requested_at
      email,     // reviewed_by
      ts,        // reviewed_at
    ]);

    // ── 2. ตัด qty_remaining ใน INV_Lots ─────────────────────────────────────
    const updatedLotRow = [...lotRow];
    updatedLotRow[9] = qtyRemaining - qtyNum;
    await saUpdateRow(sid, `INV_Lots!A${lotRowIdx + 1}`, updatedLotRow);

    // ── 3. สร้าง INV_Transfer ─────────────────────────────────────────────────
    await saAppendRow(sid, "INV_Transfer!A:L", [
      transferId, requestId, branch_id, branchName,
      productId, productName, unit,
      lot_id, expiryDate, qtyNum,
      email, ts,
    ]);

    // ── 4. Append INV_Stock ใน branch ─────────────────────────────────────────
    await saAppendRow(bSid, "INV_Stock!A:Q", [
      stockId, productId, productName,
      category, brand, unit, unitPkg,
      lot_id,
      qtyNum,
      qtyNum,
      expiryDate, transferId, ts, costPerUnit,
      "", "", "",
    ]);

    saInvalidateCache(sid);
    saInvalidateCache(bSid);

    // ── 5. Stock Ledger OUT ───────────────────────────────────────────────────
    await recordStockLedger({
      sid,
      productName,
      category,
      brand,
      unit,
      txnType: "OUT",
      qty: qtyNum,
      unitCost: 0,
      referenceId: requestId,
      note: `จ่ายตรงให้ ${branchName}${note ? " · " + note : ""}`,
      createdBy: email,
    });

    // ── 6. Notify branch ──────────────────────────────────────────────────────
    try {
      await saAppendRow(sid, "INV_Notification!A:H", [
        `NOTIF-${Date.now()}`,
        branch_id, branch_id,
        "request_approved",
        `คลังกลางส่ง ${productName} ${qtyNum} ${unit} (Lot: ${lot_id}) มาให้${note ? " — " + note : ""}`,
        requestId, "FALSE", ts,
      ]);
    } catch { /* non-blocking */ }

    return NextResponse.json({
      ok: true,
      request_id: requestId,
      transfer_id: transferId,
      stock_id: stockId,
      qty: qtyNum,
      branch_name: branchName,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
