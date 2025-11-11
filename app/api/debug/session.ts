import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth-options";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    const debugInfo = {
      hasSession: !!session,
      userEmail: session?.user?.email,
      userName: session?.user?.name,
      hasAccessToken: !!(session as any)?.accessToken,
      accessToken: (session as any)?.accessToken ? "***present***" : "❌ MISSING",
      hasRefreshToken: !!(session as any)?.refreshToken,
      expiresAt: (session as any)?.expiresAt,
      sessionKeys: Object.keys(session || {}),
    };

    console.log("🔍 Debug Info:", debugInfo);

    return NextResponse.json(debugInfo, { status: 200 });
  } catch (error: any) {
    console.error("❌ Debug error:", error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}