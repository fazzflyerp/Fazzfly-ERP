// app/components/crm/crm.types.ts

// ─── Data Types ───────────────────────────────────────────────────────────────
export interface Appointment {
  rowIndex?: number;
  appointment_id: string; created_at: string; customer_id: string;
  customer_name: string; customer_phone: string; appointment_date: string;
  appointment_time: string; end_time: string; service: string; doctor: string;
  status: "pending" | "confirmed" | "in-progress" | "done" | "cancelled" | "no-show";
  course_id: string; price: number; deposit: number;
  notes: string; reminded_at: string; created_by: string;
}
export interface Customer {
  rowIndex?: number;
  customer_id: string; full_name: string; nickname: string; phone_number: string;
  line_id: string; email: string; gender: string; birthdate: string; address: string;
  tax_id: string; allergy: string; medical_history: string; skin_type: string;
  source: string; member_level: string; notes: string;
}
export interface Course {
  rowIndex?: number;
  course_id: string; created_at: string; customer_id: string; customer_name: string;
  course_name: string; service: string; total_sessions: number; used_sessions: number;
  remaining_sessions: number; price_per_session: number; total_price: number;
  paid_amount: number; purchase_date: string; expire_date: string; status: string; notes: string;
}
export interface FollowUp {
  rowIndex?: number;
  task_id: string; created_at: string; customer_id: string; customer_name: string;
  customer_phone: string; due_date: string; task_type: string; description: string;
  status: "pending" | "done" | "skipped";
  appointment_id: string; notes: string; reminded_at: string; created_by: string;
}

export type TabId = "cal" | "custs" | "follows";

// ─── Helper option — เหมือนที่ ERP form ใช้ ──────────────────────────────────
// helpers API return: { options: [ { value, label } ] }
export interface HelperOption {
  value: string;
  label: string;
}

// ─── FormField — จาก /api/module/config response ──────────────────────────────
export interface FormField {
  fieldName: string;
  label: string;
  type: string;
  required: boolean;
  helper: string | null;
  order: number;
  placeholder: string;
  validation: string | null;
  section?: string;
  repeatable?: boolean;
  notes?: string;
}

// ─── CRM Config ───────────────────────────────────────────────────────────────
// helperMap: field → helperName (ชื่อ sheet ใน Google Sheets)
// options:   { helperName → HelperOption[] } เหมือน helperOptions ใน ERP form
export interface CRMConfig {
  spreadsheetId: string;
  // Map: ชื่อฟิลด์ CRM → helperName ที่จะส่งไป /api/module/helpers
  helperMap: {
    services:   string;
    doctors:    string;
    genders:    string;
    skinTypes:  string;
    sources:    string;
    members:    string;
    taskTypes:  string;
    customers:  string;   // Helpers_C
  };
  // helperOptions เก็บแบบเดียวกับ ERP form: { [helperName]: HelperOption[] }
  helperOptions: { [helperName: string]: HelperOption[] };
}

// ─── API Paths ────────────────────────────────────────────────────────────────
export const APT_API     = "/api/crm/appointments";
export const CUST_API    = "/api/crm/customers";
export const COURSE_API  = "/api/crm/courses";
export const FOLLOW_API  = "/api/crm/followups";
export const HELPER_API  = "/api/module/helpers";  // ← shared กับ ERP
export const CONFIG_API  = "/api/module/config";    // ← shared กับ ERP
export const MODULES_API     = "/api/user/modules";
export const CRM_MODULES_API = "/api/crm/modules";   // ← ดึงจาก client_crm sheet

// ─── Default helperNames ──────────────────────────────────────────────────────
// ถ้า /api/user/modules ไม่ส่ง crmHelperMap มา ใช้ชื่อ default นี้
export const DEFAULT_HELPER_MAP: CRMConfig["helperMap"] = {
  services:  "Helpers_P",   // Helpers_P = บริการ/โปรแกรม
  doctors:   "Helpers_D",   // Helpers_D = แพทย์
  genders:   "CRM_Genders",
  skinTypes: "CRM_SkinTypes",
  sources:   "CRM_Sources",
  members:   "CRM_Members",
  taskTypes: "CRM_TaskTypes",
  customers: "Helpers_C",   // Helpers_C = ลูกค้า
};

// ─── Fallback options ─────────────────────────────────────────────────────────
// ใช้ถ้า helper sheet ยังไม่มีข้อมูล (เหมือน ERP form ที่ return [] แล้ว graceful)
export const FALLBACK_OPTIONS: { [k in keyof CRMConfig["helperMap"]]: HelperOption[] } = {
  customers: [],
  services:  ["Botox","Filler","Laser","Skincare","Mesotherapy","PRP","Thread Lift","Whitening","อื่นๆ"].map(v=>({value:v,label:v})),
  doctors:   ["นพ.สมชาย","พญ.สมหญิง","นพ.วิชัย","พญ.มาลี"].map(v=>({value:v,label:v})),
  genders:   ["หญิง","ชาย","อื่นๆ"].map(v=>({value:v,label:v})),
  skinTypes: ["มัน","แห้ง","ผสม","แพ้ง่าย","ปกติ"].map(v=>({value:v,label:v})),
  sources:   ["Facebook","Instagram","TikTok","บอกต่อ","Walk-in","Line","อื่นๆ"].map(v=>({value:v,label:v})),
  members:   ["ทั่วไป","Silver","Gold","Platinum"].map(v=>({value:v,label:v})),
  taskTypes: ["โทรติดตาม","ส่ง LINE","นัดหมายต่อ","แจ้งโปรโมชั่น","ตรวจอาการ","อื่นๆ"].map(v=>({value:v,label:v})),
};

