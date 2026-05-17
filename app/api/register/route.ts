import { NextRequest, NextResponse } from "next/server";
import { createPrivateKey, createSign } from "crypto";

const SPREADSHEET_ID = "1LGXYFxq-rRDVTBB9KykypPD1POiUIhSrc9ehvbY4a7w";
const CALENDAR_ID = "fazzflyerp@gmail.com";

async function getAccessToken(scopes: string[]): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: email,
    scope: scopes.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })).toString("base64url");

  const unsigned = `${header}.${payload}`;
  const privateKey = createPrivateKey({ key: rawKey, format: "pem" });
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = signer.sign(privateKey).toString("base64url");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  const data = await res.json() as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error(`OAuth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, business, phone, lineId, businessType, systems, date, time } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: "กรุณากรอกชื่อและเบอร์โทร" }, { status: 400 });
    }

    const token = await getAccessToken([
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/calendar",
    ]);

    const submittedAt = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });

    // บันทึกลง Google Sheets
    const sheetsRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Sheet1!A:I:append?valueInputOption=USER_ENTERED`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          values: [[
            submittedAt, name, business, phone, lineId,
            businessType, systems?.join(", "), date || "", time || "",
          ]],
        }),
      }
    );
    if (!sheetsRes.ok) {
      const errText = await sheetsRes.text();
      throw new Error(`Sheets API error: ${errText}`);
    }

    // สร้าง Calendar event (ถ้ามี date + time)
    if (date && time) {
      const startDateTime = new Date(`${date}T${time}:00+07:00`);
      const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

      const calRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            summary: `Demo: ${name} — ${business || ""}`,
            description: [
              `ชื่อ: ${name}`, `ธุรกิจ: ${business}`, `เบอร์: ${phone}`,
              `Line: ${lineId}`, `ประเภท: ${businessType}`,
              `ระบบที่สนใจ: ${systems?.join(", ")}`,
            ].join("\n"),
            start: { dateTime: startDateTime.toISOString(), timeZone: "Asia/Bangkok" },
            end: { dateTime: endDateTime.toISOString(), timeZone: "Asia/Bangkok" },
          }),
        }
      );
      if (!calRes.ok) {
        const errText = await calRes.text();
        console.error("[register] Calendar error (non-fatal):", errText);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : "";
    console.error("[register] ERROR:", msg);
    console.error("[register] STACK:", stack);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
