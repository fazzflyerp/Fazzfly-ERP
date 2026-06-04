/**
 * /api/inv/protocols
 * CRUD for INV_Protocols in central spreadsheet
 *
 * GET    — list protocols grouped by protocol_id (all roles)
 * POST   — create protocol with ingredients (SA only)
 * PATCH  — update protocol name or replace ingredients (SA only)
 * DELETE — soft-delete protocol (set active="no") (SA only)
 *
 * INV_Protocols (central):
 * protocol_id(0) protocol_name(1) product_id(2) product_name(3)
 * qty(4) unit(5) sort(6) active(7)
 *
 * Multiple rows per protocol_id — one row per ingredient.
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  saReadRange, saUpdateRow, saAppendRow,
  saStructuralBatchUpdate, saInvalidateCache,
} from "@/lib/google-sa";
import { getInvAccess, genId } from "@/lib/inv-access";

const PT_SHEET   = "INV_Protocols";
const PT_HEADERS = ["protocol_id","protocol_name","product_id","product_name","qty","unit","sort","active"];

async function ensurePTSheet(sid: string) {
  try {
    await saReadRange(sid, `${PT_SHEET}!A1`, 0);
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    if (!msg.includes("Unable to parse range") && !msg.includes("not found")) throw err;
    await saStructuralBatchUpdate(sid, [{ addSheet: { properties: { title: PT_SHEET } } }]);
    await saUpdateRow(sid, `${PT_SHEET}!A1:H1`, PT_HEADERS);
    saInvalidateCache(sid);
  }
}

type ProtocolRow = {
  protocol_id: string; protocol_name: string; product_id: string; product_name: string;
  qty: number; unit: string; sort: number; active: string;
};

function parseRows(rows: any[][]): ProtocolRow[] {
  return rows.slice(1).map((r) => ({
    protocol_id:   (r[0] ?? "").toString(),
    protocol_name: (r[1] ?? "").toString(),
    product_id:    (r[2] ?? "").toString(),
    product_name:  (r[3] ?? "").toString(),
    qty:           Number(r[4] ?? 0),
    unit:          (r[5] ?? "").toString(),
    sort:          Number(r[6] ?? 0),
    active:        (r[7] ?? "yes").toString(),
  })).filter((r) => r.protocol_id);
}

function groupByProtocol(rows: ProtocolRow[]) {
  const map = new Map<string, { protocol_id: string; protocol_name: string; ingredients: any[] }>();
  for (const r of rows) {
    if (r.active === "no") continue;
    if (!map.has(r.protocol_id)) {
      map.set(r.protocol_id, { protocol_id: r.protocol_id, protocol_name: r.protocol_name, ingredients: [] });
    }
    map.get(r.protocol_id)!.ingredients.push({
      product_id: r.product_id, product_name: r.product_name,
      qty: r.qty, unit: r.unit, sort: r.sort,
    });
  }
  for (const p of map.values()) {
    p.ingredients.sort((a, b) => a.sort - b.sort);
  }
  return [...map.values()];
}

// ── GET ────────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!access.centralSheetId) return NextResponse.json({ protocols: [] });

    let rows: any[][] = [];
    try {
      rows = await saReadRange(access.centralSheetId, `${PT_SHEET}!A:H`, 0);
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      if (msg.includes("Unable to parse range") || msg.includes("not found"))
        return NextResponse.json({ protocols: [] });
      throw err;
    }

    return NextResponse.json({ protocols: groupByProtocol(parseRows(rows)) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── POST ───────────────────────────────────────────────────────────────────────
// Body: { protocol_name: string, ingredients: [{product_id, product_name, qty, unit}] }
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

    const { protocol_name, ingredients } = await request.json();
    if (!protocol_name || !Array.isArray(ingredients) || ingredients.length === 0)
      return NextResponse.json({ error: "protocol_name และ ingredients ต้องมีค่า" }, { status: 400 });

    const sid       = access.centralSheetId;
    await ensurePTSheet(sid);
    const protoId   = await genId("PTC", sid, PT_SHEET);

    for (let i = 0; i < ingredients.length; i++) {
      const ing = ingredients[i];
      await saAppendRow(sid, `${PT_SHEET}!A:H`, [
        protoId,
        protocol_name,
        ing.product_id || "",
        ing.product_name || "",
        Number(ing.qty ?? 1),
        ing.unit || "",
        i + 1,
        "yes",
      ]);
    }

    saInvalidateCache(sid);
    return NextResponse.json({ ok: true, protocol_id: protoId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── PATCH ──────────────────────────────────────────────────────────────────────
// Update all rows of a protocol:
// Body: { protocol_id, protocol_name?, ingredients? }
// If ingredients provided → replace all ingredients for this protocol
// If only protocol_name → update name on all rows
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

    const { protocol_id, protocol_name, ingredients } = await request.json();
    if (!protocol_id) return NextResponse.json({ error: "protocol_id ต้องมีค่า" }, { status: 400 });

    const sid  = access.centralSheetId;
    const rows = await saReadRange(sid, `${PT_SHEET}!A:H`, 0);

    // Find all row indices for this protocol_id
    const idxList: number[] = [];
    for (let i = 1; i < rows.length; i++) {
      if ((rows[i][0] ?? "").toString() === protocol_id) idxList.push(i);
    }
    if (idxList.length === 0)
      return NextResponse.json({ error: "Protocol not found" }, { status: 404 });

    if (Array.isArray(ingredients)) {
      // Replace ingredients: soft-delete existing rows, append new ones
      // Soft-delete existing
      for (const idx of idxList) {
        const updated = [...rows[idx]];
        while (updated.length < 8) updated.push("");
        updated[7] = "no";
        await saUpdateRow(sid, `${PT_SHEET}!A${idx + 1}`, updated);
      }
      // Append new rows
      const newName = protocol_name || (rows[idxList[0]][1] ?? "").toString();
      for (let i = 0; i < ingredients.length; i++) {
        const ing = ingredients[i];
        await saAppendRow(sid, `${PT_SHEET}!A:H`, [
          protocol_id, newName,
          ing.product_id || "", ing.product_name || "",
          Number(ing.qty ?? 1), ing.unit || "",
          i + 1, "yes",
        ]);
      }
    } else if (protocol_name) {
      // Only update protocol_name on all existing active rows
      for (const idx of idxList) {
        const updated = [...rows[idx]];
        updated[1] = protocol_name;
        await saUpdateRow(sid, `${PT_SHEET}!A${idx + 1}`, updated);
      }
    }

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

    const { protocol_id } = await request.json();
    if (!protocol_id) return NextResponse.json({ error: "protocol_id ต้องมีค่า" }, { status: 400 });

    const sid  = access.centralSheetId;
    const rows = await saReadRange(sid, `${PT_SHEET}!A:H`, 0);

    let count = 0;
    for (let i = 1; i < rows.length; i++) {
      if ((rows[i][0] ?? "").toString() === protocol_id) {
        const updated = [...rows[i]];
        while (updated.length < 8) updated.push("");
        updated[7] = "no";
        await saUpdateRow(sid, `${PT_SHEET}!A${i + 1}`, updated);
        count++;
      }
    }
    if (count === 0) return NextResponse.json({ error: "Protocol not found" }, { status: 404 });

    saInvalidateCache(sid);
    return NextResponse.json({ ok: true, deleted_rows: count });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
