/**
 * Upload Image to Google Drive API - PRODUCTION READY ✅
 * POST /api/upload
 *
 * ✅ Multi-user safe
 * ✅ Rate limiting
 * ✅ Better error handling
 * ✅ File validation
 * ✅ Retry mechanism
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { withLogger } from "@/lib/with-logger";

// ✅ Rate limiting map (ในการใช้งานจริงควรใช้ Redis)
const uploadLimits = new Map<string, { count: number; resetAt: number }>();

// ✅ Constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
const MAX_UPLOADS_PER_HOUR = 50; // จำกัด 50 ไฟล์/ชม./user

// ✅ Helper: Check rate limit
function checkRateLimit(userEmail: string): boolean {
  const now = Date.now();
  const userLimit = uploadLimits.get(userEmail);

  // ถ้าหมดเวลา reset limit
  if (!userLimit || now > userLimit.resetAt) {
    uploadLimits.set(userEmail, {
      count: 1,
      resetAt: now + 60 * 60 * 1000, // reset ทุก 1 ชม.
    });
    return true;
  }

  // ถ้ายังไม่เกิน limit
  if (userLimit.count < MAX_UPLOADS_PER_HOUR) {
    userLimit.count++;
    return true;
  }

  return false;
}

// ✅ Helper: Retry upload with exponential backoff
async function uploadWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);

      // ถ้าสำเร็จหรือเป็น client error (4xx) ไม่ต้อง retry
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }

      // Retry สำหรับ server errors (5xx)
      if (i < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, i), 10000); // max 10 sec
        console.log(`⚠️ Upload failed, retrying in ${delay}ms... (${i + 1}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (error) {
      if (i < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, i), 10000);
        console.log(`⚠️ Network error, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }

  throw new Error("Max retries exceeded");
}

// ✅ Helper: Sanitize filename
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, "_") // แทนที่อักขระพิเศษ
    .substring(0, 100); // จำกัดความยาว
}

// ✅ Helper: Find or create a Drive folder under a parent
async function getOrCreateFolder(
  name: string,
  parentId: string,
  accessToken: string
): Promise<string> {
  // Search for existing folder
  const query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=1`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.files?.length > 0) {
      return searchData.files[0].id as string;
    }
  }

  // Create folder if not found
  const createRes = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });

  if (!createRes.ok) {
    throw new Error(`Failed to create folder "${name}": ${createRes.status}`);
  }

  const createData = await createRes.json();
  return createData.id as string;
}

// ✅ Helper: Get or create year/month/day folder structure, return leaf folder ID
async function getDateFolder(
  rootFolderId: string,
  accessToken: string
): Promise<string> {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");

  const yearId = await getOrCreateFolder(year, rootFolderId, accessToken);
  const monthId = await getOrCreateFolder(month, yearId, accessToken);
  const dayId = await getOrCreateFolder(day, monthId, accessToken);

  return dayId;
}

async function _POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);

  try {
    console.log(`📤 [${requestId}] IMAGE UPLOAD API`);

    // ✅ Step 1: Authenticate
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token || !(token as any)?.email) {
      return NextResponse.json(
        { error: "Unauthorized", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    // ✅ Check token refresh error
    if ((token as any).error === "RefreshAccessTokenError") {
      return NextResponse.json(
        {
          error: "Session expired",
          code: "TOKEN_EXPIRED",
          message: "Please sign out and sign in again"
        },
        { status: 401 }
      );
    }

    const accessToken = (token as any)?.accessToken;
    const userEmail = (token as any)?.email as string;

    if (!accessToken) {
      return NextResponse.json(
        { error: "No access token", code: "NO_TOKEN" },
        { status: 401 }
      );
    }

    // ✅ Step 2: Check rate limit
    if (!checkRateLimit(userEmail)) {
      console.warn(`⚠️ [${requestId}] Rate limit exceeded for: ${userEmail}`);
      return NextResponse.json(
        {
          error: "Too many uploads",
          code: "RATE_LIMIT_EXCEEDED",
          message: `Maximum ${MAX_UPLOADS_PER_HOUR} uploads per hour`
        },
        { status: 429 }
      );
    }

    // ✅ Step 3: Validate file
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided", code: "NO_FILE" },
        { status: 400 }
      );
    }

    console.log(`📎 [${requestId}] File:`, file.name, file.type, file.size);

    // ✅ Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: "Invalid file type",
          code: "INVALID_TYPE",
          message: `Allowed types: ${ALLOWED_TYPES.join(", ")}`
        },
        { status: 400 }
      );
    }

    // ✅ Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: "File too large",
          code: "FILE_TOO_LARGE",
          message: `Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`
        },
        { status: 400 }
      );
    }

    // ✅ Validate file size minimum (ป้องกันไฟล์ว่าง)
    if (file.size < 100) {
      return NextResponse.json(
        { error: "File too small", code: "FILE_TOO_SMALL" },
        { status: 400 }
      );
    }

    // ✅ Step 4: Prepare file buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // ✅ Sanitize filename
    const safeName = sanitizeFilename(file.name);
    const timestamp = Date.now();
    const finalName = `${timestamp}_${safeName}`;

    // ✅ Step 5: Resolve upload folder (root → year → month → day)
    const rootFolderId =
      (formData.get("folderId") as string | null) ||
      process.env.UPLOAD_ROOT_FOLDER_ID ||
      null;

    let parentFolderId: string | null = null;
    if (rootFolderId) {
      try {
        console.log(`📁 [${requestId}] Resolving date folder under: ${rootFolderId}`);
        parentFolderId = await getDateFolder(rootFolderId, accessToken);
        console.log(`📁 [${requestId}] Target folder ID: ${parentFolderId}`);
      } catch (err: any) {
        console.warn(`⚠️ [${requestId}] Could not resolve date folder, uploading to root: ${err.message}`);
      }
    }

    // ✅ Step 6: Upload to Google Drive with retry
    const metadata: Record<string, any> = {
      name: finalName,
      mimeType: file.type,
      description: `Uploaded by ${userEmail} at ${new Date().toISOString()}`,
    };

    if (parentFolderId) {
      metadata.parents = [parentFolderId];
    }

    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    form.append("file", new Blob([buffer], { type: file.type }));

    console.log(`⏳ [${requestId}] Uploading to Drive...`);

    const uploadResponse = await uploadWithRetry(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: form,
      }
    );

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error(`❌ [${requestId}] Upload error:`, errorText);

      // ✅ Handle specific errors
      if (uploadResponse.status === 401) {
        return NextResponse.json(
          {
            error: "Session expired",
            code: "TOKEN_EXPIRED",
            message: "Please sign out and sign in again"
          },
          { status: 401 }
        );
      }

      if (uploadResponse.status === 403) {
        return NextResponse.json(
          {
            error: "Permission denied",
            code: "PERMISSION_DENIED",
            message: "Need Google Drive access. Please sign out and sign in again."
          },
          { status: 403 }
        );
      }

      throw new Error(`Upload failed: ${uploadResponse.status}`);
    }

    const uploadResult = await uploadResponse.json();
    const fileId = uploadResult.id;

    console.log(`✅ [${requestId}] Uploaded to Drive:`, fileId);

    // ✅ Step 6: Set public permissions with retry
    console.log(`⏳ [${requestId}] Setting permissions...`);

    const permissionResponse = await uploadWithRetry(
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: "reader",
          type: "anyone",
        }),
      }
    );

    if (!permissionResponse.ok) {
      console.warn(`⚠️ [${requestId}] Failed to set permissions`);
      // ไม่ throw error เพราะไฟล์อัพโหลดสำเร็จแล้ว
    } else {
      console.log(`✅ [${requestId}] File shared publicly`);
    }

    // ✅ Step 7: Generate URLs
    const fileUrl = `https://drive.google.com/file/d/${fileId}/view`;
    const thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w500`;
    const directUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

    const response = {
      success: true,
      fileId,
      fileUrl,
      thumbnailUrl,
      directUrl,
      fileName: finalName,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      uploadedBy: userEmail,
      uploadedAt: new Date().toISOString(),
    };

    console.log(`✅ [${requestId}] Upload complete`);

    return NextResponse.json(response);

  } catch (error: any) {
    console.error(`❌ [${requestId}] Upload Error:`, error);

    return NextResponse.json(
      {
        error: "Upload failed",
        code: "UPLOAD_ERROR",
        message: error.message
      },
      { status: 500 }
    );
  }
}
export const POST = withLogger("/api/upload", _POST);
