/**
 * GET /api/crm/photos/file?clientId=&fileId=&mimeType=
 *
 * - รับ mimeType จาก query param (มาจาก list แล้ว ไม่ต้องดึง metadata อีก)
 * - HEIC/HEIF → แปลงเป็น JPEG server-side พร้อม in-memory cache
 * - JPEG/PNG/etc → stream ตรงๆ (ไม่ load buffer เข้า memory)
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getAdminAccessToken } from "@/lib/admin-drive";

// cache HEIC→JPEG ผลลัพธ์ใน memory (key = fileId, TTL 1 ชั่วโมง)
const _heicCache = new Map<string, { data: Uint8Array; ts: number }>();
const CACHE_TTL  = 60 * 60 * 1000;

function heicCacheGet(fileId: string): Uint8Array | null {
  const entry = _heicCache.get(fileId);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { _heicCache.delete(fileId); return null; }
  return entry.data;
}
function heicCacheSet(fileId: string, data: Uint8Array) {
  // ป้องกัน cache โตไม่หยุด — เก็บไว้สูงสุด 200 รูป
  if (_heicCache.size >= 200) {
    const oldest = [..._heicCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) _heicCache.delete(oldest[0]);
  }
  _heicCache.set(fileId, { data, ts: Date.now() });
}

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp       = request.nextUrl.searchParams;
  const clientId = sp.get("clientId") || "";
  const fileId   = sp.get("fileId")   || "";
  const mimeType = sp.get("mimeType") || "image/jpeg";

  if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
  if (!fileId)   return NextResponse.json({ error: "Missing fileId" }, { status: 400 });

  const isHeic = mimeType === "image/heic" || mimeType === "image/heif"
    || mimeType === "image/heic-sequence" || mimeType === "image/heif-sequence";

  try {
    // HEIC: เช็ค cache ก่อน — ถ้ามีส่งทันทีไม่ต้องไป Drive
    if (isHeic) {
      const cached = heicCacheGet(fileId);
      if (cached) {
        return new NextResponse(cached.buffer as ArrayBuffer, {
          status: 200,
          headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" },
        });
      }
    }

    const accessToken = await getAdminAccessToken(clientId);

    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!driveRes.ok) {
      const err = await driveRes.text();
      throw new Error(`Drive fetch failed (${driveRes.status}): ${err}`);
    }

    // HEIC → แปลงเป็น JPEG แล้ว cache
    if (isHeic) {
      const heicConvert = (await import("heic-convert")).default;
      const inputBuffer = Buffer.from(await driveRes.arrayBuffer());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jpegOutput  = await (heicConvert as any)({ buffer: inputBuffer, format: "JPEG", quality: 0.85 });
      const jpeg        = new Uint8Array(jpegOutput);
      heicCacheSet(fileId, jpeg);
      return new NextResponse(jpeg.buffer as ArrayBuffer, {
        status: 200,
        headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" },
      });
    }

    // JPEG/PNG/อื่นๆ → stream ตรงๆ
    const contentType = driveRes.headers.get("content-type") || mimeType;
    return new NextResponse(driveRes.body, {
      status: 200,
      headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=3600" },
    });

  } catch (err: any) {
    console.error("❌ crm/photos/file GET:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
