/**
 * GET /api/rental/catalog?spreadsheetId=&catalogName=
 * อ่าน catalog ชุดทั้งหมด 1 แถว = 1 ชุดจริง
 * col A = ชื่อชุด, col B = ไซส์
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange } from "@/lib/google-sa";

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const spreadsheetId = searchParams.get("spreadsheetId");
    const catalogName   = searchParams.get("catalogName");

    if (!spreadsheetId || !catalogName)
      return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const rows = await saReadRange(spreadsheetId, `${catalogName}!A:B`);
    if (!rows.length) return NextResponse.json({ items: [] });

    // detect header row
    const HEADER_KEYWORDS = ["ชื่อ", "name", "id", "code", "ชุด", "product"];
    const firstRow = rows[0] ?? [];
    const hasHeader = firstRow.some((c: any) =>
      HEADER_KEYWORDS.includes((c ?? "").toString().trim().toLowerCase())
    );
    const dataRows = hasHeader ? rows.slice(1) : rows;

    const items = dataRows
      .map((r: any[]) => ({
        name: (r[0] ?? "").toString().trim(),
        size: (r[1] ?? "").toString().trim(),
      }))
      .filter(({ name }) => name !== "");

    return NextResponse.json({ items });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
