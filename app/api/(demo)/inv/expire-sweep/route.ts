/**
 * POST /api/inv/expire-sweep
 * ตรวจสอบ INV_Stock ของสาขา — หากรายการใดหมดอายุแล้วและยังมี qty_remaining > 0
 * จะตัด qty_remaining = 0 และบันทึกใน INV_BranchLog ว่า "EXPIRED"
 *
 * เรียกอัตโนมัติจาก frontend ทุกครั้งที่โหลดหน้า หรือเปลี่ยนสาขา
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

/** แปลง string เป็น Date — รองรับทั้ง YYYY-MM-DD และ DD/MM/YYYY */
function parseDate(s: string): Date | null {
  if (!s || s === "—") return null;

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  // DD/MM/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const d = new Date(+m[3], +m[2] - 1, +m[1]);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body      = await request.json().catch(() => ({}));
    const branch_id = body?.branch_id ?? "";

    // Resolve branch sheet
    let sheetId = access.branchSheetId;
    if (branch_id && access.role === "SUPER_ADMIN") {
      const b = (access.allBranchSheets as any[]).find((x) => x.branchId === branch_id);
      sheetId = b?.sheetId ?? null;
    }
    if (!sheetId) return NextResponse.json({ error: "Branch INV not configured" }, { status: 400 });

    // วันนี้ ณ เวลาเริ่มวัน (timezone Bangkok)
    const now   = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // 00:00:00 local

    // อ่าน INV_Stock (A:Q รองรับ opened lot columns)
    // cols: A=stock_id(0) B=product_id(1) C=product_name(2) D=category(3) E=brand(4)
    //       F=unit(5) G=unit_pkg(6) H=lot_id(7) I=qty_received(8) J=qty_remaining(9)
    //       K=expiry_date(10) L=transfer_id(11) M=received_at(12) N=cost_per_unit(13)
    //       O=parent_stock_id(14) P=is_opened(15) Q=opened_at(16)
    let rows: any[][] = [];
    try {
      rows = await saReadRange(sheetId, "INV_Stock!A:Q", 0);
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      if (msg.includes("Unable to parse range") || msg.includes("not found")) {
        return NextResponse.json({ swept: 0, items: [] });
      }
      throw err;
    }

    if (rows.length <= 1) return NextResponse.json({ swept: 0, items: [] });

    // หาแถวที่หมดอายุและยังมี qty > 0
    type ExpiredRow = { rowIdx: number; row: any[]; expiryStr: string; productName: string; lotId: string; qty: number };
    const expired: ExpiredRow[] = [];

    for (let i = 1; i < rows.length; i++) {
      const r          = rows[i];
      const qtyRemain  = Number(r[9] ?? 0);
      if (qtyRemain <= 0) continue;

      const expiryStr  = (r[10] ?? "").toString().trim();
      if (!expiryStr || expiryStr === "—") continue;

      const expDate    = parseDate(expiryStr);
      if (!expDate) continue;

      // strip time from expDate for fair comparison
      const expDay = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
      if (expDay < today) {
        expired.push({
          rowIdx:      i,
          row:         r,
          expiryStr,
          productName: (r[2]  ?? "").toString(),
          lotId:       (r[7]  ?? "").toString(),
          qty:         qtyRemain,
        });
      }
    }

    if (expired.length === 0) return NextResponse.json({ swept: 0, items: [] });

    const ts      = thaiTimestamp();
    const swept   = [];

    // เตรียม INV_BranchLog
    await ensureBranchLog(sheetId);

    for (const item of expired) {
      // 1. ตัด qty_remaining = 0
      const updatedRow   = [...item.row];
      updatedRow[9]      = 0;
      await saUpdateRow(sheetId, `INV_Stock!A${item.rowIdx + 1}`, updatedRow);

      // 2. Log EXPIRED ใน INV_BranchLog
      const logId = await genId("LOG", sheetId, BLOG_SHEET);
      await saAppendRow(sheetId, `${BLOG_SHEET}!A:J`, [
        logId, ts, "EXPIRED",
        item.productName,
        item.lotId,
        (item.row[0] ?? "").toString(),  // stock_id
        item.qty,
        `หมดอายุ ${item.expiryStr}`,
        "ระบบตัดอัตโนมัติ",
        "system",
      ]);

      swept.push({ stock_id: (item.row[0] ?? "").toString(), product_name: item.productName, qty: item.qty });
    }

    saInvalidateCache(sheetId);
    return NextResponse.json({ swept: swept.length, items: swept });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