// ─── Helper: ดึง options จาก helperOptions โดย helperName ────────────────────
// เหมือน ERP form: helperOptions[field.helper] || []
export const getOptions = (cfg: CRMConfig, helperName: string): HelperOption[] =>
  cfg.helperOptions[helperName] || [];

// ─── Helper: ดึง options ของ field CRM เป็น string[] สำหรับ render ───────────
export const getFieldOptions = (cfg: CRMConfig, field: keyof CRMConfig["helperMap"]): string[] =>
  getOptions(cfg, cfg.helperMap[field]).map(o => o.value);

// ─── Status / UI Config maps (UI mapping — ไม่ต้องดึงจาก sheet) ──────────────
export const S_CFG: Record<string, { l: string; dot: string; bg: string; text: string }> = {
  pending:       { l: "รอยืนยัน",  dot: "#f59e0b", bg: "bg-amber-50",   text: "text-amber-700"   },
  confirmed:     { l: "ยืนยัน",    dot: "#3b82f6", bg: "bg-blue-50",    text: "text-blue-700"    },
  "in-progress": { l: "กำลังทำ",   dot: "#8b5cf6", bg: "bg-violet-50",  text: "text-violet-700"  },
  done:          { l: "เสร็จ",     dot: "#10b981", bg: "bg-emerald-50", text: "text-emerald-700" },
  cancelled:     { l: "ยกเลิก",   dot: "#f43f5e", bg: "bg-rose-50",    text: "text-rose-600"    },
  "no-show":     { l: "ไม่มา",    dot: "#94a3b8", bg: "bg-slate-100",  text: "text-slate-500"   },
};
export const F_CFG: Record<string, { l: string; dot: string; bg: string; text: string }> = {
  pending: { l: "รอดำเนินการ", dot: "#f43f5e", bg: "bg-rose-50",    text: "text-rose-600"    },
  done:    { l: "เสร็จแล้ว",  dot: "#10b981", bg: "bg-emerald-50", text: "text-emerald-700" },
  skipped: { l: "ข้าม",       dot: "#cbd5e1", bg: "bg-slate-100",  text: "text-slate-500"   },
};
export const MEMBER_CFG: Record<string, { bg: string; text: string; border: string; grad: string }> = {
  "ทั่วไป": { bg: "bg-slate-50",   text: "text-slate-600",   border: "border-slate-200",   grad: "from-slate-400 to-slate-500"  },
  Silver:   { bg: "bg-slate-100",  text: "text-slate-700",   border: "border-slate-300",   grad: "from-slate-400 to-slate-600"  },
  Gold:     { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   grad: "from-amber-400 to-amber-500"  },
  Platinum: { bg: "bg-fuchsia-50", text: "text-fuchsia-700", border: "border-fuchsia-200", grad: "from-fuchsia-400 to-pink-500" },
};

// ─── Time slots ───────────────────────────────────────────────────────────────
export const TIMES = Array.from({ length: 24 }, (_, i) => `${String(Math.floor(i/2)+9).padStart(2,"0")}:${i%2?"30":"00"}`);

// ─── Thai locale ──────────────────────────────────────────────────────────────
export const TH_M_SHORT = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
export const TH_M_LONG  = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
export const TH_DAYS    = ["อา","จ","อ","พ","พฤ","ศ","ส"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const pad2     = (n: number) => String(n).padStart(2, "0");
export const genId    = (p: string) => `${p}${Date.now().toString().slice(-7)}`;
export const toISO    = () => new Date().toISOString();
export const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; };
export const makeDStr = (y: number, m: number, d: number) => `${y}-${pad2(m+1)}-${pad2(d)}`;
export const getDays  = (y: number, m: number) => new Date(y, m+1, 0).getDate();
export const getFirst = (y: number, m: number) => new Date(y, m, 1).getDay();
export const fmtDate  = (s: string) => {
  if (!s) return "—";
  try { const d = new Date(s); return `${d.getDate()} ${TH_M_SHORT[d.getMonth()]} ${d.getFullYear()+543}`; } catch { return s; }
};

// ─── Row converters ───────────────────────────────────────────────────────────
export const aptToRow  = (a: Appointment): string[] => [a.appointment_id,a.created_at,a.customer_id,a.customer_name,a.customer_phone,a.appointment_date,a.appointment_time,a.end_time,a.service,a.doctor,a.status,a.course_id,String(a.price),String(a.deposit),a.notes,a.reminded_at,a.created_by];
// col: รหัส | ชื่อ-สกุล | เบอร์ | ที่อยู่ | เลขภาษี | ชื่อเล่น | LineID | อีเมล | เพศ | วันเกิด | แพ้ยา | โรค | ช่องทาง | สมาชิก | หมายเหตุ
export const custToRow = (c: Customer): string[] => [c.customer_id,c.full_name,c.phone_number,c.address,c.tax_id||"",c.nickname,c.line_id,c.email||"",c.gender,c.birthdate,c.allergy,c.medical_history,c.source,c.member_level,c.notes];
export const flwToRow  = (f: FollowUp):    string[] => [f.task_id,f.created_at,f.customer_id,f.customer_name,f.customer_phone,f.due_date,f.task_type,f.description,f.status,f.appointment_id,f.notes,f.reminded_at||"",f.created_by];