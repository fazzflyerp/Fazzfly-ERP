/**
 * GET /api/master/config-demo
 * DEMO version — อ่าน config sheet ด้วย accessToken ของ user
 * Query: spreadsheetId, configName
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const accessToken = (token as any)?.accessToken;
    if (!accessToken) return NextResponse.json({ error: "No access token" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const spreadsheetId = searchParams.get("spreadsheetId");
    const configName    = searchParams.get("configName");

    if (!spreadsheetId || !configName)
      return NextResponse.json({ error: "Missing spreadsheetId or configName" }, { status: 400 });

    const range = `${configName}!A1:K100`;
    const url   = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Sheets API error: ${res.status}`, detail: text }, { status: 500 });
    }

    const data  = await res.json();
    const rows: any[][] = data.values || [];

    if (rows.length === 0)
      return NextResponse.json({ error: "Config sheet is empty" }, { status: 404 });

    const headerRow = rows[0];
    const headers   = headerRow.map((h: any) => (h ?? "").toString().toLowerCase().trim());

    const idx = (names: string[]) => headers.findIndex((h: string) => names.includes(h));

    const fieldNameIdx   = idx(["field_name", "field", "fieldname"]);
    const labelIdx       = idx(["label", "ชื่อแสดงผล", "name"]);
    const typeIdx        = idx(["type", "ประเภท"]);
    const requiredIdx    = idx(["required", "บังคับ"]);
    const helperIdx      = idx(["helper", "options"]);
    const orderIdx       = idx(["order", "ลำดับ"]);
    const placeholderIdx = idx(["placeholder"]);

    if (fieldNameIdx === -1 || labelIdx === -1 || typeIdx === -1)
      return NextResponse.json({ error: "Invalid config structure", found: headers }, { status: 400 });

    const fields = rows.slice(1)
      .filter((r) => r[fieldNameIdx])
      .map((r, i) => ({
        fieldName:   r[fieldNameIdx]?.toString()  || `field_${i}`,
        label:       r[labelIdx]?.toString()       || "",
        type:        r[typeIdx]?.toString()        || "text",
        required:    requiredIdx    >= 0 ? r[requiredIdx]?.toString().toUpperCase()    === "TRUE" : false,
        helper:      helperIdx      >= 0 ? r[helperIdx]?.toString()                   || null : null,
        order:       orderIdx       >= 0 ? parseInt(r[orderIdx]?.toString() || "")    || i + 1 : i + 1,
        placeholder: placeholderIdx >= 0 ? r[placeholderIdx]?.toString()              || "" : "",
      }));

    return NextResponse.json({ success: true, fields });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
