/**
 * /api/inv/dispense-config
 * CRUD for INV_DispenseConfig in central spreadsheet
 *
 * GET    — list all active configs (all roles)
 * POST   — create config (SA only)
 * PATCH  — update config (SA only)
 * DELETE — soft-delete config (SA only)
 *
 * INV_DispenseConfig (central):
 * config_id(0) product_id(1) product_name(2) dispense_unit(3)
 * units_per_stock(4) open_expiry_days(5) notes(6) active(7)
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  saReadRange, saUpdateRow, saAppendRow,
  saStructuralBatchUpdate, saInvalidateCache,
} from "@/lib/google-sa";
import { getInvAccess, genId } from "@/lib/inv-access";

const DC_SHEET   = "INV_DispenseConfig";
const DC_HEADERS = ["config_id","product_id","product_name","dispense_unit","units_per_stock","open_expiry_days","notes","active"];

async function ensureDCSheet(sid: string) {
  try {
    await saReadRange(sid, `${DC_SHEET}!A1`, 0);
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    if (!msg.includes("Unable to parse range") && !msg.includes("not found")) throw err;
    await saStructuralBatchUpdate(sid, [{ addSheet: { properties: { title: DC_SHEET } } }]);
    await saUpdateRow(sid, `${DC_SHEET}!A1:H1`, DC_HEADERS);
    saInvalidateCache(sid);
  }
}

// ── GET ────────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!access.centralSheetId) return NextResponse.json({ configs: [] });

    let rows: any[][] = [];
    try {
      rows = await saReadRange(access.centralSheetId, `${DC_SHEET}!A:H`, 0);
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      if (msg.includes("Unable to parse range") || msg.includes("not found"))
        return NextResponse.json({ configs: [] });
      throw err;
    }

    const configs = rows.slice(1).map((r) => ({
      config_id:        (r[0] ?? "").toString(),
      product_id:       (r[1] ?? "").toString(),
      product_name:     (r[2] ?? "").toString(),
      dispense_unit:    (r[3] ?? "").toString(),
      units_per_stock:  Number(r[4] ?? 0),
      open_expiry_days: (r[5] !== "" && r[5] != null) ? Number(r[5]) : null,
      notes:            (r[6] ?? "").toString(),
      active:           (r[7] ?? "yes").toString(),
    })).filter((c) => c.config_id && c.active !== "no");

    return NextResponse.json({ configs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── POST ───────────────────────────────────────────────────────────────────────
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

    const { product_id, product_name, dispense_unit, units_per_stock, open_expiry_days, notes } = await request.json();
    if (!product_id || !dispense_unit || !units_per_stock)
      return NextResponse.json({ error: "product_id, dispense_unit, units_per_stock ต้องมีค่า" }, { status: 400 });

    const sid      = access.centralSheetId;
    await ensureDCSheet(sid);
    const configId = await genId("DCF", sid, DC_SHEET);

    await saAppendRow(sid, `${DC_SHEET}!A:H`, [
      configId,
      product_id,
      product_name || "",
      dispense_unit,
      Number(units_per_stock),
      (open_expiry_days !== undefined && open_expiry_days !== null && open_expiry_days !== "")
        ? Number(open_expiry_days) : "",
      notes || "",
      "yes",
    ]);
    saInvalidateCache(sid);
    return NextResponse.json({ ok: true, config_id: configId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── PATCH ──────────────────────────────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
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
    const { config_id } = body;
    if (!config_id) return NextResponse.json({ error: "config_id ต้องมีค่า" }, { status: 400 });

    const sid  = access.centralSheetId;
    const rows = await saReadRange(sid, `${DC_SHEET}!A:H`, 0);
    const idx  = rows.findIndex((r: any[], i: number) => i > 0 && (r[0] ?? "").toString() === config_id);
    if (idx < 1) return NextResponse.json({ error: "Config not found" }, { status: 404 });

    const row     = rows[idx];
    const updated = [
      config_id,
      body.product_id       !== undefined ? body.product_id       : (row[1] ?? ""),
      body.product_name     !== undefined ? body.product_name     : (row[2] ?? ""),
      body.dispense_unit    !== undefined ? body.dispense_unit    : (row[3] ?? ""),
      body.units_per_stock  !== undefined ? Number(body.units_per_stock) : Number(row[4] ?? 0),
      body.open_expiry_days !== undefined
        ? (body.open_expiry_days !== null && body.open_expiry_days !== "" ? Number(body.open_expiry_days) : "")
        : (row[5] ?? ""),
      body.notes !== undefined ? body.notes : (row[6] ?? ""),
      (row[7] ?? "yes"),
    ];
    await saUpdateRow(sid, `${DC_SHEET}!A${idx + 1}`, updated);
    saInvalidateCache(sid);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── DELETE ─────────────────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access || access.role !== "SUPER_ADMIN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!access.centralSheetId)
      return NextResponse.json({ error: "Central INV not configured" }, { status: 400 });

    const { config_id } = await request.json();
    if (!config_id) return NextResponse.json({ error: "config_id ต้องมีค่า" }, { status: 400 });

    const sid  = access.centralSheetId;
    const rows = await saReadRange(sid, `${DC_SHEET}!A:H`, 0);
    const idx  = rows.findIndex((r: any[], i: number) => i > 0 && (r[0] ?? "").toString() === config_id);
    if (idx < 1) return NextResponse.json({ error: "Config not found" }, { status: 404 });

    const updated = [...rows[idx]];
    while (updated.length < 8) updated.push("");
    updated[7] = "no"; // soft-delete
    await saUpdateRow(sid, `${DC_SHEET}!A${idx + 1}`, updated);
    saInvalidateCache(sid);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
