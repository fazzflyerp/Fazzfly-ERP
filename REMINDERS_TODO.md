# REMINDERS & BUG NOTES

บันทึกบั๊คที่ Test เองไม่เจอ แต่ลูกค้าเจอ — ห้ามลืมก่อน release ทุกครั้ง

---

## ✅ แก้แล้ว — OAuth Token Expiry → 401 (Demo Master Data)

**อาการ**: ลูกค้าเปิด Master Data → 401 Unauthorized
**สาเหตุ**: `config-demo`, `data-demo`, `update-demo` ใช้ OAuth `accessToken` ของ user
- Developer test ไม่เจอเพราะ token เพิ่ง refresh หลัง login
- ลูกค้า session เก่ากว่า / token refresh ล้มเหลว → 401 ทันที
**แก้**: เปลี่ยนเป็น Service Account (SA) ทั้ง 3 routes (2026-05-24)
**เงื่อนไข**: Spreadsheet ต้องถูก share ให้ SA email ด้วย (เหมือน payroll/finance)

---

## ⚠️ ยังใช้ OAuth — เสี่ยง Token Expiry เหมือนกัน

APIs ต่อไปนี้ยังใช้ OAuth `accessToken` โดยตรง — อาจเจอปัญหาเดิมถ้า session เก่า:

| Route | ใช้ใน |
|-------|--------|
| `app/api/master/data/route.ts` | Production Master Data Edit |
| `app/api/master/update/route.ts` | Production Master Data Edit |
| `app/api/master/submit/route.ts` | Production Master Data Form |
| `app/api/payroll/config/route.ts` | Production Payroll |
| `app/api/payroll/company-info/route.ts` | Production Payroll Slip |
| `app/api/payroll/transactions/route.ts` | Production Payroll |
| `app/api/dashboard/data/route.ts` | Production Dashboard |
| `app/api/dashboard/module-config/route.ts` | Production Dashboard |

**แนวทางแก้**: migrate ทีละ route ไปใช้ SA + ตรวจสอบว่า client sheet share SA แล้ว
**ลำดับความสำคัญ**: master/data, master/update, master/submit ก่อน (ใช้บ่อย)

---

## ⚠️ Build Cache Stale หลัง git mv

**อาการ**: หลังย้าย folder ด้วย `git mv` → Next.js dev server ยังโหลด compiled route เก่าจาก `.next/dev/`
**สาเหตุ**: Dev server hot-reload ได้แค่ไฟล์ที่แก้ ไม่ได้ clean up ไฟล์ที่ลบ/ย้าย
**วิธีแก้**: Restart dev server ทุกครั้งที่ย้าย/ลบ route files

---

## ✅ Finance Detail — Revenue Column Indices (ยืนยันแล้ว 2026-05-24)

**HelperS column mapping (0-based)**:
- A=0 วันที่, F=5 ชื่อลูกค้า, I=8 โปรแกรม, L=11 จำนวนที่ใช้
- V=21 พยาบาล, W=22 ผู้ดูแล/แพทย์ (คอลัมน์เดียว)
- AE=30 ยอดเงิน, AH=33 พนักงานขาย
- AD=29 Period (งวดเดือน), AG=32 ชื่อสาขา (Branch Name)
- Range อ่าน: `HelperS!A:AJ`
**ต้องระวัง**: ถ้ามีการเพิ่ม/ย้าย column ใน HelperS → ต้องอัปเดต `REVENUE_COLS` ใน `app/api/finance/detail/route.ts`

---

---

## 🔜 INV Branch Stock — Feature ที่ยังไม่ได้ทำ (Todo)

> ออกแบบ Architecture ไว้ครบแล้ว — รอ implement

---

### ✅ ทำเสร็จแล้ว Session ล่าสุด

| Feature | Files |
|---------|-------|
| ยาหาย | `app/api/inv/lost/route.ts` |
| ส่งยาข้ามสาขา | `app/api/inv/transfer-branch/route.ts` |
| ส่งคืนคลังกลาง | `app/api/inv/return-central/route.ts` (+ recordStockLedger) |
| ประวัติกิจกรรม (unified history + filter) | `app/api/inv/branch-log/route.ts` |
| ยาหมดอายุ auto-sweep | `app/api/inv/expire-sweep/route.ts` |
| มูลค่าสต๊อค (summary card + คอลัมน์) | `app/ERP/inv/branch-stock/page.tsx` |

