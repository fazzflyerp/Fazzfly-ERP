/**
 * GET  /api/expense/fee-config?spreadsheetId=&branchId=&salesConfigName=
 * POST /api/expense/fee-config  (SUPER_ADMIN only)
 *
 * Expense_FeeConfig sheet cols: A=field_name | B=label | C=fee_pct | D=active | E=branch_id
 *
 * แต่ละสาขามี fee config แยกกัน — Central เท่านั้นที่แก้ได้
 * Branch admin อ่านได้อย่างเดียว
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  saReadRange, saUpdateRow, saBatchUpdate,
  saStructuralBatchUpdate, saInvalidateCache,
} from "@/lib/google-sa";

const FEE_SHEET   = "Expense_FeeConfig";
const FEE_HEADERS = ["field_name", "label", "fee_pct", "active", "branch_id"];

const MASTER_SHEET_ID = process.env.MASTER_SHEET_ID!;

async function getRole(email: string): Promise<string> {
  try {
    const rows = await saReadRange(MASTER_SHEET_ID, "client_user!A:C");
    const found = rows.slice(1).find((r: any[]) =>
      (r[1] ?? "").toString().toLowerCase().trim() === email
    );
    return found ? (found[2] ?? "STAFF").toString().trim().toUpperCase() : "STAFF";
  } catch { return "STAFF"; }
}

async function ensureFeeSheet(spreadsheetId: string) {
  try {
    await saReadRange(spreadsheetId, `${FEE_SHEET}!A1`, 0);
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    if (!msg.includes("Unable to parse range") && !msg.includes("not found")) throw err;
    await saStructuralBatchUpdate(spreadsheetId, [{ addSheet: { properties: { title: FEE_SHEET } } }]);
    await saUpdateRow(spreadsheetId, `${FEE_SHEET}!A1:E1`, FEE_HEADERS);
    saInvalidateCache(spreadsheetId);
  }
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const spreadsheetId   = searchParams.get("spreadsheetId");
    const branchId        = (searchParams.get("branchId") || "").trim();
    const salesConfigName = searchParams.get("salesConfigName") || "Helper_Sales_config";

    if (!spreadsheetId || !branchId)
      return NextResponse.json({ error: "Missing spreadsheetId or branchId" }, { status: 400 });

    // ── 1. อ่าน Helper_Sales_config เพื่อดึงชื่อ payment channels ─────────────
    const paymentFields: { field_name: string; label: string }[] = [];
    try {
      const rows = await saReadRange(spreadsheetId, `${salesConfigName}!A:E`);
      if (rows.length >= 2) {
        const hdrs   = rows[0].map((h: any) => (h ?? "").toString().toLowerCase().trim());
        const fnIdx  = hdrs.findIndex((h: string) => h === "field_name");
        const lblIdx = hdrs.findIndex((h: string) => h === "label");
        if (fnIdx >= 0 && lblIdx >= 0) {
          rows.slice(1).forEach((r: any[]) => {
            const fn = (r[fnIdx] ?? "").toString().trim();
            if (fn.startsWith("payment_")) {
              const rawLabel = (r[lblIdx] ?? fn).toString().trim();
              // เติม "ค่าธรรมเนียม" ด้านหน้าเสมอ (ถ้ายังไม่มี)
              const label = rawLabel.startsWith("ค่าธรรมเนียม") ? rawLabel : `ค่าธรรมเนียม${rawLabel}`;
              paymentFields.push({ field_name: fn, label });
            }
          });
        }
      }
    } catch { /* Helper_Sales_config อาจยังไม่มี */ }

    // ── 2. อ่าน Expense_FeeConfig — กรองเฉพาะสาขานี้ ─────────────────────────
    const saved = new Map<string, { label: string; fee_pct: number; active: boolean }>();
    try {
      const feeRows = await saReadRange(spreadsheetId, `${FEE_SHEET}!A:E`);
      feeRows.slice(1).forEach((r: any[]) => {
        const fn       = (r[0] ?? "").toString().trim();
        const rowBranch = (r[4] ?? "").toString().trim();
        if (!fn || rowBranch !== branchId) return; // กรองเฉพาะสาขานี้
        saved.set(fn, {
          label:   (r[1] ?? "").toString().trim(),
          fee_pct: Number(r[2] ?? 0),
          active:  (r[3] ?? "").toString().toLowerCase() !== "false",
        });
      });
    } catch { /* ยังไม่มี sheet */ }

    // ── 3. Merge ──────────────────────────────────────────────────────────────
    const baseFields = [
      ...paymentFields,
      { field_name: "__vat__", label: "VAT สินค้า/บริการ" },
    ];

    const configs = baseFields.map((f) => {
      const s = saved.get(f.field_name);
      // ใช้ label จาก Helper_Sales_config เป็นหลัก (มี prefix แล้ว)
      // ถ้า saved label มี prefix → ใช้ saved, ถ้าไม่มี → ใช้ default ที่ได้จาก paymentFields
      const savedLabel = s?.label ?? "";
      const label = savedLabel && savedLabel.startsWith("ค่าธรรมเนียม")
        ? savedLabel  // saved label OK แล้ว
        : f.label;    // ใช้ default (มี prefix จาก paymentFields แล้ว) หรือ label จาก baseFields
      return {
        field_name: f.field_name,
        label,
        fee_pct:    s?.fee_pct ?? 0,
        active:     s?.active  ?? false,
      };
    });

    return NextResponse.json({ configs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── POST (SUPER_ADMIN only) ───────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email = (token.email as string).toLowerCase().trim();
    const role  = await getRole(email);
    if (role !== "SUPER_ADMIN")
      return NextResponse.json({ error: "Forbidden — Central เท่านั้นที่แก้ fee config ได้" }, { status: 403 });

    const { spreadsheetId, branchId, configs } = await request.json();
    if (!spreadsheetId || !branchId || !Array.isArray(configs))
      return NextResponse.json({ error: "Missing spreadsheetId, branchId, or configs" }, { status: 400 });

    await ensureFeeSheet(spreadsheetId);

    // ── อ่าน rows ทั้งหมด → เก็บ rows ของสาขาอื่นไว้ ทดแทนเฉพาะสาขานี้ ────────
    let otherRows: any[][] = [];
    try {
      const existing = await saReadRange(spreadsheetId, `${FEE_SHEET}!A:E`, 0);
      otherRows = existing.slice(1).filter((r: any[]) => {
        const rb = (r[4] ?? "").toString().trim();
        return rb !== "" && rb !== branchId; // คงแถวของสาขาอื่น
      });
    } catch { /* ไม่มี rows เดิม */ }

    // rows ใหม่สำหรับ branchId นี้
    const newRows = configs.map((c: any) => [
      (c.field_name ?? "").toString(),
      (c.label      ?? "").toString(),
      Number(c.fee_pct) || 0,
      c.active ? "true" : "false",
      branchId,
    ]);

    const allDataRows = [...otherRows, ...newRows];
    const allRows     = [FEE_HEADERS, ...allDataRows];
    const bufferEnd   = allRows.length + 20;

    await saBatchUpdate(spreadsheetId, [
      {
        range:  `${FEE_SHEET}!A1:E${allRows.length}`,
        values: allRows,
      },
      {
        range:  `${FEE_SHEET}!A${allRows.length + 1}:E${bufferEnd}`,
        values: Array(20).fill(["", "", "", "", ""]),
      },
    ]);

    saInvalidateCache(spreadsheetId);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
