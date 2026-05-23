/**
 * GET /api/expense/config?spreadsheetId=&configName=
 * อ่าน Expense Config sheet → คืน fields[]
 * type2: "P" = รายจ่าย (บวก) | "N" = หัก
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange } from "@/lib/google-sa";

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const spreadsheetId = searchParams.get("spreadsheetId");
    const configName    = searchParams.get("configName");

    if (!spreadsheetId || !configName)
      return NextResponse.json({ error: "Missing spreadsheetId or configName" }, { status: 400 });

    const rows = await saReadRange(spreadsheetId, `${configName}!A:Z`);
    if (rows.length < 2) return NextResponse.json({ fields: [] });

    const headers = rows[0].map((h: any) => (h ?? "").toString().toLowerCase().trim());
    const idx = (name: string) => headers.findIndex((h: string) => h === name);

    const col = {
      fieldName: idx("field_name") >= 0 ? idx("field_name") : 0,
      label:     idx("label")     >= 0 ? idx("label")     : 1,
      type:      idx("type")      >= 0 ? idx("type")      : 2,
      type2:     idx("type2"),
      order:     idx("order"),
    };

    const fields = rows.slice(1)
      .filter((r: any[]) => (r[col.fieldName] ?? "").toString().trim())
      .map((r: any[]) => {
        const orderVal = col.order >= 0 ? (r[col.order] ?? "").toString().trim() : "";
        return {
          fieldName: (r[col.fieldName] ?? "").toString().trim(),
          label:     (r[col.label]     ?? "").toString().trim(),
          type:      (r[col.type]      ?? "text").toString().trim(),
          type2:     col.type2 >= 0 ? (r[col.type2] ?? "").toString().trim().toUpperCase() : "P",
          order:     orderVal ? parseInt(orderVal) : 999,
        };
      })
      .sort((a, b) => a.order - b.order);

    return NextResponse.json({ fields });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
