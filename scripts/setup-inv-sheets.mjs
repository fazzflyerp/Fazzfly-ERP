/**
 * setup-inv-sheets.mjs
 *
 * One-time script สร้าง Google Spreadsheets สำหรับระบบ INV
 *
 * สร้าง:
 *   1. Central INV Spreadsheet  → INV_Lots, INV_Purchase, INV_Request, INV_Transfer, INV_Notification
 *   2. Branch INV Spreadsheet   → INV_Stock, INV_Usage
 *      (รันซ้ำสำหรับแต่ละสาขา โดยเปลี่ยน BRANCH_NAME)
 *
 * วิธีรัน:
 *   node scripts/setup-inv-sheets.mjs central
 *   node scripts/setup-inv-sheets.mjs branch "สาขาถนนจันทร์"
 *   node scripts/setup-inv-sheets.mjs branch "สาขาสีลม"
 *
 * Output: Spreadsheet ID → เอาไปลงใน client_modules
 */

import { google } from "googleapis";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// โหลด .env.local ด้วยตัวเอง (ไม่ใช้ dotenv)
const envPath = resolve(__dirname, "../.env.local");
try {
  const envFile = readFileSync(envPath, "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch { console.warn("⚠️  ไม่พบ .env.local — ใช้ environment variables ที่ set ไว้แล้ว"); }

// ── Auth ──────────────────────────────────────────────────────────────────────
function getAuth() {
  const email  = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let   rawKey = process.env.GOOGLE_PRIVATE_KEY || "";
  rawKey = rawKey.replace(/^["']|["']$/g, "").replace(/\\n/g, "\n");
  if (!email || !rawKey.includes("BEGIN PRIVATE KEY"))
    throw new Error("Missing or invalid GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY");
  return new google.auth.JWT({
    email, key: rawKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getSheets(auth) { return google.sheets({ version: "v4", auth }); }

// ── Sheet definitions ─────────────────────────────────────────────────────────

const CENTRAL_SHEETS = [
  {
    name: "INV_Lots",
    headers: [
      "lot_id",         // LOT-YYYYMMDD-XXX
      "product_id",     // row index จาก Product sheet (1-based)
      "product_name",
      "category",
      "brand",
      "unit",           // หน่วยย่อย เช่น Shots, CC, Units
      "unit_pkg",       // หน่วยบรรจุ เช่น หัว, หลอด, กระปุก
      "qty_per_pkg",    // จำนวนต่อหน่วยบรรจุ
      "qty_original",   // จำนวน (unit) เมื่อ purchase
      "qty_remaining",  // จำนวนคงเหลือในคลังกลาง
      "expiry_date",    // YYYY-MM-DD
      "purchase_date",
      "purchase_id",    // ref → INV_Purchase
      "supplier",
      "created_at",
    ],
  },
  {
    name: "INV_Purchase",
    headers: [
      "purchase_id",    // PO-YYYYMMDD-XXX
      "product_id",
      "product_name",
      "category",
      "brand",
      "unit",
      "unit_pkg",
      "qty_per_pkg",
      "qty_ordered",    // จำนวน pkg ที่สั่ง
      "qty_unit",       // qty_ordered × qty_per_pkg
      "cost_per_pkg",   // ราคาทุนต่อ pkg
      "cost_total",
      "supplier",
      "purchase_date",
      "expiry_date",
      "lot_id",         // ← สร้างพร้อมกัน
      "status",         // ordered / received
      "note",
      "created_by",
      "created_at",
    ],
  },
  {
    name: "INV_Request",
    headers: [
      "request_id",     // REQ-YYYYMMDD-XXX
      "branch_id",
      "branch_name",
      "product_id",
      "product_name",
      "unit",
      "qty_requested",
      "qty_approved",   // ← กรอกตอน approve (partial ok)
      "lot_id",         // ← เลือกตอน approve
      "expiry_date",    // ← ดึงจาก lot ตอน approve
      "status",         // PENDING / APPROVED / REJECTED
      "note",
      "requested_by",
      "requested_at",
      "reviewed_by",
      "reviewed_at",
    ],
  },
  {
    name: "INV_Transfer",
    headers: [
      "transfer_id",    // TRF-YYYYMMDD-XXX
      "request_id",
      "branch_id",
      "branch_name",
      "product_id",
      "product_name",
      "unit",
      "lot_id",
      "expiry_date",
      "qty",
      "transferred_by",
      "transferred_at",
    ],
  },
  {
    name: "INV_Notification",
    headers: [
      "notif_id",
      "target_email",
      "branch_id",
      "type",           // new_request / request_approved / request_rejected / expiry_warning
      "message",
      "ref_id",         // request_id หรือ stock_id
      "is_read",        // FALSE / TRUE
      "created_at",
    ],
  },
];

const BRANCH_SHEETS = [
  {
    name: "INV_Stock",
    headers: [
      "stock_id",       // STK-YYYYMMDD-XXX
      "product_id",
      "product_name",
      "category",
      "brand",
      "unit",
      "unit_pkg",
      "lot_id",         // ← ติดตามมาจาก central
      "qty_received",
      "qty_remaining",
      "expiry_date",    // ← ติดตามมาจาก lot
      "transfer_id",
      "received_at",
    ],
  },
  {
    name: "INV_Usage",
    headers: [
      "usage_id",       // USE-YYYYMMDD-XXX
      "product_id",
      "product_name",
      "category",
      "unit",
      "lot_id",         // ← FIFO เลือกอัตโนมัติ
      "expiry_date",
      "qty_used",
      "doctor",         // ← ชื่อแพทย์
      "note",
      "used_by",        // พนักงานที่บันทึก
      "used_at",
    ],
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const mode          = process.argv[2]; // "central" | "branch"
  const spreadsheetId = process.argv[3];
  const label         = process.argv[4] || "สาขา";

  if (!mode || !spreadsheetId || !["central", "branch"].includes(mode)) {
    console.log("Usage:");
    console.log("  node scripts/setup-inv-sheets.mjs central <spreadsheetId>");
    console.log('  node scripts/setup-inv-sheets.mjs branch  <spreadsheetId> "ชื่อสาขา"');
    console.log("");
    console.log("วิธี:");
    console.log("  1. ไปที่ drive.google.com → สร้าง Google Sheet ใหม่เปล่าๆ");
    console.log(`  2. Share ให้ SA: ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "SA email"} (Editor)`);
    console.log("  3. เอา ID จาก URL → /spreadsheets/d/<ID>/edit");
    console.log("  4. รัน script นี้พร้อม ID");
    process.exit(1);
  }

  const auth   = getAuth();
  const sheets = getSheets(auth);
  const defs   = mode === "central" ? CENTRAL_SHEETS : BRANCH_SHEETS;
  const tag    = mode === "central" ? "🏭 Central INV" : `🏪 Branch INV "${label}"`;

  console.log(`\n${tag} — กำลัง setup sheets...`);

  // อ่าน existing sheet titles
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTitles = new Set(meta.data.sheets.map(s => s.properties.title));

  for (const s of defs) {
    if (!existingTitles.has(s.name)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: s.name } } }] },
      });
      console.log(`   ➕ สร้าง sheet: ${s.name}`);
    } else {
      console.log(`   ✓  มีอยู่แล้ว: ${s.name}`);
    }
    // เขียน headers
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${s.name}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [s.headers] },
    });
    console.log(`   📋 ${s.name} — ${s.headers.length} columns`);
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`✅ ${tag} พร้อมใช้งาน`);
  console.log(`   Spreadsheet ID: ${spreadsheetId}`);
  if (mode === "central") {
    console.log("   → ลงใน client_modules: SUPER_ADMIN → module INV_CENTRAL");
  } else {
    console.log(`   → ลงใน client_modules: สาขา "${label}" → module INV_BRANCH`);
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((e) => { console.error("❌", e.message, e.response?.data || ""); process.exit(1); });
