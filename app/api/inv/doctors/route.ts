/**
 * GET /api/inv/doctors
 * ดึงรายชื่อแพทย์จากชีท "Doc" ใน Branch INV spreadsheet
 * ?branchId=xxx — Super Admin ระบุสาขาได้
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange } from "@/lib/google-sa";
import { getInvAccess } from "@/lib/inv-access";

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = request.nextUrl;
    const branchIdQ = searchParams.get("branchId") || "";
    const fresh     = searchParams.get("fresh") === "1";

    let targetSheetId = access.branchSheetId;
    if (branchIdQ && access.role === "SUPER_ADMIN") {
      const b = access.allBranchSheets.find((x) => x.branchId === branchIdQ);
      targetSheetId = b?.sheetId ?? null;
    }

    if (!targetSheetId)
      return NextResponse.json({ error: "Branch INV not configured" }, { status: 400 });

    const rows = await saReadRange(targetSheetId, "Doc!A:Z", fresh ? 0 : undefined);
    if (rows.length < 2) return NextResponse.json({ doctors: [] });

    const headers = rows[0].map((h: any) => (h ?? "").toString().toLowerCase().trim());

    // หา column ชื่อหมอ: name, doctor_name, doc_name, ชื่อ — fallback คอลัมน์ A
    let nameCol = headers.findIndex((h: string) =>
      h === "name" || h === "doctor_name" || h === "doc_name" || h === "doctor" || h.includes("ชื่อ")
    );
    if (nameCol < 0) nameCol = 0;

    // หา column ใบประกอบวิชาชีพ (ถ้ามี)
    const licenseCol = headers.findIndex((h: string) =>
      h === "license" || h === "license_no" || h === "ใบประกอบ" || h.includes("license")
    );

    const doctors = rows.slice(1)
      .map((r: any[]) => {
        const name = (r[nameCol] ?? "").toString().trim();
        if (!name) return null;
        return {
          name,
          license: licenseCol >= 0 ? (r[licenseCol] ?? "").toString().trim() : "",
        };
      })
      .filter(Boolean) as { name: string; license: string }[];

    return NextResponse.json({ doctors });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
