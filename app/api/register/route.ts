/**
 * POST /api/register
 * บันทึกข้อมูลคนขอทดลองใช้ Demo → client_Reg sheet ใน MASTER_SHEET_ID
 * — Auto-create sheet + headers ถ้ายังไม่มี
 * — สร้าง Calendar event ถ้ามีวันนัด
 */

import { NextRequest, NextResponse } from "next/server";
import { getSheetsClient } from "@/lib/google-sa";

const MASTER_SHEET_ID = process.env.MASTER_SHEET_ID!;
const REG_SHEET       = "client_Reg";

const HEADERS = [
  "submitted_at",
  "name",
  "business",
  "phone",
  "line_id",
  "business_type",
  "systems",
  "demo_date",
  "demo_time",
  "status",
];

async function ensureRegSheet(): Promise<void> {
  const sheets = getSheetsClient();

  // ตรวจว่า sheet มีอยู่แล้วมั้ย
  const meta = await sheets.spreadsheets.get({ spreadsheetId: MASTER_SHEET_ID });
  const exists = (meta.data.sheets || []).some((s) => s.properties?.title === REG_SHEET);

  if (!exists) {
    // สร้าง sheet ใหม่
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: MASTER_SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: REG_SHEET } } }] },
    });
  }

  // ตรวจว่า header row มีอยู่แล้วมั้ย
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: MASTER_SHEET_ID,
    range: `${REG_SHEET}!A1:Z1`,
  });
  const firstRow = (headerRes.data.values?.[0] ?? []).filter(Boolean);

  if (firstRow.length === 0) {
    // เขียน headers
    await sheets.spreadsheets.values.update({
      spreadsheetId: MASTER_SHEET_ID,
      range: `${REG_SHEET}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADERS] },
    });
  }
}

async function appendRegRow(row: any[]): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: MASTER_SHEET_ID,
    range: `${REG_SHEET}!A:Z`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}

async function createCalendarEvent(params: {
  name: string; business: string; phone: string;
  lineId: string; businessType: string; systems: string[];
  date: string; time: string;
}): Promise<void> {
  const { name, business, phone, lineId, businessType, systems, date, time } = params;

  // ใช้ service account token เดียวกัน (calendar ต้อง share กับ SA ก่อน)
  const { createPrivateKey, createSign } = await import("crypto");
  const email  = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n");

  const now    = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: email,
    scope: "https://www.googleapis.com/auth/calendar",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  })).toString("base64url");
  const unsigned   = `${header}.${payload}`;
  const privateKey = createPrivateKey({ key: rawKey, format: "pem" });
  const signer     = createSign("RSA-SHA256");
  signer.update(unsigned);
  const sig   = signer.sign(privateKey).toString("base64url");
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${sig}`,
    }),
  });
  const { access_token } = await tokenRes.json();
  if (!access_token) return;

  const startDT = new Date(`${date}T${time}:00+07:00`);
  const endDT   = new Date(startDT.getTime() + 60 * 60 * 1000);

  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent("fazzflyerp@gmail.com")}/events`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: `Demo: ${name} — ${business || ""}`,
        description: [
          `ชื่อ: ${name}`, `ธุรกิจ: ${business}`, `เบอร์: ${phone}`,
          `Line: ${lineId}`, `ประเภท: ${businessType}`,
          `ระบบที่สนใจ: ${systems.join(", ")}`,
        ].join("\n"),
        start: { dateTime: startDT.toISOString(), timeZone: "Asia/Bangkok" },
        end:   { dateTime: endDT.toISOString(),   timeZone: "Asia/Bangkok" },
      }),
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, business, phone, lineId, businessType, systems, date, time } = body;

    if (!name || !phone)
      return NextResponse.json({ error: "กรุณากรอกชื่อและเบอร์โทร" }, { status: 400 });

    const submittedAt = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });

    // สร้าง sheet + headers ถ้ายังไม่มี
    await ensureRegSheet();

    // บันทึกข้อมูล
    await appendRegRow([
      submittedAt,
      name,
      business     || "",
      phone,
      lineId       || "",
      businessType || "",
      Array.isArray(systems) ? systems.join(", ") : (systems || ""),
      date  || "",
      time  || "",
      "new",
    ]);

    // สร้าง Calendar event (non-blocking)
    if (date && time) {
      createCalendarEvent({ name, business, phone, lineId, businessType, systems: systems || [], date, time })
        .catch((e) => console.error("[register] calendar error (non-fatal):", e.message));
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[register] ERROR:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
