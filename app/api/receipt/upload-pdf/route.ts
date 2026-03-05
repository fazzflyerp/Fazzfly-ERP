/**
 * =============================================================================
 * FILE PATH: app/api/receipt/upload-pdf/route.ts
 * =============================================================================
 * 
 * Upload PDF to Google Drive
 * สร้าง folder structure: YYYY/MMM/DD/ และ upload PDF
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

// Helper: หาหรือสร้าง Folder (ถ้ามีแล้วใช้เดิม ถ้าไม่มีสร้างใหม่)
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
  console.log(`📤 [${requestId}] UPLOAD PDF TO DRIVE`);
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
    const receiptNo = formData.get("receiptNo") as string;
    const customerId = formData.get("customerId") as string;
    const date = formData.get("date") as string; // Format: "15/1/2026"
    const rootFolderId = formData.get("rootFolderId") as string;

    if (!pdfFile || !receiptNo || !customerId || !date || !rootFolderId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    console.log(`📄 Receipt: ${receiptNo}`);
    console.log(`👤 Customer: ${customerId}`);
    console.log(`📅 Date: ${date}`);
    console.log(`📁 Root Folder: ${rootFolderId}`);

    // 3. Parse date (Format: DD/MM/YYYY)
    const [day, month, year] = date.split("/");
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    const monthName = monthNames[parseInt(month) - 1];

    console.log(`📁 Folder structure: ${year}/${monthName}/${day}/`);

    // 4. Create folder structure: YYYY/MMM/DD/
    // Level 1: Year folder
    const yearFolderId = await findOrCreateFolder(drive, year, rootFolderId);

    // Level 2: Month folder
    const monthFolderId = await findOrCreateFolder(drive, monthName, yearFolderId);

    // Level 3: Day folder
    const dayFolderId = await findOrCreateFolder(drive, day, monthFolderId);

    // 5. Upload PDF file
    const fileName = `${receiptNo}_${customerId}.pdf`;
    console.log(`📤 Uploading: ${fileName}`);

    const arrayBuffer = await pdfFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fileMetadata = {
      name: fileName,
      parents: [dayFolderId],
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
      folderPath: `${year}/${monthName}/${day}/`,
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