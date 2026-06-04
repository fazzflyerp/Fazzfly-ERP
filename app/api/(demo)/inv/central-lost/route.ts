/**
 * POST /api/inv/central-lost
 *
 * บันทึกยาหายจากคลังกลาง (INV_Lots)
 * SUPER_ADMIN only
 *
 * Body: { lot_id, qty_lost, note? }
 *
 * Actions:
 *   1. ตรวจ qty เพียงพอ
 *   2. ตัด qty_remaining ใน INV_Lots
 *   3. Append INV_CentralLost (log)
 *   4. บันทึก Stock Ledger LOST
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  saReadRange, saUpdateRow, saAppendRow,
  saStructuralBatchUpdate, saInvalidateCache,
} from "@/lib/google-sa";
import { getInvAccess, thaiTimestamp, genId } from "@/lib/inv-access";
import { recordStockLedger } from "@/lib/inv-stock-ledger";

const LOST_SHEET   = "INV_CentralLost";
const LOST_HEADERS = ["lost_id","lost_date","product_name","lot_id","qty_lost","unit","note","reported_by"];

async function ensureLostSheet(sheetId: string) {
  try {
    await saReadRange(sheetId, `${LOST_SHEET}!A1`, 0);
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    if (!msg.includes("Unable to parse range") && !msg.includes("not found")) throw err;
    await saStructuralBatchUpdate(sheetId, [{ addSheet: { properties: { title: LOST_SHEET } } }]);
    await saUpdateRow(sheetId, `${LOST_SHEET}!A1:H1`, LOST_HEADERS);
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

    const { lot_id, qty_lost, note = "" } = await request.json();
    if (!lot_id || !qty_lost || Number(qty_lost) <= 0)
      return NextResponse.json({ error: "กรุณาระบุ lot_id และ qty_lost" }, { status: 400 });

    const sid      = access.centralSheetId;
    const qtyLost  = Number(qty_lost);
    const ts       = thaiTimestamp();

    // ── อ่าน Lot ──────────────────────────────────────────────────────────────
    const lotsRows = await saReadRange(sid, "INV_Lots!A:P", 0);
    const rowIdx   = lotsRows.findIndex(
      (r, i) => i > 0 && (r[0] ?? "").toString() === lot_id
    );
    if (rowIdx < 1)
      return NextResponse.json({ error: `ไม่พบ Lot: ${lot_id}` }, { status: 404 });

    const row          = lotsRows[rowIdx];
    const qtyRemaining = Number(row[9] ?? 0);
    if (qtyLost > qtyRemaining)
      return NextResponse.json({
        error: `สินค้าไม่เพียงพอ: ต้องการ ${qtyLost} คงเหลือ ${qtyRemaining}`,
      }, { status: 409 });

    const productName = (row[2]  ?? "").toString();
    const category    = (row[3]  ?? "").toString();
    const brand       = (row[4]  ?? "").toString();
    const unit        = (row[5]  ?? "").toString();

    // ── 1. ตัด qty_remaining ──────────────────────────────────────────────────
    const updatedRow = [...row];
    updatedRow[9] = qtyRemaining - qtyLost;
    await saUpdateRow(sid, `INV_Lots!A${rowIdx + 1}`, updatedRow);

    // ── 2. Append INV_CentralLost ─────────────────────────────────────────────
    await ensureLostSheet(sid);
    const lostId = await genId("CLOST", sid, LOST_SHEET);
    await saAppendRow(sid, `${LOST_SHEET}!A:H`, [
      lostId, ts, productName, lot_id, qtyLost, unit, note, email,
    ]);

    saInvalidateCache(sid);

    // ── 3. Stock Ledger LOST ──────────────────────────────────────────────────
    await recordStockLedger({
      sid,
      productName,
      category,
      brand,
      unit,
      txnType: "OUT",
      qty:     qtyLost,
      unitCost: 0,
      referenceId: lostId,
      note: `ยาหาย${note ? " — " + note : ""}`,
      createdBy: email,
    });

    return NextResponse.json({
      ok: true,
      lost_id:   lostId,
      new_qty:   qtyRemaining - qtyLost,
      qty_lost:  qtyLost,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
