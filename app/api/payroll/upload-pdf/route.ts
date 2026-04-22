/**
 * =============================================================================
 * FILE PATH: app/api/payroll/upload-pdf/route.ts
 * =============================================================================
 *
 * Upload Payroll Slip PDF to Google Drive via SA
 * ✅ ใช้ SA — ทั้ง Admin และ Staff สามารถ save ได้
 * ✅ ไฟล์ขึ้น Drive ของ Admin (SA มีสิทธิ์อยู่แล้ว)
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saFindOrCreateFolder, saUploadFile, saLog } from "@/lib/google-sa";

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);

  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((token as any).error === "RefreshAccessTokenError")
      return NextResponse.json({ error: "Session expired", code: "TOKEN_EXPIRED" }, { status: 401 });

    const formData = await request.formData();
    const pdfFile        = formData.get("file") as File;
    const employeeId     = formData.get("employeeId") as string;
    const employeeName   = formData.get("employeeName") as string;
    const payPeriod      = formData.get("payPeriod") as string; // "มกราคม 2026"
    const rootFolderId   = formData.get("rootFolderId") as string;
    const spreadsheetId  = formData.get("spreadsheetId") as string | null;

    if (!pdfFile || !employeeId || !payPeriod || !rootFolderId)
      return NextResponse.json({ error: "Missing required fields: file, employeeId, payPeriod, rootFolderId" }, { status: 400 });

    console.log(`👤 [${requestId}] Employee: ${employeeId} - ${employeeName || "N/A"}, Period: ${payPeriod}`);

    // Parse period → year + monthNum
    const periodParts = payPeriod.trim().split(/\s+/);
    const year = periodParts[periodParts.length - 1];
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
    const yearFolderId  = await saFindOrCreateFolder(year, rootFolderId);
    const monthFolderId = await saFindOrCreateFolder(monthNum, yearFolderId);

    // Upload PDF
    const fileName = employeeName
      ? `${employeeName}_${year}-${monthNum}.pdf`
      : `${employeeId}_${year}-${monthNum}.pdf`;
    const buffer = Buffer.from(await pdfFile.arrayBuffer());

    const { fileId, webViewLink } = await saUploadFile({
      fileName,
      mimeType: "application/pdf",
      buffer,
      parentFolderId: monthFolderId,
    });

    console.log(`✅ [${requestId}] Uploaded: ${fileId}`);

    const userEmail = ((token as any)?.email as string || "").toLowerCase();
    if (spreadsheetId) {
      saLog(spreadsheetId, {
        email: userEmail,
        action: "upload_pdf",
        module: "payroll",
        detail: `${fileName} — ${payPeriod}`,
      });
    }

    return NextResponse.json({
      success: true,
      fileId,
      fileName,
      webViewLink,
      folderPath: `${year}/${monthNum}/`,
    });

  } catch (error: any) {
    console.error(`❌ [${requestId}] ERROR:`, error.message);
    return NextResponse.json({ error: "Failed to upload PDF", details: error.message }, { status: 500 });
  }
}
