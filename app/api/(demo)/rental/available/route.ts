/**
 * GET /api/rental/available?spreadsheetId=&helperName=&configName=&sheetName=
 * คืน helper options ของชุดที่ยังว่างอยู่ (ไม่มี active rental)
 * ใช้กับ form-demo field ที่ helper = "rental:<helperSheetName>"
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange } from "@/lib/google-sa";

const RETURNED_VALUES = new Set(["คืนแล้ว", "returned", "คืน"]);

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const spreadsheetId = searchParams.get("spreadsheetId");
    const helperName    = searchParams.get("helperName");   // sheet ชุด catalog
    const configName    = searchParams.get("configName");   // form config sheet name
    const sheetName     = searchParams.get("sheetName");    // rental data sheet name

    if (!spreadsheetId || !helperName)
      return NextResponse.json({ error: "Missing params" }, { status: 400 });

    // ถ้าไม่มี configName หรือ sheetName → ไม่สามารถ filter ได้
    if (!configName || !sheetName) {
      return await allHelperOptions(spreadsheetId, helperName);
    }

    // 1. อ่าน config เพื่อหา order ของ product และ status
    const cfgRows = await saReadRange(spreadsheetId, `${configName}!A:Z`);
    if (cfgRows.length < 2) return await allHelperOptions(spreadsheetId, helperName);

    const cfgHeaders = (cfgRows[0] ?? []).map((h: any) => (h ?? "").toString().toLowerCase().trim());
    const fnIdx  = cfgHeaders.indexOf("field_name");
    const ordIdx = cfgHeaders.indexOf("order");

    let productColIdx: number | null = null;
    let statusColIdx:  number | null = null;

    for (const row of cfgRows.slice(1)) {
      const fn  = (row[fnIdx]  ?? "").toString().trim().toLowerCase();
      const ord = parseInt((row[ordIdx] ?? "").toString().trim()) || null;
      if (productColIdx === null && (fn === "product" || fn === "costume" || fn === "item" || fn === "ชุด")) {
        if (ord !== null) productColIdx = ord - 1;
      }
      if (statusColIdx === null && (fn === "status" || fn === "สถานะ")) {
        if (ord !== null) statusColIdx = ord - 1;
      }
    }

    if (productColIdx === null || statusColIdx === null) {
      return await allHelperOptions(spreadsheetId, helperName);
    }

    // 2. อ่าน rental transactions — รวบรวม product ที่กำลังเช่าอยู่
    const txRows = await saReadRange(spreadsheetId, `${sheetName}!A:AZ`);
    const activeProducts = new Set<string>();

    for (const row of txRows.slice(1)) {
      const product = (row[productColIdx] ?? "").toString().trim();
      const status  = (row[statusColIdx]  ?? "").toString().trim().toLowerCase();
      // ถ้า product มีค่า และ status ไม่ใช่ "คืนแล้ว" → ถือว่ากำลังเช่าอยู่ (รวม empty status)
      if (product && !RETURNED_VALUES.has(status)) {
        activeProducts.add(product.toLowerCase());
      }
    }

    // 3. อ่าน helper sheet (ชุด catalog) และ filter ออกชุดที่กำลังเช่า
    const helperRows = await saReadRange(spreadsheetId, `${helperName}!A:C`);
    const options = helperRows
      .slice(1)
      .map((r: any[]) => ({
        value: (r[0] ?? "").toString().trim(),
        label: (r[1] ?? r[0] ?? "").toString().trim(),
      }))
      .filter(({ value }) => value && !activeProducts.has(value.toLowerCase()));

    return NextResponse.json({ options });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function allHelperOptions(spreadsheetId: string, helperName: string) {
  try {
    const rows = await saReadRange(spreadsheetId, `${helperName}!A:C`);
    const options = rows.slice(1)
      .map((r: any[]) => ({
        value: (r[0] ?? "").toString().trim(),
        label: (r[1] ?? r[0] ?? "").toString().trim(),
      }))
      .filter(({ value }) => value);
    return NextResponse.json({ options });
  } catch {
    return NextResponse.json({ options: [] });
  }
}
