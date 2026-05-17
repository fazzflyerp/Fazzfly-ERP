import { NextResponse } from "next/server";
import { google } from "googleapis";

const SPREADSHEET_ID = "1LGXYFxq-rRDVTBB9KykypPD1POiUIhSrc9ehvbY4a7w";

export async function GET() {
  try {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!email || !key) {
      return NextResponse.json({ error: "Missing env: GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY" }, { status: 500 });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: email, private_key: key },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // ดึงชื่อ sheet ทั้งหมด
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheetNames = meta.data.sheets?.map((s) => s.properties?.title);

    return NextResponse.json({ ok: true, sheets: sheetNames });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
