/**
 * Upload Image to Google Drive API
 * POST /api/upload
 * Body: FormData with file
 * Returns: { success, fileId, fileUrl, thumbnailUrl, directUrl }
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function POST(request: NextRequest) {
  try {
    console.log("📤 IMAGE UPLOAD API");

    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessToken = (token as any)?.accessToken;
    if (!accessToken) {
      return NextResponse.json({ error: "No access token" }, { status: 401 });
    }

    // รับไฟล์จาก FormData
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    console.log("📎 File:", file.name, file.type, file.size);

    // ตรวจสอบว่าเป็นไฟล์รูปภาพ
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files allowed" }, { status: 400 });
    }

    // จำกัดขนาดไฟล์ 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
    }

    // อ่านไฟล์เป็น buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 1️⃣ Upload ไฟล์ไป Google Drive
    const metadata = {
      name: `${Date.now()}_${file.name}`,
      mimeType: file.type,
    };

    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    form.append("file", new Blob([buffer], { type: file.type }));

    const uploadResponse = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
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
      console.error("Upload error:", errorText);
      throw new Error(`Upload failed: ${uploadResponse.status}`);
    }

    const uploadResult = await uploadResponse.json();
    const fileId = uploadResult.id;

    console.log("✅ Uploaded to Drive:", fileId);

    // 2️⃣ แชร์ไฟล์เป็น public
    const permissionResponse = await fetch(
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
      console.warn("⚠️ Failed to set permissions, but file uploaded");
    } else {
      console.log("✅ File shared publicly");
    }

    // 3️⃣ สร้าง URL
    const fileUrl = `https://drive.google.com/file/d/${fileId}/view`;
    const thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w500`;
    const directUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

    return NextResponse.json({
      success: true,
      fileId,
      fileUrl,
      thumbnailUrl,
      directUrl,
      fileName: file.name,
    });
  } catch (error: any) {
    console.error("❌ Upload Error:", error);
    return NextResponse.json(
      { error: "Upload failed", message: error.message },
      { status: 500 }
    );
  }
}