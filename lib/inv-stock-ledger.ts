/**
 * lib/inv-stock-ledger.ts
 * WAC (Weighted Average Cost) ledger — Central INV only
 *
 * Sheets (in centralSheetId):
 *   Stock_Levels   A:H  — 1 row per product, สต๊อครวม + WAC ปัจจุบัน
 *   INV_Transactions A:L — append-only audit log
 */

import { saReadRange, saUpdateRow, saAppendRow, saStructuralBatchUpdate, saInvalidateCache } from "@/lib/google-sa";
import { genId, thaiTimestamp } from "@/lib/inv-access";

const SL_SHEET   = "Stock_Levels";
const SL_RANGE   = "Stock_Levels!A:H";
const TXN_SHEET  = "INV_Transactions";
const TXN_RANGE  = "INV_Transactions!A:L";

// Stock_Levels columns: A=product_name B=category C=brand D=unit E=qty_on_hand F=avg_cost G=min_stock H=last_updated
// INV_Transactions columns: A=txn_id B=txn_date C=product_name D=txn_type E=qty(signed) F=unit_cost G=balance_after H=avg_cost_after I=reference_id J=note K=created_by L=created_at

const SL_HEADERS  = ["product_name","category","brand","unit","qty_on_hand","avg_cost","min_stock","last_updated"];
const TXN_HEADERS = ["txn_id","txn_date","product_name","txn_type","qty","unit_cost","balance_after","avg_cost_after","reference_id","note","created_by","created_at"];

async function ensureSheet(sid: string, sheetName: string, headers: string[], headerRange: string): Promise<void> {
  try {
    await saReadRange(sid, `${sheetName}!A1`, 0);
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    if (!msg.includes("Unable to parse range") && !msg.includes("not found")) throw err;
    await saStructuralBatchUpdate(sid, [{ addSheet: { properties: { title: sheetName } } }]);
    await saUpdateRow(sid, headerRange, headers);
    saInvalidateCache(sid);
  }
}

export interface LedgerEntry {
  sid: string;
  productName: string;
  category: string;
  brand: string;
  unit: string;
  txnType: "IN" | "OUT" | "ADJUST";
  /** จำนวน (บวกเสมอ, sign จาก txnType) — ADJUST ส่ง negative ได้เพื่อลด */
  qty: number;
  /** ต้นทุนต่อหน่วย ณ เวลานี้ — OUT ส่ง 0 จะใช้ avg_cost ปัจจุบัน */
  unitCost: number;
  referenceId: string;
  note?: string;
  createdBy: string;
}

export async function recordStockLedger(entry: LedgerEntry): Promise<void> {
  const {
    sid, productName, category, brand, unit,
    txnType, qty, unitCost, referenceId, note = "", createdBy,
  } = entry;
  const ts = thaiTimestamp();

  // ── Ensure sheets exist ───────────────────────────────────────────
  await ensureSheet(sid, SL_SHEET, SL_HEADERS, `${SL_SHEET}!A1:H1`);
  await ensureSheet(sid, TXN_SHEET, TXN_HEADERS, `${TXN_SHEET}!A1:L1`);

  // ── อ่าน Stock_Levels ─────────────────────────────────────────────
  let slRows: any[][] = [];
  try {
    slRows = await saReadRange(sid, SL_RANGE, 0);
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    if (!msg.includes("Unable to parse range") && !msg.includes("not found")) throw err;
  }

  const rowIdx = slRows.findIndex((r, i) => i > 0 && String(r[0] ?? "") === productName);
  const existing = rowIdx > 0 ? slRows[rowIdx] : null;

  const oldQty     = existing ? Number(existing[4] ?? 0) : 0;
  const oldAvgCost = existing ? Number(existing[5] ?? 0) : 0;
  const minStock   = existing ? Number(existing[6] ?? 0) : 0; // preserve existing

  // ── คำนวณ qty ใหม่ และ WAC ───────────────────────────────────────
  let newQty: number;
  let newAvgCost: number;
  let effectiveUnitCost: number;

  if (txnType === "IN") {
    newQty = oldQty + qty;
    newAvgCost = newQty > 0
      ? Math.round(((oldQty * oldAvgCost) + (qty * unitCost)) / newQty * 100) / 100
      : unitCost;
    effectiveUnitCost = unitCost;
  } else if (txnType === "OUT") {
    newQty = Math.max(0, oldQty - qty);
    newAvgCost = oldAvgCost; // WAC ไม่เปลี่ยนเมื่อตัดออก
    effectiveUnitCost = oldAvgCost; // บันทึกต้นทุน ณ เวลาที่ตัด
  } else {
    // ADJUST: qty อาจเป็น negative (ลด) หรือ positive (เพิ่ม)
    newQty = Math.max(0, oldQty + qty);
    newAvgCost = oldAvgCost;
    effectiveUnitCost = unitCost || oldAvgCost;
  }

  // ── อัปเดต / สร้าง Stock_Levels row ─────────────────────────────
  const newSlRow = [productName, category, brand, unit, newQty, newAvgCost, minStock, ts];

  if (existing && rowIdx > 0) {
    await saUpdateRow(sid, `${SL_SHEET}!A${rowIdx + 1}`, newSlRow);
  } else {
    await saAppendRow(sid, `${SL_SHEET}!A:H`, newSlRow);
  }

  // ── Append INV_Transactions ───────────────────────────────────────
  const txnId      = await genId("TXN", sid, TXN_SHEET);
  const signedQty  = txnType === "OUT" ? -Math.abs(qty) : qty; // OUT เป็นลบ

  await saAppendRow(sid, `${TXN_RANGE}`, [
    txnId,
    ts,
    productName,
    txnType,
    signedQty,
    effectiveUnitCost,
    newQty,          // balance_after
    newAvgCost,      // avg_cost_after
    referenceId,
    note,
    createdBy,
    ts,
  ]);
}
