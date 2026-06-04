/**
 * POST /api/inv/approve
 * Super Admin: approve หรือ reject request
 *
 * Approve flow:
 *   1. ตรวจ lot มี qty_remaining เพียงพอ
 *   2. Update INV_Request: qty_approved, lot_id, expiry_date, status=APPROVED, reviewed_*
 *   3. ตัด qty_remaining ใน INV_Lots
 *   4. สร้าง INV_Transfer record
 *   5. Append INV_Stock ใน branch spreadsheet
 *   6. สร้าง Notification ให้สาขา
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saUpdateRow, saAppendRow, saBatchUpdate, saInvalidateCache } from "@/lib/google-sa";
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

    const body = await request.json();
    const { request_id, action, lot_id, qty_approved, note } = body;

    if (!request_id || !action)
      return NextResponse.json({ error: "Missing request_id or action" }, { status: 400 });

    if (!["approve", "reject"].includes(action))
      return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });

    const sid = access.centralSheetId;
    const ts  = thaiTimestamp();

    // Read INV_Request to find the row
    const reqRows = await saReadRange(sid, "INV_Request!A:P", 0);
    const reqRowIdx = reqRows.findIndex(
      (r, i) => i > 0 && (r[0] ?? "").toString() === request_id
    );
    if (reqRowIdx < 1) return NextResponse.json({ error: "Request not found" }, { status: 404 });

    const reqRow     = reqRows[reqRowIdx];
    const branchId   = (reqRow[1] ?? "").toString();
    const branchName = (reqRow[2] ?? "").toString();
    const productId  = (reqRow[3] ?? "").toString();
    const productName = (reqRow[4] ?? "").toString();
    const unit       = (reqRow[5] ?? "").toString();
    const currentStatus = (reqRow[10] ?? "").toString().toUpperCase();

    if (currentStatus !== "PENDING")
      return NextResponse.json({ error: "Request is not PENDING" }, { status: 409 });

    const sheetRow = reqRowIdx + 1; // 1-based row in sheet

    if (action === "reject") {
      // Update INV_Request row: status=REJECTED + reviewed info
      const updatedReqRow = [...reqRow];
      updatedReqRow[10] = "REJECTED";
      updatedReqRow[11] = note || "";
      updatedReqRow[14] = email;
      updatedReqRow[15] = ts;

      await saUpdateRow(sid, `INV_Request!A${sheetRow}`, updatedReqRow);
      saInvalidateCache(sid);

      // Notify branch
      try {
        await saAppendRow(sid, "INV_Notification!A:H", [
          `NOTIF-${Date.now()}`,
          branchId,
          branchId,
          "request_rejected",
          `คำขอ ${request_id} (${productName}) ถูกปฏิเสธ${note ? ": " + note : ""}`,
          request_id,
          "FALSE",
          ts,
        ]);
      } catch { /* non-blocking */ }

      return NextResponse.json({ ok: true, status: "REJECTED" });
    }

    // --- APPROVE ---
    // รับได้ทั้ง 2 รูปแบบ:
    //   multi-lot: { lots: [{lot_id, qty}, ...] }
    //   single-lot (เดิม): { lot_id, qty_approved }
    const rawLots: { lot_id: string; qty: number }[] = body.lots
      ? body.lots.map((l: any) => ({ lot_id: l.lot_id, qty: Number(l.qty) }))
      : lot_id && qty_approved
        ? [{ lot_id, qty: Number(qty_approved) }]
        : [];

    if (!rawLots.length || rawLots.some((l) => !l.lot_id || l.qty <= 0))
      return NextResponse.json({ error: "ระบุ lots [{lot_id, qty}] อย่างน้อย 1 lot" }, { status: 400 });

    const totalQty = rawLots.reduce((s, l) => s + l.qty, 0);

    // อ่าน INV_Lots ครั้งเดียว แล้วค้นหาทุก lot
    const lotsRows = await saReadRange(sid, "INV_Lots!A:P", 0);

    interface LotInfo {
      lot_id: string; qty: number;
      rowIdx: number; row: any[];
      qtyRemaining: number; expiryDate: string;
      category: string; brand: string; unitPkg: string; costPerUnit: number;
    }

    const resolved: LotInfo[] = [];
    for (const item of rawLots) {
      const rowIdx = lotsRows.findIndex(
        (r, i) => i > 0 && (r[0] ?? "").toString() === item.lot_id
      );
      if (rowIdx < 1)
        return NextResponse.json({ error: `Lot ไม่พบ: ${item.lot_id}` }, { status: 404 });

      const row = lotsRows[rowIdx];
      const qtyRemaining = Number(row[9] ?? 0);
      if (qtyRemaining < item.qty)
        return NextResponse.json({
          error: `Lot ${item.lot_id} ไม่เพียงพอ: ต้องการ ${item.qty} คงเหลือ ${qtyRemaining} ${unit}`,
        }, { status: 409 });

      resolved.push({
        lot_id: item.lot_id, qty: item.qty,
        rowIdx, row,
        qtyRemaining,
        expiryDate:  (row[10] ?? "").toString(),
        category:    (row[3]  ?? "").toString(),
        brand:       (row[4]  ?? "").toString(),
        unitPkg:     (row[6]  ?? "").toString(),
        costPerUnit: Number(row[15] ?? 0),
      });
    }

    // หา branch spreadsheet
    const branchSheet = access.allBranchSheets.find((b) => b.branchId === branchId);
    if (!branchSheet)
      return NextResponse.json({ error: `Branch spreadsheet not found for ${branchId}` }, { status: 400 });

    const bSid = branchSheet.sheetId;

    // หา earliest expiry เพื่อบันทึกใน INV_Request
    const earliestExpiry = resolved
      .map((l) => l.expiryDate)
      .filter(Boolean)
      .sort()[0] ?? "";
    const lotIdsSummary = resolved.map((l) => l.lot_id).join(", ");

    // 1. Update INV_Request (บันทึกยอดรวม + lot ทั้งหมด)
    const updatedReqRow = [...reqRow];
    updatedReqRow[7]  = totalQty;
    updatedReqRow[8]  = lotIdsSummary;
    updatedReqRow[9]  = earliestExpiry;
    updatedReqRow[10] = "APPROVED";
    updatedReqRow[11] = note || "";
    updatedReqRow[14] = email;
    updatedReqRow[15] = ts;
    await saUpdateRow(sid, `INV_Request!A${sheetRow}`, updatedReqRow);

    // 2-4. วน loop แต่ละ lot: ตัด INV_Lots + สร้าง Transfer + สร้าง Stock (branch)
    const transferIds: string[] = [];
    const stockIds:    string[] = [];

    for (const lot of resolved) {
      // Generate IDs (sequential ต่อ lot)
      const [transferId, stockId] = await Promise.all([
        genId("TRF", sid,  "INV_Transfer"),
        genId("STK", bSid, "INV_Stock"),
      ]);
      transferIds.push(transferId);
      stockIds.push(stockId);

      // ตัด qty_remaining ใน INV_Lots
      const updatedLotRow = [...lot.row];
      updatedLotRow[9] = lot.qtyRemaining - lot.qty;
      await saUpdateRow(sid, `INV_Lots!A${lot.rowIdx + 1}`, updatedLotRow);

      // Append INV_Transfer (1 แถวต่อ lot)
      await saAppendRow(sid, "INV_Transfer!A:L", [
        transferId, request_id, branchId, branchName,
        productId, productName, unit,
        lot.lot_id, lot.expiryDate, lot.qty,
        email, ts,
      ]);

      // Append INV_Stock ใน branch (1 แถวต่อ lot — แยก lot ชัดเจน)
      // A:Q = 17 cols; O(14)=parent_stock_id, P(15)=is_opened, Q(16)=opened_at (ว่างสำหรับ lot ใหม่)
      await saAppendRow(bSid, "INV_Stock!A:Q", [
        stockId, productId, productName,
        lot.category, lot.brand, unit, lot.unitPkg,
        lot.lot_id,
        lot.qty,
        lot.qty, // qty_remaining = qty_received เริ่มต้น
        lot.expiryDate, transferId, ts, lot.costPerUnit,
        "", "", "", // O=parent_stock_id, P=is_opened, Q=opened_at
      ]);
    }

    saInvalidateCache(sid);
    saInvalidateCache(bSid);

    // อัปเดต Stock_Levels + append INV_Transactions OUT (1 รายการรวมทุก lot)
    await recordStockLedger({
      sid,
      productName,
      category: resolved[0]?.category ?? "",
      brand:    resolved[0]?.brand    ?? "",
      unit,
      txnType: "OUT",
      qty:      totalQty,
      unitCost: 0, // ใช้ avg_cost ปัจจุบันจาก Stock_Levels อัตโนมัติ
      referenceId: request_id,
      note: `โอนให้ ${branchName}${note ? " · " + note : ""}`,
      createdBy: email,
    });

    // 5. Notify branch
    const lotDetail = resolved.map((l) => `${l.lot_id} ×${l.qty}`).join(", ");
    try {
      await saAppendRow(sid, "INV_Notification!A:H", [
        `NOTIF-${Date.now()}`,
        branchId, branchId,
        "request_approved",
        `คำขอ ${request_id} (${productName}) อนุมัติ ${totalQty} ${unit} [${lotDetail}]`,
        request_id, "FALSE", ts,
      ]);
    } catch { /* non-blocking */ }

    return NextResponse.json({
      ok: true, status: "APPROVED",
      totalQty,
      lots: resolved.map((l, i) => ({ lot_id: l.lot_id, qty: l.qty, transfer_id: transferIds[i], stock_id: stockIds[i] })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
