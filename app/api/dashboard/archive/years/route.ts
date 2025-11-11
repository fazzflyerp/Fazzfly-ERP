import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  console.log("✅ Years API Called!");
  
  const { searchParams } = new URL(request.url);
  const archiveFolderId = searchParams.get("archiveFolderId");
  const moduleName = searchParams.get("moduleName");
  
  console.log("Params:", { archiveFolderId, moduleName });
  
  if (!archiveFolderId) {
    return NextResponse.json({ error: "Missing archiveFolderId" }, { status: 400 });
  }
  
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const accessToken = token.accessToken as string;
  
  try {
    // Fetch from Google Drive
    const driveUrl = `https://www.googleapis.com/drive/v3/files?q='${archiveFolderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType)`;
    
    const driveResponse = await fetch(driveUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!driveResponse.ok) {
      throw new Error(`Drive API failed: ${driveResponse.status}`);
    }

    const driveData = await driveResponse.json();
    const files = driveData.files || [];
    
    const years: any[] = [];
    const yearPattern = /Archive[_\s]+(\d{4})/i;
    
    files.forEach((file: any) => {
      if (file.mimeType !== "application/vnd.google-apps.spreadsheet") return;
      
      const match = file.name.match(yearPattern);
      if (match) {
        const year = match[1];
        years.push({
          year,
          spreadsheetId: file.id,
          fileName: file.name,
        });
      }
    });
    
    years.sort((a, b) => parseInt(b.year) - parseInt(a.year));
    
    return NextResponse.json({ years });
  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}