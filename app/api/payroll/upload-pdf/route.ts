/**
 * =============================================================================
 * FILE PATH: app/api/payroll/upload-pdf/route.ts
 * =============================================================================
 * 
 * Upload Payroll Slip PDF to Google Drive
 * สร้าง folder structure: YYYY/MM/ และ upload PDF
 */

import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

// Helper: สร้าง OAuth2 Client
function getOAuth2Client(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  return oauth2Client;
}

// Helper: หา Folder ตาม name ใน parent folder
async function findFolder(
  drive: any,
  folderName: string,
  parentId: string
): Promise<string | null> {
  try {
    const response = await drive.files.list({
      q: `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id, name)",
      spaces: "drive",
    });

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id;
    }

    return null;
  } catch (error) {
    console.error("Error finding folder:", error);
    return null;
  }
}

// Helper: สร้าง Folder
async function createFolder(
  drive: any,
  folderName: string,
  parentId: string
): Promise<string> {
  const fileMetadata = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
    parents: [parentId],
  };

  const folder = await drive.files.create({
    requestBody: fileMetadata,
    fields: "id",
  });

  return folder.data.id;
}

// Helper: หาหรือสร้าง Folder
async function findOrCreateFolder(
  drive: any,
  folderName: string,
  parentId: string
): Promise<string> {
  let folderId = await findFolder(drive, folderName, parentId);

  if (!folderId) {
    console.log(`📁 Creating folder: ${folderName}`);
    folderId = await createFolder(drive, folderName, parentId);
  } else {
    console.log(`✅ Found existing folder: ${folderName}`);
  }

  return folderId;
}

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📤 [${requestId}] UPLOAD PAYROLL PDF TO DRIVE`);
  console.log(`${"=".repeat(60)}`);

  try {
    // 1. Get Authorization
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const accessToken = authHeader.substring(7);
    const oauth2Client = getOAuth2Client(accessToken);
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    // 2. Parse request body
    const formData = await request.formData();
    const pdfFile = formData.get("file") as File;
    const employeeId = formData.get("employeeId") as string;
    const employeeName = formData.get("employeeName") as string;
    const payPeriod = formData.get("payPeriod") as string; // "มกราคม 2026"
    const rootFolderId = formData.get("rootFolderId") as string;

    if (!pdfFile || !employeeId || !payPeriod || !rootFolderId) {
      return NextResponse.json(
        { error: "Missing required fields: file, employeeId, payPeriod, rootFolderId" },
        { status: 400 }
      );
    }

    console.log(`👤 Employee: ${employeeId} - ${employeeName || 'N/A'}`);
    console.log(`📅 Period: ${payPeriod}`);
    console.log(`📁 Root Folder: ${rootFolderId}`);

    // 3. Parse period to YYYY/MM
    // Format: "มกราคม 2026", "ม.ค. 2026", "ธ.ค. 2025", "January 2026"
    console.log(`📅 Original Period: "${payPeriod}"`);
    
    const periodParts = payPeriod.trim().split(/\s+/); // split by spaces
    const year = periodParts[periodParts.length - 1]; // Last part = year
    
    // Map month name to number (รองรับทั้งเต็มและย่อ)
    const thaiMonthsFull = [
      "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
      "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];
    
    const thaiMonthsShort = [
      "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
      "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
    ];
    
    const engMonths = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    
    let monthNum = "01";
    const monthName = periodParts[0];
    
    // ลองหาในภาษาไทยเต็ม
    let thaiIndex = thaiMonthsFull.indexOf(monthName);
    if (thaiIndex !== -1) {
      monthNum = String(thaiIndex + 1).padStart(2, '0');
    } else {
      // ลองหาในภาษาไทยย่อ
      thaiIndex = thaiMonthsShort.indexOf(monthName);
      if (thaiIndex !== -1) {
        monthNum = String(thaiIndex + 1).padStart(2, '0');
      } else {
        // ลองหาในภาษาอังกฤษ
        const engIndex = engMonths.indexOf(monthName);
        if (engIndex !== -1) {
          monthNum = String(engIndex + 1).padStart(2, '0');
        }
      }
    }

    console.log(`📁 Folder structure: ${year}/${monthNum}/`);

    // 4. Create folder structure: YYYY/MM/
    // Level 1: Year folder
    const yearFolderId = await findOrCreateFolder(drive, year, rootFolderId);

    // Level 2: Month folder
    const monthFolderId = await findOrCreateFolder(drive, monthNum, yearFolderId);

    // 5. Upload PDF file with employee name + YYYY-MM
    const fileName = employeeName 
      ? `${employeeName}_${year}-${monthNum}.pdf` 
      : `${employeeId}_${year}-${monthNum}.pdf`;
    console.log(`📤 Uploading: ${fileName}`);

    const arrayBuffer = await pdfFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fileMetadata = {
      name: fileName,
      parents: [monthFolderId],
    };

    const media = {
      mimeType: "application/pdf",
      body: require("stream").Readable.from(buffer),
    };

    const uploadedFile = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, name, webViewLink, webContentLink",
    });

    console.log(`✅ File uploaded successfully!`);
    console.log(`📁 File ID: ${uploadedFile.data.id}`);
    console.log(`🔗 View Link: ${uploadedFile.data.webViewLink}`);

    console.log(`${"=".repeat(60)}`);
    console.log(`✅ [${requestId}] SUCCESS`);
    console.log(`${"=".repeat(60)}\n`);

    return NextResponse.json({
      success: true,
      fileId: uploadedFile.data.id,
      fileName: fileName,
      webViewLink: uploadedFile.data.webViewLink,
      webContentLink: uploadedFile.data.webContentLink,
      folderPath: `${year}/${monthNum}/`,
    });

  } catch (error: any) {
    console.error(`❌ [${requestId}] ERROR:`, error);
    console.log(`${"=".repeat(60)}\n`);

    return NextResponse.json(
      { 
        error: "Failed to upload PDF",
        details: error.message 
      },
      { status: 500 }
    );
  }
}