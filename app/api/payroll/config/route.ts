import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

interface PayrollConfigField {
  fieldName: string;
  label: string;
  type: string;
  type2: string; // "P" = รับ, "N" = หัก
  order: number | null;
}

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token || !(token as any)?.accessToken)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const accessToken = (token as any).accessToken as string;
    const searchParams = request.nextUrl.searchParams;
    const spreadsheetId = searchParams.get("spreadsheetId");
    const configName    = searchParams.get("configName");

    if (!spreadsheetId || !configName)
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${configName}!A:Z`,
      { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: "Failed to fetch config sheet", details: errorText }, { status: 500 });
    }

    const data  = await response.json();
    const rows  = data.values || [];
    if (rows.length === 0)
      return NextResponse.json({ error: "Config sheet is empty" }, { status: 404 });

    const headers = rows[0];
    const dataRows = rows.slice(1);

    // หา index ของแต่ละ column (case-insensitive)
    const idx = (name: string) => headers.findIndex((h: string) => h.toLowerCase() === name.toLowerCase());
    const col = {
      fieldName: idx("field_name"),
      label:     idx("label"),
      type:      idx("type"),
      type2:     idx("type2"),   // NEW
      order:     idx("order"),
    };

    const configFields: PayrollConfigField[] = dataRows
      .filter((row: any[]) => row[col.fieldName])
      .map((row: any[]) => {
        const orderVal = row[col.order]?.toString().trim();
        return {
          fieldName: row[col.fieldName]?.toString().trim() || "",
          label:     row[col.label]?.toString().trim()     || "",
          type:      row[col.type]?.toString().trim()      || "text",
          type2:     col.type2 >= 0 ? (row[col.type2]?.toString().trim().toUpperCase() || "") : "",
          order:     orderVal && orderVal !== "" ? parseInt(orderVal) : null,
        };
      });

    return NextResponse.json({ success: true, spreadsheetId, configName, fields: configFields, count: configFields.length });

  } catch (error: any) {
    return NextResponse.json({ error: "Internal server error", message: error.message }, { status: 500 });
  }
}