/**
 * GET /api/crm/photos/file?clientId=&fileId=
 *
 * Proxy ดึงรูปจาก Google Drive ด้วย Admin token
 * (Browser ไม่สามารถเรียก Drive API โดยตรงได้ — ต้องผ่าน server)
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

    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!driveRes.ok) {
      const err = await driveRes.text();
      throw new Error(`Drive fetch failed (${driveRes.status}): ${err}`);
    }

    const contentType = driveRes.headers.get("content-type") || "image/jpeg";
    const buffer      = await driveRes.arrayBuffer();

    return new NextResponse(new Uint8Array(buffer), {
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