> ⚠️ ยังไม่ได้ push: `app/api/inv/po/route.ts`, `lib/inv-stock-ledger.ts`, `app/ERP/finance/page.tsx`

---

### Phase 1 — INV_DispenseConfig ⭐⭐ (ง่าย-กลาง)

**ปัญหา:** สาขาตัดสต๊อกเป็นหน่วยใหญ่ดื้อๆ (1 กระปุก) แทนที่จะตัดเป็นหน่วยย่อย (50 Units)

**เป้าหมาย:** SA เซตว่า product ไหน 1 หน่วยใหญ่ = กี่หน่วยเล็ก + อายุยาหลังเปิด

**Sheet ใหม่:** `INV_DispenseConfig` ใน central spreadsheet
```
product_id | product_name | dispense_unit | units_per_stock | open_expiry_days | notes
─────────────────────────────────────────────────────────────────────────────────────
BOT-001    | Botox Nabota | Units         | 200             | 14    ← หมดใน 14 วันหลังเปิด
HIFU-001   | HIFU Head    | shots         | 1000            | null  ← ใช้ expiry ตามกล่อง
VIT-001    | Vit-C 7.5g   | AMP           | 1               | null
```
- `open_expiry_days = null` → ใช้ expiry date ตามกล่องเดิม
- `open_expiry_days = 14` → expiry ใหม่ = min(original_expiry, opened_at + 14 วัน)

**API ใหม่:** `GET/POST/PATCH/DELETE /api/inv/dispense-config`
**UI ใหม่:** Settings modal ใน branch-stock page (SA only, ⚙️ icon)

---

### Phase 2 — IV Protocol Manager ⭐⭐ (ง่าย-กลาง)

**ปัญหา:** IV formula ตัดยาหลายตัวพร้อมกัน — ตอนนี้ต้องใส่ manual ทีละตัว

**เป้าหมาย:** SA สร้างสูตร → staff เลือกสูตร → form pre-fill + ตัดทุก ingredient พร้อมกัน

**Sheet ใหม่:** `INV_Protocols` ใน central spreadsheet (หลาย row ต่อ 1 protocol)
```
protocol_id | protocol_name | product_id | product_name | qty | unit | sort | active
───────────────────────────────────────────────────────────────────────────────────────
PTC-001     | สูตรขาวใส     | VIT-001    | Vit-C 7.5g   | 3   | AMP  | 1    | yes
PTC-001     | สูตรขาวใส     | VIT-002    | Gluta 600mg  | 2   | AMP  | 2    | yes
PTC-001     | สูตรขาวใส     | VIT-003    | B-Complex    | 1   | AMP  | 3    | yes
```

**API ใหม่:** `GET/POST/PATCH/DELETE /api/inv/protocols`
**UI ใหม่:** Protocol Manager modal (SA only) — สร้าง/แก้ protocol + ingredient list

---

### Phase 3 — INV_Stock Schema: Opened Lot Columns ⭐ (ง่าย)

**เพิ่ม 3 columns ใน INV_Stock (branch sheet):**
```
เดิม:  A-N (14 cols)
ใหม่:  + O=parent_stock_id  + P=is_opened  + Q=opened_at
```
- `parent_stock_id` → อ้างอิง lot ต้นทางเมื่อเปิด
- `is_opened` → true/false
- `opened_at` → วันที่เปิด

**UI:** Badge "เปิดแล้ว" สีส้มในตาราง, expiry นับจากวันเปิด (ถ้ามี open_expiry_days)

---

### Phase 4 — Lot Splitting Logic ⭐⭐⭐⭐ (ยากที่สุด)

**ปัญหา:** ตอนเปิดกระปุก Botox ต้อง split lot ใหม่อัตโนมัติ

**ตัวอย่าง:**
```
ก่อน: STK-001 | Botox | 5 กระปุก | is_opened=false
ใช้ 50 Units
หลัง:
  STK-001   | Botox | 4 กระปุก       | is_opened=false  ← ลดลง 1
  STK-001x  | Botox | 150 Units      | is_opened=true   ← สร้างใหม่
             | parent_stock_id=STK-001 | opened_at=วันนี้
             | expiry = min(original, วันนี้+14)
```

