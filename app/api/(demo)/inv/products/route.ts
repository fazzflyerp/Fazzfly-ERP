/**
 * GET    /api/inv/products — ดึงรายการสินค้าจาก Central INV → sheet "Products"
 * POST   /api/inv/products — เพิ่มสินค้าใหม่ (SA only)
 * PATCH  /api/inv/products — แก้ไขสินค้า (SA only)
 * DELETE /api/inv/products — ลบสินค้า (SA only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saAppendRow, saUpdateRow, saGetSheetMeta, saStructuralBatchUpdate, saInvalidateCache } from "@/lib/google-sa";
import { getInvAccess } from "@/lib/inv-access";

const SHEET = "Products";

// Reads header row and returns column-index map
async function getHeaders(sid: string): Promise<{ headers: string[]; colMap: Record<string, number> }> {
  const rows    = await saReadRange(sid, `${SHEET}!A1:Z1`, 0);
  const headers = (rows[0] ?? []).map((h: any) => (h ?? "").toString().toLowerCase().trim());
  const colMap: Record<string, number> = {};
  headers.forEach((h, i) => { colMap[h] = i; });
  return { headers, colMap };
}

function safeGet(row: any[], idx: number, fallback = "") {
  return idx >= 0 ? (row[idx] ?? fallback).toString().trim() : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!access.centralSheetId) return NextResponse.json({ error: "Central INV not configured" }, { status: 400 });

    const rows = await saReadRange(access.centralSheetId, `${SHEET}!A:Z`);
    if (rows.length < 2) return NextResponse.json({ products: [] });

    const headers = rows[0].map((h: any) => (h ?? "").toString().toLowerCase().trim());
    const col = (name: string) => {
      const exact = headers.indexOf(name);
      return exact >= 0 ? exact : headers.findIndex((h: string) => h.includes(name));
    };

    const nameCol    = col("product_name") >= 0 ? col("product_name") : 0;
    const catCol     = col("category");
    const brandCol   = col("brand");
    const unitCol    = col("unit");
    const unitPkgCol = col("unit_pkg");
    const qtyPkgCol  = col("qty_per_pkg");

    const products = rows.slice(1).map((row: any[], idx: number) => {
      const name = (row[nameCol] ?? "").toString().trim();
      if (!name) return null;
      return {
        product_id:   idx + 1,
        product_name: name,
        category:     catCol     >= 0 ? safeGet(row, catCol)     : "",
        brand:        brandCol   >= 0 ? safeGet(row, brandCol)   : "",
        unit:         unitCol    >= 0 ? safeGet(row, unitCol)    : "",
        unit_pkg:     unitPkgCol >= 0 ? safeGet(row, unitPkgCol) : "",
        qty_per_pkg:  qtyPkgCol  >= 0 ? Number(row[qtyPkgCol] ?? 1) : 1,
      };
    }).filter(Boolean);

    return NextResponse.json({ products });
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
    if (!access || access.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!access.centralSheetId) return NextResponse.json({ error: "Central INV not configured" }, { status: 400 });

    const { product_name, category, brand, unit, unit_pkg, qty_per_pkg } = await request.json();
    if (!product_name) return NextResponse.json({ error: "product_name required" }, { status: 400 });

    const sid = access.centralSheetId;
    const { headers } = await getHeaders(sid);

    // Build row matching header order
    const row = headers.map((h) => {
      if (h === "product_name") return product_name || "";
      if (h === "category")    return category     || "";
      if (h === "brand")       return brand        || "";
      if (h === "unit")        return unit         || "";
      if (h === "unit_pkg")    return unit_pkg     || "";
      if (h === "qty_per_pkg") return qty_per_pkg  || 1;
      return "";
    });

    // If no headers defined, append in default order
    const toAppend = row.length > 0 ? row : [product_name, category || "", brand || "", unit || "", unit_pkg || "", qty_per_pkg || 1];
    await saAppendRow(sid, `${SHEET}!A:Z`, toAppend);

    saInvalidateCache(sid);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access || access.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!access.centralSheetId) return NextResponse.json({ error: "Central INV not configured" }, { status: 400 });

    const { product_id, product_name, category, brand, unit, unit_pkg, qty_per_pkg } = await request.json();
    if (!product_id) return NextResponse.json({ error: "product_id required" }, { status: 400 });

    const sid = access.centralSheetId;

    // Read all rows to find the data row
    const rows = await saReadRange(sid, `${SHEET}!A:Z`, 0);
    // product_id is 1-based data index → sheet row = product_id + 1 (row 1 = header)
    const sheetRowNum = Number(product_id) + 1;
    if (sheetRowNum < 2 || sheetRowNum > rows.length) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const headers = rows[0].map((h: any) => (h ?? "").toString().toLowerCase().trim());
    const currentRow = [...(rows[sheetRowNum - 1] ?? [])];

    // Update fields by header position
    headers.forEach((h, i) => {
      if (h === "product_name" && product_name !== undefined) currentRow[i] = product_name;
      if (h === "category"     && category     !== undefined) currentRow[i] = category;
      if (h === "brand"        && brand        !== undefined) currentRow[i] = brand;
      if (h === "unit"         && unit         !== undefined) currentRow[i] = unit;
      if (h === "unit_pkg"     && unit_pkg     !== undefined) currentRow[i] = unit_pkg;
      if (h === "qty_per_pkg"  && qty_per_pkg  !== undefined) currentRow[i] = qty_per_pkg;
    });

    await saUpdateRow(sid, `${SHEET}!A${sheetRowNum}`, currentRow);
    saInvalidateCache(sid);
    return NextResponse.json({ ok: true, product_id });
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
    if (!access || access.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!access.centralSheetId) return NextResponse.json({ error: "Central INV not configured" }, { status: 400 });

    const { product_id } = await request.json();
    if (!product_id) return NextResponse.json({ error: "product_id required" }, { status: 400 });

    const sid = access.centralSheetId;

    // 0-based sheet row: header=0, first data=1, product_id 1 → index 1
    const rowIndex = Number(product_id); // 0-based: product_id=1 → index 1
    const { sheetId } = await saGetSheetMeta(sid, SHEET);
    await saStructuralBatchUpdate(sid, [{
      deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex + 1 } },
    }]);

    saInvalidateCache(sid);
    return NextResponse.json({ ok: true, product_id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
