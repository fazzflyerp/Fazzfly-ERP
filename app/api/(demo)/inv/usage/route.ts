/**
 * GET    /api/inv/usage — รายการการใช้สินค้า
 * POST   /api/inv/usage — บันทึกการใช้สินค้า (FIFO)
 * DELETE /api/inv/usage — ลบ record การใช้ + คืน qty กลับ INV_Stock (SA only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saUpdateRow, saAppendRow, saInvalidateCache, saGetSheetMeta, saStructuralBatchUpdate } from "@/lib/google-sa";
import { getInvAccess, genId, thaiTimestamp } from "@/lib/inv-access";

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = request.nextUrl;
    const availableOnly = searchParams.get("available") === "true";
    const branchIdQ     = searchParams.get("branchId") || "";
    const fresh         = searchParams.get("fresh") === "1";

    let targetSheetId = access.branchSheetId;
    if (branchIdQ && access.role === "SUPER_ADMIN") {
      const b = access.allBranchSheets.find((x) => x.branchId === branchIdQ);
      targetSheetId = b?.sheetId ?? null;
    }

    if (!targetSheetId)
      return NextResponse.json({ error: "Branch INV not configured" }, { status: 400 });

    if (availableOnly) {
      // Return distinct products with qty_remaining > 0 (for dropdown)
      const stockRows = await saReadRange(targetSheetId, "INV_Stock!A:Q", fresh ? 0 : undefined);
      const available: Record<string, any> = {};
      stockRows.slice(1).forEach((r: any[]) => {
        const remaining = Number(r[9] ?? 0);
        if (remaining <= 0) return;
        const pid = (r[1] ?? "").toString();
        if (!pid) return;
        if (!available[pid]) {
          available[pid] = {
            product_id:   pid,
            product_name: (r[2] ?? "").toString(),
            category:     (r[3] ?? "").toString(),
            unit:         (r[5] ?? "").toString(),
            total_remaining: 0,
          };
        }
        available[pid].total_remaining += remaining;
      });
      return NextResponse.json({ products: Object.values(available) });
    }

    // Return usage log
    const rows = await saReadRange(targetSheetId, "INV_Usage!A:N");
    const usages = rows.slice(1).map((r: any[]) => ({
      usage_id:     (r[0]  ?? "").toString(),
      product_id:   (r[1]  ?? "").toString(),
      product_name: (r[2]  ?? "").toString(),
      category:     (r[3]  ?? "").toString(),
      unit:         (r[4]  ?? "").toString(),
      lot_id:       (r[5]  ?? "").toString(),
      expiry_date:  (r[6]  ?? "").toString(),
      qty_used:     Number(r[7] ?? 0),
      doctor:       (r[8]  ?? "").toString(),
      note:         (r[9]  ?? "").toString(),
      used_by:      (r[10] ?? "").toString(),
      used_at:      (r[11] ?? "").toString(),
      cost_per_unit: Number(r[12] ?? 0),
      cost_total:    Number(r[13] ?? 0),
    })).filter((u) => u.usage_id).reverse();

    return NextResponse.json({ usages });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { product_id, product_name, category, unit, qty_used, doctor, note, branch_id } = body;

    if (!product_id || !qty_used)
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    const qtyNeeded = Number(qty_used);
    if (qtyNeeded <= 0)
      return NextResponse.json({ error: "qty_used must be > 0" }, { status: 400 });

    let targetSheetId = access.branchSheetId;
    if (branch_id && access.role === "SUPER_ADMIN") {
      const b = access.allBranchSheets.find((x) => x.branchId === branch_id);
      targetSheetId = b?.sheetId ?? null;
    }

    if (!targetSheetId)
      return NextResponse.json({ error: "Branch INV not configured" }, { status: 400 });

    const bSid = targetSheetId;

    // Read INV_Stock — FIFO: sort by expiry_date ASC (A:Q includes cost_per_unit at 13, opened lot at 14-16)
    const stockRows = await saReadRange(bSid, "INV_Stock!A:Q", 0);

    // Filter rows matching product_id with qty_remaining > 0
    type StockRow = { rowIdx: number; row: any[]; lot_id: string; expiry_date: string; qty_remaining: number; cost_per_unit: number };
    const matching: StockRow[] = stockRows
      .slice(1)
      .map((r: any[], i: number) => ({
        rowIdx: i + 1,
        row: r,
        lot_id: (r[7] ?? "").toString(),
        expiry_date: (r[10] ?? "").toString(),
        qty_remaining: Number(r[9] ?? 0),
        cost_per_unit: Number(r[13] ?? 0),
      }))
      .filter((s: StockRow) => (s.row[1] ?? "").toString() === product_id.toString() && s.qty_remaining > 0);

    // FIFO: earliest expiry first
    matching.sort((a: StockRow, b: StockRow) => {
      if (!a.expiry_date) return 1;
      if (!b.expiry_date) return -1;
      return a.expiry_date.localeCompare(b.expiry_date);
    });

    const totalAvailable = matching.reduce((sum: number, s: StockRow) => sum + s.qty_remaining, 0);
    if (totalAvailable < qtyNeeded)
      return NextResponse.json({ error: `ไม่เพียงพอ: คงเหลือ ${totalAvailable} ${unit}` }, { status: 409 });

    const ts      = thaiTimestamp();
    const usageId = await genId("USE", bSid, "INV_Usage");

    // Deduct FIFO across lots + compute weighted average cost
    let remaining      = qtyNeeded;
    let totalCostAccum = 0;
    const usedLots: { lot_id: string; expiry_date: string; qty: number }[] = [];

    for (const s of matching) {
      if (remaining <= 0) break;
      const deduct = Math.min(remaining, s.qty_remaining);
      remaining -= deduct;

      const updatedRow = [...s.row];
      updatedRow[9] = s.qty_remaining - deduct;
      await saUpdateRow(bSid, `INV_Stock!A${s.rowIdx + 1}`, updatedRow);

      totalCostAccum += s.cost_per_unit * deduct;
      usedLots.push({ lot_id: s.lot_id, expiry_date: s.expiry_date, qty: deduct });
    }

    const avgCostPerUnit = qtyNeeded > 0 ? totalCostAccum / qtyNeeded : 0;
    const usageCostTotal = totalCostAccum;

    // Append INV_Usage (A:N — col M=cost_per_unit, col N=cost_total)
    const firstLot = usedLots[0];
    await saAppendRow(bSid, "INV_Usage!A:N", [
      usageId,
      product_id,
      product_name,
      category || "",
      unit || "",
      firstLot.lot_id,
      firstLot.expiry_date,
      qtyNeeded,
      doctor || "",
      note || "",
      email,
      ts,
      avgCostPerUnit,
      usageCostTotal,
    ]);

    saInvalidateCache(bSid);

    // Expiry warning notification if any lot ≤ 30 days
    if (access.centralSheetId) {
      try {
        const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
        for (const lot of usedLots) {
          if (!lot.expiry_date) continue;
          const exp  = new Date(lot.expiry_date);
          const days = Math.floor((exp.getTime() - today.getTime()) / 86400000);
          if (days <= 30) {
            const targetBranchId = branch_id || access.branchId || "branch";
            await saAppendRow(access.centralSheetId, "INV_Notification!A:H", [
              `NOTIF-${Date.now()}`,
              targetBranchId,
              targetBranchId,
              "expiry_warning",
              `สินค้า ${product_name} lot ${lot.lot_id} ใกล้หมดอายุ (${lot.expiry_date}) เหลือ ${days} วัน`,
              lot.lot_id,
              "FALSE",
              ts,
            ]);
          }
        }
      } catch { /* non-blocking */ }
    }

    return NextResponse.json({ usage_id: usageId, lots_deducted: usedLots });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access || access.role !== "SUPER_ADMIN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { usage_id, branch_id } = await request.json();
    if (!usage_id) return NextResponse.json({ error: "usage_id required" }, { status: 400 });

    let targetSheetId = access.branchSheetId;
    if (branch_id) {
      const b = access.allBranchSheets.find((x: any) => x.branchId === branch_id);
      targetSheetId = b?.sheetId ?? null;
    }
    if (!targetSheetId) return NextResponse.json({ error: "Branch INV not configured" }, { status: 400 });

    const bSid = targetSheetId;

    // Find usage row
    const usageRows = await saReadRange(bSid, "INV_Usage!A:L", 0);
    const rowIdx    = usageRows.findIndex((r, i) => i > 0 && (r[0] ?? "").toString() === usage_id);
    if (rowIdx < 1) return NextResponse.json({ error: "Usage record not found" }, { status: 404 });

    const uRow     = usageRows[rowIdx];
    const productId = (uRow[1] ?? "").toString();
    const lotId     = (uRow[5] ?? "").toString();
    const qtyUsed   = Number(uRow[7] ?? 0);

    // Restore qty to the matching INV_Stock row (by lot_id)
    if (lotId && qtyUsed > 0) {
      const stockRows = await saReadRange(bSid, "INV_Stock!A:Q", 0);
      for (let i = 1; i < stockRows.length; i++) {
        const sr = stockRows[i];
        if ((sr[7] ?? "").toString() !== lotId) continue;
        const updatedRow = [...sr];
        updatedRow[9] = Number(sr[9] ?? 0) + qtyUsed;
        await saUpdateRow(bSid, `INV_Stock!A${i + 1}`, updatedRow);
        break;
      }
    }

    // Delete usage row
    const { sheetId } = await saGetSheetMeta(bSid, "INV_Usage");
    await saStructuralBatchUpdate(bSid, [{
      deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: rowIdx, endIndex: rowIdx + 1 } },
    }]);

    saInvalidateCache(bSid);
    return NextResponse.json({ ok: true, usage_id, qty_restored: qtyUsed });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
