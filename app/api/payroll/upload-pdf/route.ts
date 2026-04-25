/**
 * Upload Payroll Slip PDF to Google Drive
 * ✅ ใช้ token ของ Admin บริษัทนั้น — ไฟล์ขึ้น Drive ของ Admin เสมอ
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saLog } from "@/lib/google-sa";
import { adminFindOrCreateFolder, adminDriveUpload } from "@/lib/admin-drive";

const MASTER_SHEET_ID = process.env.MASTER_SHEET_ID!;

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);

  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((token as any).error === "RefreshAccessTokenError")
      return NextResponse.json({ error: "Session expired", code: "TOKEN_EXPIRED" }, { status: 401 });

    const userEmail = ((token as any)?.email as string || "").toLowerCase();

    // หา clientId จาก client_user
    const userRows = await saReadRange(MASTER_SHEET_ID, "client_user!A:E");
    const userRow = userRows.slice(1).find(
      (r) => (r[1] ?? "").toString().toLowerCase().trim() === userEmail
    );
    if (!userRow) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const clientId = (userRow[0] ?? "").toString().trim();

    const formData = await request.formData();
    const pdfFile       = formData.get("file") as File;
    const employeeId    = formData.get("employeeId") as string;
    const employeeName  = formData.get("employeeName") as string;
    const payPeriod     = formData.get("payPeriod") as string; // "มกราคม 2026"
    const rootFolderId  = formData.get("rootFolderId") as string;
    const spreadsheetId = formData.get("spreadsheetId") as string | null;

    if (!pdfFile || !employeeId || !payPeriod || !rootFolderId)
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    console.log(`👤 [${requestId}] Employee: ${employeeId}, Client: ${clientId}, Period: ${payPeriod}`);

    // Parse period → year + monthNum
    const periodParts = payPeriod.trim().split(/\s+/);
    const year      = periodParts[periodParts.length - 1];
    const monthName = periodParts[0];

    const thaiMonthsFull  = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
    const thaiMonthsShort = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
    const engMonths       = ["January","February","March","April","May","June","July","August","September","October","November","December"];

    let monthNum = "01";
    let idx = thaiMonthsFull.indexOf(monthName);
    if (idx === -1) idx = thaiMonthsShort.indexOf(monthName);
    if (idx === -1) idx = engMonths.indexOf(monthName);
    if (idx !== -1) monthNum = String(idx + 1).padStart(2, "0");

    // Create folder structure: YYYY/MM/
    const yearFolderId  = await adminFindOrCreateFolder(clientId, year, rootFolderId);
    const monthFolderId = await adminFindOrCreateFolder(clientId, monthNum, yearFolderId);

    const fileName = employeeName
      ? `${employeeName}_${year}-${monthNum}.pdf`
      : `${employeeId}_${year}-${monthNum}.pdf`;
    const buffer = Buffer.from(await pdfFile.arrayBuffer());

    const { fileId, webViewLink } = await adminDriveUpload({
      clientId,
      fileName,
      mimeType: "application/pdf",
      buffer,
      parentFolderId: monthFolderId,
    });

    console.log(`✅ [${requestId}] Uploaded: ${fileId}`);

    if (spreadsheetId) {
      saLog(spreadsheetId, {
        email:  userEmail,
        action: "upload_pdf",
        module: "payroll",
        detail: `${fileName} — ${payPeriod}`,
      });
    }

    return NextResponse.json({ success: true, fileId, fileName, webViewLink, folderPath: `${year}/${monthNum}/` });

  } catch (error: any) {
    console.error(`❌ [${requestId}] payroll/upload-pdf:`, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
