/**
 * Program Price Presets API
 * path: app/api/(demo)/module/program-price/route.ts
 *
 * GET  /api/module/program-price?spreadsheetId=
 *   → อ่านชีท "Program_Price" คืน presets map { [program]: { price, price_type } }
 *   → ถ้าไม่พบ sheet → คืน presets={} (ไม่ block UI)
 *
 * POST /api/module/program-price
 *   body: { spreadsheetId, presets: [{ program, price, price_type }] }
 *   → เขียน preset ทั้งหมดลงชีท Program_Price (overwrite)
 *   → สร้างชีทอัตโนมัติถ้ายังไม่มี
 *
 * Program_Price sheet columns:
 *   A = program (ชื่อโปรแกรม)
 *   B = price   (ราคา number)
 *   C = price_type  ("per_unit" | "fixed")
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saWriteRange, saInvalidateCache, getSheetsClient } from "@/lib/google-sa";

const SHEET = "Program_Price";
const HEADERS = ["program", "price", "price_type"];

// ── Helper: ensure Program_Price sheet exists ──────────────────────────────
async function ensureProgramPriceSheet(spreadsheetId: string) {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = (meta.data.sheets || []).some((s) => s.properties?.title === SHEET);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: SHEET } } }] },
    });
  }
}

// ── GET ────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const spreadsheetId = request.nextUrl.searchParams.get("spreadsheetId");
  if (!spreadsheetId) return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });

  try {
    const rows = await saReadRange(spreadsheetId, SHEET);
    const data = rows.slice(1); // skip header
    const presets: Record<string, { price: number; price_type: "per_unit" | "fixed" }> = {};
    // also return as ordered array for the settings UI
    const list: { program: string; price: number; price_type: "per_unit" | "fixed" }[] = [];
    for (const row of data) {
      const program    = (row[0] || "").trim();
      const price      = parseFloat(row[1] || "0") || 0;
      const price_type = (row[2] || "per_unit").trim().toLowerCase() === "fixed" ? "fixed" : "per_unit";
      if (program) {
        presets[program] = { price, price_type };
        list.push({ program, price, price_type });
      }
    }
    return NextResponse.json({ presets, list });
  } catch {
    return NextResponse.json({ presets: {}, list: [] });
  }
}

// ── POST ───────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { spreadsheetId, presets } = body;
  if (!spreadsheetId) return NextResponse.json({ error: "Missing spreadsheetId" }, { status: 400 });
  if (!Array.isArray(presets))    return NextResponse.json({ error: "Missing presets array" }, { status: 400 });

  try {
    await ensureProgramPriceSheet(spreadsheetId);

    // Build rows: header + data
    const rows: string[][] = [
      HEADERS,
      ...presets
        .filter((p: any) => p.program?.trim())
        .map((p: any) => [
          String(p.program).trim(),
          String(p.price ?? ""),
          p.price_type === "fixed" ? "fixed" : "per_unit",
        ]),
    ];

    // Clear + rewrite entire sheet
    await saWriteRange(spreadsheetId, `${SHEET}!A1`, rows);
    saInvalidateCache(spreadsheetId);

    return NextResponse.json({ success: true, count: rows.length - 1 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
