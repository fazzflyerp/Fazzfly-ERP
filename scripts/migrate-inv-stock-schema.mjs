/**
 * migrate-inv-stock-schema.mjs
 *
 * เพิ่มหัวคอลัมน์ใหม่ให้ INV_Stock ของทุกสาขา:
 *   O = parent_stock_id   (อ้างอิง lot ต้นทางเมื่อเปิด)
 *   P = is_opened         (true / false)
 *   Q = opened_at         (วันที่เปิด)
 *
 * รัน:
 *   node scripts/migrate-inv-stock-schema.mjs <sheet_id_1> <sheet_id_2> ...
 *
 * ตัวอย่าง:
 *   node scripts/migrate-inv-stock-schema.mjs 1BxYZ... 1CdAB...
 *
 * ข้อมูลเดิม (A:N) จะไม่ถูกแก้ไข — เพิ่มแค่หัวคอลัมน์ที่ยังว่างอยู่
 */

import { google } from "googleapis";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// โหลด .env.local
const envPath = resolve(__dirname, "../.env.local");
try {
  const envFile = readFileSync(envPath, "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq  = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch { console.warn("⚠️  ไม่พบ .env.local — ใช้ environment variables ที่ set ไว้แล้ว"); }

function getAuth() {
  const email  = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let   rawKey = process.env.GOOGLE_PRIVATE_KEY || "";
  rawKey = rawKey.replace(/^["']|["']$/g, "").replace(/\\n/g, "\n");
  if (!email || !rawKey.includes("BEGIN PRIVATE KEY"))
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY");
  return new google.auth.JWT({
    email, key: rawKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

async function migrateSheet(sheets, spreadsheetId) {
  console.log(`\n📋  Sheet: ${spreadsheetId}`);

  // ── 1. ตรวจสอบว่ามี INV_Stock หรือยัง ─────────────────────────────────────
  let headerRow;
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "INV_Stock!A1:Q1",
    });
    headerRow = (res.data.values || [[]])[0] || [];
  } catch (err) {
    const msg = String(err?.message ?? err);
    if (msg.includes("Unable to parse range") || msg.includes("notFound")) {
      console.log("   ⚠️  ไม่พบ INV_Stock — ข้าม");
      return;
    }
    throw err;
  }

  // ── 2. ตรวจสอบว่าเพิ่ม header แล้วหรือยัง ──────────────────────────────────
  // Column O = index 14
  const alreadyMigrated = headerRow[14] === "parent_stock_id";
  if (alreadyMigrated) {
    console.log("   ✅  มี parent_stock_id แล้ว — ข้าม");
    return;
  }

  // ── 3. อัปเดตหัวคอลัมน์ O:Q ─────────────────────────────────────────────
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "INV_Stock!O1:Q1",
    valueInputOption: "RAW",
    requestBody: { values: [["parent_stock_id", "is_opened", "opened_at"]] },
  });

  console.log("   ✅  เพิ่ม parent_stock_id | is_opened | opened_at สำเร็จ");
}

async function main() {
  const sheetIds = process.argv.slice(2);
  if (sheetIds.length === 0) {
    console.error("❌  ต้องระบุ sheet ID อย่างน้อย 1 ตัว");
    console.error("    ใช้: node scripts/migrate-inv-stock-schema.mjs <sheet_id_1> [sheet_id_2] ...");
    process.exit(1);
  }

  const auth   = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  console.log(`\n🚀  เริ่ม migrate ${sheetIds.length} สเปรดชีท...`);

  let success = 0;
  let failed  = 0;
  for (const sid of sheetIds) {
    try {
      await migrateSheet(sheets, sid);
      success++;
    } catch (err) {
      console.error(`   ❌  Error: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n✨  เสร็จ: ${success} สำเร็จ, ${failed} ล้มเหลว\n`);
}

main().catch((err) => { console.error(err); process.exit(1); });
