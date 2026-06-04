/**
 * POST /api/inv/lost
 * บันทึกยาหาย — ตัด qty จาก branch INV_Stock + log INV_Lost + INV_BranchLog
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  saReadRange, saUpdateRow, saAppendRow,
  saStructuralBatchUpdate, saInvalidateCache,
} from "@/lib/google-sa";
import { getInvAccess, thaiTimestamp, genId } from "@/lib/inv-access";

const LOST_HEADERS = ["lost_id","lost_date","product_name","lot_id","stock_id","qty_lost","note","reported_by"];
const BLOG_SHEET   = "INV_BranchLog";
const BLOG_HEADERS = ["log_id","log_date","action_type","product_name","lot_id","stock_id","qty","context","note","recorded_by"];

async function ensureSheet(sheetId: string, sheetName: string, headers: string[], lastCol: string) {
  try {
    await saReadRange(sheetId, `${sheetName}!A1`, 0);
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    if (!msg.includes("Unable to parse range") && !msg.includes("not found")) throw err;
    await saStructuralBatchUpdate(sheetId, [{ addSheet: { properties: { title: sheetName } } }]);
    await saUpdateRow(sheetId, `${sheetName}!A1:${lastCol}1`, headers);
    saInvalidateCache(sheetId);
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { stock_id, qty_lost, note = "", branch_id } = await request.json();
    if (!stock_id || !qty_lost || Number(qty_lost) <= 0)
      return NextResponse.json({ error: "stock_id และ qty_lost ต้องมีค่า" }, { status: 400 });

    // Resolve branch sheet
    let targetSheetId = access.branchSheetId;
    if (branch_id && access.role === "SUPER_ADMIN") {
      const b = (access.allBranchSheets as any[]).find((x) => x.branchId === branch_id);
      targetSheetId = b?.sheetId ?? null;
    }
    if (!targetSheetId)
      return NextResponse.json({ error: "Branch INV not configured" }, { status: 400 });

    const ts      = thaiTimestamp();
    const qtyLost = Number(qty_lost);

    // Read INV_Stock
    const rows   = await saReadRange(targetSheetId, "INV_Stock!A:Q", 0);
    const rowIdx = rows.findIndex((r: any[], i: number) => i > 0 && (r[0] ?? "").toString() === stock_id);
    if (rowIdx < 1) return NextResponse.json({ error: "Stock entry not found" }, { status: 404 });

    const row        = rows[rowIdx];
    const currentQty = Number(row[9] ?? 0);
    if (qtyLost > currentQty)
      return NextResponse.json({ error: `จำนวนเกินกว่าสต๊อค (${currentQty} ${row[5] ?? ""})` }, { status: 400 });

    const productName = (row[2] ?? "").toString();
    const lotId       = (row[7] ?? "").toString();

    // 1. Deduct from branch stock
    const newQty  = currentQty - qtyLost;
    const updated = [...row];
    updated[9]    = newQty;
    await saUpdateRow(targetSheetId, `INV_Stock!A${rowIdx + 1}`, updated);

    // 2. Detail log in INV_Lost
    await ensureSheet(targetSheetId, "INV_Lost", LOST_HEADERS, "H");
    const lostId = await genId("LOST", targetSheetId, "INV_Lost");
    await saAppendRow(targetSheetId, "INV_Lost!A:H", [
      lostId, ts, productName, lotId, stock_id, qtyLost, note, email,
    ]);

    // 3. Unified log in INV_BranchLog
    await ensureSheet(targetSheetId, BLOG_SHEET, BLOG_HEADERS, "J");
    const logId = await genId("LOG", targetSheetId, BLOG_SHEET);
    await saAppendRow(targetSheetId, `${BLOG_SHEET}!A:J`, [
      logId, ts, "LOST", productName, lotId, stock_id, qtyLost, "—", note, email,
    ]);

    saInvalidateCache(targetSheetId);
    return NextResponse.json({ ok: true, lost_id: lostId, new_qty: newQty });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