**Logic ใน record-usage API (conversion mode):**
```
1. หา opened lot ที่ยังเหลืออยู่ก่อน (FIFO by expiry)
   → ถ้ามีพอ: ตัดจาก opened lot โดยตรง ✓

2. ถ้าไม่มี opened lot / ไม่พอ:
   → หา unopened lot (FIFO)
   → ตัด 1 จาก qty_remaining ของ lot นั้น
   → สร้าง row ใหม่ใน INV_Stock (opened lot)
       qty_remaining = units_per_stock - ที่ใช้ไป
       unit          = dispense_unit
       expiry        = min(original_expiry, today + open_expiry_days)
       parent_stock_id = parent lot
       is_opened     = true
```

**ต้องแก้:** `app/api/inv/record-usage/route.ts` — จุกจิกมากที่สุด

---

### Phase 5 — Usage Modal 3 Modes ⭐⭐⭐ (กลาง-ยาก)

**เดิม:** 1 mode (Direct) เลือกสินค้า + กรอก qty หน่วยใหญ่

**ใหม่:**
```
[ทั่วไป] [หน่วยย่อย] [สูตร IV]

── ทั่วไป (เดิม) ──────────────────────────────────────
เลือกสินค้า + จำนวน (stock unit เดิม)

── หน่วยย่อย (Botox/HIFU) ────────────────────────────
เลือกสินค้า → แสดง "1 กระปุก = 200 Units" อัตโนมัติ
กรอก: [150] Units
ระบบคำนวณและแสดง: จะตัด 0.75 กระปุก

── สูตร IV ────────────────────────────────────────────
เลือก Protocol: [สูตรขาวใส ▼]
✓ Vit-C 7.5g    [3] AMP  ← แก้ได้
✓ Gluta 600mg   [2] AMP
✓ B-Complex     [1] AMP
→ Submit → สร้าง 3 usage records แยก lot FIFO
```

---

### สรุป Difficulty

| Phase | งาน | ยาก |
|-------|-----|-----|
| 1 | DispenseConfig CRUD + Settings UI | ⭐⭐ |
| 2 | Protocol Manager CRUD + UI | ⭐⭐ |
| 3 | INV_Stock schema migration | ⭐ |
| 4 | Lot splitting ใน record-usage | ⭐⭐⭐⭐ |
| 5 | Usage modal 3 modes | ⭐⭐⭐ |

**Build ตามลำดับ 1 → 2 → 3 → 4 → 5**

---

### Key Design Decisions

1. **Conversion factor มาจาก DispenseConfig ไม่ใช่ Lot**
   - `INV_DispenseConfig.units_per_stock` = ค่าที่ใช้คำนวณจริง
   - SA เซตได้ เปลี่ยนแล้วมีผลกับการใช้ครั้งถัดไปเท่านั้น (ไม่ย้อนหลัง เพราะ history เก็บ qty ที่ตัดไปแล้ว)

2. **Opened Lot = row แยกใน INV_Stock (ไม่ใช่ fractional)**
   - ลูกค้ากำชับว่าต้องแยก lot ชัดเจน
   - unit เปลี่ยนจาก stock unit → dispense unit
   - expiry = min(original, opened_at + open_expiry_days)

3. **History = Usage + BranchLog รวมกัน**
   - Sort by date ก่อน display
   - Filter chip แยกตาม action_type

4. **expire_sweep**
   - ทำงานตอน page load ทุกครั้ง
   - Opened lots จะหมดอายุเร็วกว่า → sweep จับได้ถูกต้อง

---

## 📋 Checklist ก่อน Deploy ทุกครั้ง

- [ ] ทดสอบด้วย **account ที่ login นานแล้ว** (ไม่ใช่ account ที่เพิ่ง login ใหม่)
- [ ] ทดสอบ role ทุกประเภท: SUPER_ADMIN, ADMIN (สาขา)
- [ ] ทดสอบ session expire: เปิดหน้าทิ้งไว้ 2 ชั่วโมง แล้วลอง action
- [ ] ทดสอบ Demo ด้วย account ที่ไม่ใช่ developer account
- [ ] Restart dev server ทุกครั้งหลัง git mv หรือลบไฟล์
- [ ] TypeScript: `npx tsc --noEmit` ผ่านก่อน push
