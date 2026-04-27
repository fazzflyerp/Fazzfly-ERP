/**
 * GET /api/crm/photos/file?clientId=&fileId=
 *
 * Proxy ดึงรูปจาก Google Drive ด้วย Admin token
 * - HEIC/HEIF → แปลงเป็น JPEG server-side (heic-convert) แล้วส่งกลับ
 * - JPEG/PNG/etc → stream ตรงๆ (ไม่ load buffer เข้า memory)
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getAdminAccessToken } from "@/lib/admin-drive";

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp       = request.nextUrl.searchParams;
  const clientId = sp.get("clientId") || "";
  const fileId   = sp.get("fileId")   || "";

  if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
  if (!fileId)   return NextResponse.json({ error: "Missing fileId" }, { status: 400 });

  try {
    const accessToken = await getAdminAccessToken(clientId);

    // 1. ดึง metadata เพื่อรู้ mimeType
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const meta     = metaRes.ok ? await metaRes.json() : {};
    const mimeType = (meta.mimeType as string) || "image/jpeg";

    // 2. ดาวน์โหลดไฟล์จาก Drive
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!driveRes.ok) {
      const err = await driveRes.text();
      throw new Error(`Drive fetch failed (${driveRes.status}): ${err}`);
    }

    // 3. HEIC/HEIF → แปลงเป็น JPEG ก่อนส่ง (browser ส่วนใหญ่แสดง HEIC ไม่ได้)
    const isHeic = mimeType === "image/heic" || mimeType === "image/heif"
      || mimeType === "image/heic-sequence" || mimeType === "image/heif-sequence";

    if (isHeic) {
      const heicConvert = (await import("heic-convert")).default;
      const inputBuffer = Buffer.from(await driveRes.arrayBuffer());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jpegOutput  = await (heicConvert as any)({
        buffer:  inputBuffer,
        format:  "JPEG",
        quality: 0.85,
      });
      return new NextResponse(new Uint8Array(jpegOutput), {
        status: 200,
        headers: {
          "Content-Type":  "image/jpeg",
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    // 4. ไฟล์ปกติ (JPEG, PNG, WEBP ฯลฯ) → stream ตรงๆ ไม่ load buffer
    const contentType = driveRes.headers.get("content-type") || mimeType;
    return new NextResponse(driveRes.body, {
      status: 200,
      headers: {
        "Content-Type":  contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });

  } catch (err: any) {
    console.error("❌ crm/photos/file GET:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
