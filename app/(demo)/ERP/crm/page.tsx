"use client";

/**
 * Demo CRM Page — dark theme + branch labels
 *
 * URL params (minimal):
 *   clientId       — หลัก: ใช้ดึง /api/crm/modules เพื่อโหลด config ทั้งหมดอัตโนมัติ
 *   spreadsheetId  — fallback ถ้าไม่มี clientId หรือ modules ไม่มี appointments
 *   title          — page title
 *
 * Config อ่านจาก client_crm ผ่าน /api/crm/modules:
 *   appointments → aptSid + aptSheet
 *   Master       → custSid + custSheet
 *   followup     → followSid + followSheet
 *   transaction  → txSid + txSheet + txConfig  (ประวัติรักษา)
 *
 * Branch: แสดง badge บอกสาขา ทุก user เห็นข้อมูลเหมือนกันหมด
 */

import { useEffect, useState, Suspense, useCallback } from "react";
import { useSession }   from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  type Appointment, type Customer, type Course, type FollowUp,
  type HelperOption,
  DEFAULT_HELPER_MAP, FALLBACK_OPTIONS,
  genId, toISO, todayStr, aptToRow, custToRow, flwToRow,
} from "@/app/components/crm/crm.types";

import CalTab    from "./tabs/CalTab";
import CustTab   from "./tabs/CustTab";
import FollowTab from "./tabs/FollowTab";

// ── Demo API paths ─────────────────────────────────────────────────────────────
const APT_API    = "/api/crm-demo/appointments";
const CUST_API   = "/api/crm-demo/customers";
const COURSE_API = "/api/crm-demo/courses";
const FOLLOW_API = "/api/crm-demo/followups";
const HELPER_API = "/api/module/helpers";

type TabId = "cal" | "custs" | "follows";

// ── Apt form modal (dark) ─────────────────────────────────────────────────────
function AptFormModal({ open, onClose, isEdit, saving, form, setForm, customers, services, doctors, isSuperAdmin, allBranches, activeBranchName, onSave }: {
  open: boolean; onClose: () => void; isEdit: boolean; saving: boolean;
  form: Partial<Appointment>; setForm: (f: Partial<Appointment>) => void;
  customers: Customer[]; services: string[]; doctors: string[];
  isSuperAdmin: boolean; allBranches: { branchId: string; branchName: string }[];
  activeBranchName: string;
  onSave: () => void;
}) {
  if (!open) return null;
  const TIMES = Array.from({ length: 24 }, (_, i) => `${String(Math.floor(i / 2) + 8).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
  const APT_STATUSES = ["pending","confirmed","in-progress","done","cancelled","no-show"];
  const STATUS_LABELS: Record<string,string> = { pending:"รอยืนยัน", confirmed:"ยืนยัน", "in-progress":"กำลังทำ", done:"เสร็จ", cancelled:"ยกเลิก", "no-show":"ไม่มา" };

  const formBranchId = (form as any).branch_id || "";

  const handleCustChange = (id: string) => {
    const c = customers.find(x => x.customer_id === id);
    setForm({ ...form, customer_id: id, customer_name: c?.full_name || "", customer_phone: c?.phone_number || "" });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-[#131929] border border-white/10 rounded-2xl w-full max-w-md my-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-white/[0.07]">
          <h3 className="text-white font-bold">{isEdit ? "แก้ไขนัดหมาย" : "เพิ่มนัดหมาย"}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/10 flex items-center justify-center text-slate-400 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-5 space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">ลูกค้า *</label>
            <select value={form.customer_id} onChange={e => handleCustChange(e.target.value)}
              className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500/50">
              <option value="">— เลือกลูกค้า —</option>
              {customers.map(c => <option key={c.customer_id} value={c.customer_id}>{c.full_name} ({c.phone_number})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <label className="text-xs font-semibold text-slate-400 mb-1.5 block">วันที่ *</label>
              <input type="date" value={form.appointment_date} onChange={e => setForm({ ...form, appointment_date: e.target.value })}
                className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500/50" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1.5 block">เริ่ม</label>
              <select value={form.appointment_time} onChange={e => setForm({ ...form, appointment_time: e.target.value })}
                className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500/50">
                {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1.5 block">สิ้นสุด</label>
              <select value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })}
                className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500/50">
                {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1.5 block">บริการ *</label>
              <input list="apt-services" value={form.service} onChange={e => setForm({ ...form, service: e.target.value })}
                placeholder="เลือกหรือพิมพ์"
                className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500/50" />
              <datalist id="apt-services">{services.map(s => <option key={s} value={s}/>)}</datalist>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1.5 block">แพทย์ *</label>
              <input list="apt-doctors" value={form.doctor} onChange={e => setForm({ ...form, doctor: e.target.value })}
                placeholder="เลือกหรือพิมพ์"
                className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500/50" />
              <datalist id="apt-doctors">{doctors.map(d => <option key={d} value={d}/>)}</datalist>
            </div>
          </div>
          {isEdit && (
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1.5 block">สถานะ</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Appointment["status"] })}
                className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500/50">
                {APT_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
              </select>
            </div>
          )}

          {/* Branch — auto สำหรับ branch admin, DD สำหรับ central */}
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">สาขา</label>
            {isSuperAdmin ? (
              <select value={formBranchId} onChange={e => setForm({ ...form, ...{ branch_id: e.target.value } as any })}
                className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500/50">
                <option value="">— เลือกสาขา —</option>
                {allBranches.map(b => <option key={b.branchId} value={b.branchId}>{b.branchName}</option>)}
              </select>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 flex-shrink-0" />
                <span className="text-rose-300 text-sm font-semibold">{activeBranchName || "สาขาของฉัน"}</span>
                <span className="text-slate-500 text-xs ml-auto">(อัตโนมัติ)</span>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">หมายเหตุ</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="บันทึก..."
              className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500/50 resize-none" />
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-white/[0.07]">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/[0.06] text-slate-400 text-sm font-semibold hover:bg-white/10 transition-colors">ยกเลิก</button>
          <button onClick={onSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold transition-colors disabled:opacity-50">
            {saving ? "..." : (isEdit ? "บันทึก" : "เพิ่มนัดหมาย")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Customer form modal (dark) ────────────────────────────────────────────────
function CustFormModal({ open, onClose, isEdit, saving, form, setForm, onSave }: {
  open: boolean; onClose: () => void; isEdit: boolean; saving: boolean;
  form: Partial<Customer>; setForm: (f: Partial<Customer>) => void; onSave: () => void;
}) {
  if (!open) return null;
  const F = ({ label, field, type="text", placeholder="" }: { label: string; field: keyof Customer; type?: string; placeholder?: string }) => (
    <div>
      <label className="text-xs font-semibold text-slate-400 mb-1.5 block">{label}</label>
      <input type={type} value={(form[field] as string) || ""} onChange={e => setForm({ ...form, [field]: e.target.value })}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500/50" />
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-[#131929] border border-white/10 rounded-2xl w-full max-w-lg my-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-white/[0.07]">
          <h3 className="text-white font-bold">{isEdit ? "แก้ไขข้อมูลลูกค้า" : "เพิ่มลูกค้าใหม่"}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/10 flex items-center justify-center text-slate-400 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3.5">
          <div className="col-span-2"><F label="ชื่อ-สกุล *" field="full_name" placeholder="ชื่อจริง นามสกุล" /></div>
          <F label="เบอร์โทร *" field="phone_number" type="tel" placeholder="0812345678" />
          <F label="ชื่อเล่น"   field="nickname" />
          <F label="Line ID"     field="line_id" />
          <F label="อีเมล"      field="email" type="email" />
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">เพศ</label>
            <select value={form.gender || "หญิง"} onChange={e => setForm({ ...form, gender: e.target.value })}
              className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500/50">
              {["หญิง","ชาย","อื่นๆ"].map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <F label="วันเกิด" field="birthdate" type="date" />
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">ระดับสมาชิก</label>
            <select value={form.member_level || "ทั่วไป"} onChange={e => setForm({ ...form, member_level: e.target.value })}
              className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500/50">
              {["ทั่วไป","Silver","Gold","Platinum"].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="col-span-2"><F label="ที่อยู่" field="address" /></div>
          <F label="ประวัติแพ้ยา" field="allergy" />
          <F label="โรคประจำตัว" field="medical_history" />
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">ช่องทางรู้จัก</label>
            <input list="sources-list" value={form.source || ""} onChange={e => setForm({ ...form, source: e.target.value })}
              className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500/50" />
            <datalist id="sources-list">{["Facebook","Instagram","TikTok","บอกต่อ","Walk-in","Line"].map(s=><option key={s} value={s}/>)}</datalist>
          </div>
          <div className="col-span-2">
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">หมายเหตุ</label>
            <textarea value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
              className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500/50 resize-none" />
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-white/[0.07]">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/[0.06] text-slate-400 text-sm font-semibold hover:bg-white/10 transition-colors">ยกเลิก</button>
          <button onClick={onSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold transition-colors disabled:opacity-50">
            {saving ? "..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Follow form modal (dark) ──────────────────────────────────────────────────
function FlwFormModal({ open, onClose, isEdit, saving, form, setForm, customers, branchId, isSuperAdmin, allBranches, activeBranchName, onSave }: {
  open: boolean; onClose: () => void; isEdit: boolean; saving: boolean;
  form: Partial<FollowUp>; setForm: (f: Partial<FollowUp>) => void;
  customers: Customer[]; branchId: string;
  isSuperAdmin: boolean; allBranches: { branchId: string; branchName: string }[];
  activeBranchName: string;
  onSave: () => void;
}) {
  if (!open) return null;
  const formBranchId = (form as any).branch_id || "";
  const handleCust = (id: string) => {
    const c = customers.find(x => x.customer_id === id);
    setForm({ ...form, customer_id: id, customer_name: c?.full_name || "", customer_phone: c?.phone_number || "" });
  };
  const TASK_TYPES = ["โทรติดตาม","ส่ง LINE","นัดหมายต่อ","แจ้งโปรโมชั่น","ตรวจอาการ","อื่นๆ"];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#131929] border border-white/10 rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-white/[0.07]">
          <h3 className="text-white font-bold">{isEdit ? "แก้ไขงานติดตาม" : "เพิ่มงานติดตาม"}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/10 flex items-center justify-center text-slate-400 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-5 space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">ลูกค้า *</label>
            <select value={form.customer_id} onChange={e => handleCust(e.target.value)}
              className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500/50">
              <option value="">— เลือกลูกค้า —</option>
              {customers.map(c => <option key={c.customer_id} value={c.customer_id}>{c.full_name} ({c.phone_number})</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">ประเภทงาน *</label>
            <select value={form.task_type} onChange={e => setForm({ ...form, task_type: e.target.value })}
              className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500/50">
              <option value="">— เลือก —</option>
              {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">กำหนดวัน *</label>
            <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })}
              className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500/50" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">รายละเอียด</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="บันทึก..."
              className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500/50 resize-none" />
          </div>

          {/* Branch — auto สำหรับ branch admin, DD สำหรับ central */}
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">สาขา</label>
            {isSuperAdmin ? (
              <select value={formBranchId} onChange={e => setForm({ ...form, ...{ branch_id: e.target.value } as any })}
                className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500/50">
                <option value="">— เลือกสาขา —</option>
                {allBranches.map(b => <option key={b.branchId} value={b.branchId}>{b.branchName}</option>)}
              </select>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 flex-shrink-0" />
                <span className="text-rose-300 text-sm font-semibold">{activeBranchName || "สาขาของฉัน"}</span>
                <span className="text-slate-500 text-xs ml-auto">(อัตโนมัติ)</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-white/[0.07]">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/[0.06] text-slate-400 text-sm font-semibold hover:bg-white/10 transition-colors">ยกเลิก</button>
          <button onClick={onSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold transition-colors disabled:opacity-50">
            {saving ? "..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
function CRMDemoPage() {
  const { data: session, status } = useSession();
  const router       = useRouter();
  const searchParams = useSearchParams();

  // ── URL params (minimal) ─────────────────────────────────────────────────────
  const urlClientId     = searchParams.get("clientId")      || "";
  const urlSpreadsheet  = searchParams.get("spreadsheetId") || "";
  const pageTitle       = searchParams.get("title")         || "CRM";

  // ── Resolved config (from /api/crm/modules — อ่านเหมือน CRM เก่า) ──────────
  interface CRMConfig {
    clientId:    string;
    aptSid:      string; aptSheet:    string;
    custSid:     string; custSheet:   string;
    followSid:   string; followSheet: string;
    txSid:       string; txSheet:     string; txConfig: string;
  }
  const [cfg, setCfg] = useState<CRMConfig>({
    clientId:   urlClientId,
    aptSid:     urlSpreadsheet, aptSheet:    "appointments",
    custSid:    urlSpreadsheet, custSheet:   "Customers",
    followSid:  urlSpreadsheet, followSheet: "followup_tasks",
    txSid:      "",             txSheet:     "Sales Transactions", txConfig: "Sales_Config",
  });
  const [showSettings, setShowSettings] = useState(false);
  const [draftCfg,     setDraftCfg]     = useState<CRMConfig>(cfg);

  const openSettings  = useCallback(() => { setDraftCfg(cfg); setShowSettings(true); }, [cfg]);
  const saveSettings  = useCallback(() => { setCfg(draftCfg); setShowSettings(false); }, [draftCfg]);

  // Convenience aliases
  const spreadsheetId     = cfg.aptSid     || urlSpreadsheet;
  const effectiveClientId = cfg.clientId;
  const txMod             = cfg.txSid
    ? { spreadsheetId: cfg.txSid, sheetName: cfg.txSheet, configName: cfg.txConfig }
    : null;

  // ── Branch state ─────────────────────────────────────────────────────────────
  const [myBranchId,       setMyBranchId]       = useState("");
  const [activeBranchId,   setActiveBranchId]   = useState("");
  const [activeBranchName, setActiveBranchName] = useState("");
  const [allBranches,      setAllBranches]      = useState<{ branchId: string; branchName: string }[]>([]);
  const [userRole,         setUserRole]         = useState("STAFF");
  const isSuperAdmin = userRole === "SUPER_ADMIN";
  const isAdmin      = userRole === "ADMIN" || isSuperAdmin;

  // ── Data state ────────────────────────────────────────────────────────────────
  const [apts,    setApts]    = useState<Appointment[]>([]);
  const [custs,   setCusts]   = useState<Customer[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [follows, setFollows] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const [services, setServices] = useState<string[]>([]);
  const [doctors,  setDoctors]  = useState<string[]>([]);

  // ── Tab ────────────────────────────────────────────────────────────────────────
  const now  = new Date();
  const [tab,     setTab]     = useState<TabId>((searchParams.get("tab") as TabId) || "cal");
  const [calY,    setCalY]    = useState(now.getFullYear());
  const [calM,    setCalM]    = useState(now.getMonth());
  const [selDate, setSelDate] = useState(todayStr());

  // ── Modal state ───────────────────────────────────────────────────────────────
  const [mApt,    setMApt]    = useState(false);
  const [mCust,   setMCust]   = useState(false);
  const [mFollow, setMFollow] = useState(false);
  const [eApt,    setEApt]    = useState<Appointment | null>(null);
  const [eCust,   setECust]   = useState<Customer    | null>(null);
  const [eFollow, setEFollow] = useState<FollowUp    | null>(null);
  const [sApt,    setSApt]    = useState(false);
  const [sCust,   setSCust]   = useState(false);
  const [sFollow, setSFollow] = useState(false);

  const ea0 = (date?: string): Partial<Appointment> => ({ customer_id: "", customer_name: "", customer_phone: "", appointment_date: date || selDate, appointment_time: "10:00", end_time: "11:00", service: "", doctor: "", status: "pending", course_id: "", price: 0, deposit: 0, notes: "" });
  const ec0 = (): Partial<Customer>  => ({ customer_id: "", full_name: "", nickname: "", phone_number: "", line_id: "", email: "", gender: "หญิง", birthdate: "", address: "", tax_id: "", allergy: "", medical_history: "", skin_type: "", source: "", member_level: "ทั่วไป", notes: "" });
  const ef0 = (): Partial<FollowUp>  => ({ customer_id: "", customer_name: "", customer_phone: "", due_date: todayStr(), task_type: "", description: "", status: "pending", appointment_id: "", notes: "" });

  const [fApt,    setFApt]    = useState<Partial<Appointment>>(ea0());
  const [fCust,   setFCust]   = useState<Partial<Customer>>(ec0());
  const [fFollow, setFFollow] = useState<Partial<FollowUp>>(ef0());

  // ── Boot ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    else if (status === "authenticated") {
      if (!urlClientId && !urlSpreadsheet) { setError("ไม่พบ clientId หรือ spreadsheetId"); setLoading(false); return; }
      bootBranch();
    }
  }, [status, urlClientId, urlSpreadsheet]);

  const bootBranch = async () => {
    try {
      // 1. branch + modules config พร้อมกัน
      const [branchRes, branchesRes, crmRes] = await Promise.all([
        fetch("/api/auth/branch-check").then(r => r.json()).catch(() => ({})),
        fetch("/api/auth/branches").then(r => r.json()).catch(() => ({ branches: [] })),
        urlClientId
          ? fetch(`/api/crm/modules?clientId=${urlClientId}`).then(r => r.json()).catch(() => ({}))
          : Promise.resolve({}),
      ]);

      const bid   = branchRes.branchId   || "";
      const bname = branchRes.branchName || "";
      const role  = branchRes.role       || "STAFF";
      const all: { branchId: string; branchName: string }[] = branchesRes.branches || [];

      setMyBranchId(bid);
      setUserRole(role);
      setAllBranches(all);
      setActiveBranchId(bid);
      setActiveBranchName(bname);

      // 2. build resolved config จาก modules (ถ้าไม่มีให้ fallback URL params)
      const resolvedCfg: CRMConfig = {
        clientId:   urlClientId,
        aptSid:     crmRes.appointments?.spreadsheetId || urlSpreadsheet,
        aptSheet:   crmRes.appointments?.sheetName     || "appointments",
        custSid:    crmRes.Master?.spreadsheetId       || urlSpreadsheet,
        custSheet:  crmRes.Master?.sheetName           || "Customers",
        followSid:  crmRes.followup?.spreadsheetId     || urlSpreadsheet,
        followSheet:crmRes.followup?.sheetName         || "followup_tasks",
        txSid:      crmRes.transaction?.spreadsheetId  || "",
        txSheet:    crmRes.transaction?.sheetName      || "Sales Transactions",
        txConfig:   crmRes.transaction?.configName     || "Sales_Config",
      };
      setCfg(resolvedCfg);

      await bootData(resolvedCfg);
    } catch (e: any) { setError(e.message); setLoading(false); }
  };

  const bootData = async (c: CRMConfig) => {
    setLoading(true);
    try {
      await Promise.all([
        fApts(c),
        fCusts(c),
        fCourses(c),
        fFollows(c),
        loadHelpers(c),
      ]);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  // ── Data loaders — รับ config เป็น param เพื่อให้ใช้ค่าล่าสุดจาก modules ──────
  const fApts = async (c: CRMConfig = cfg) => {
    try {
      const r = await fetch(`${APT_API}?spreadsheetId=${c.aptSid}&sheetName=${encodeURIComponent(c.aptSheet)}`);
      const d = await r.json();
      setApts(d.appointments || []);
    } catch { }
  };

  const fCusts = async (c: CRMConfig = cfg) => {
    try {
      const r = await fetch(`${CUST_API}?spreadsheetId=${c.custSid}&sheetName=${encodeURIComponent(c.custSheet)}`);
      const d = await r.json();
      setCusts(d.customers || []);
    } catch { }
  };

  const fCourses = async (c: CRMConfig = cfg) => {
    try {
      const r = await fetch(`${COURSE_API}?spreadsheetId=${c.aptSid}`);
      const d = await r.json();
      setCourses(d.courses || []);
    } catch { }
  };

  const fFollows = async (c: CRMConfig = cfg) => {
    try {
      const r = await fetch(`${FOLLOW_API}?spreadsheetId=${c.followSid}&sheetName=${encodeURIComponent(c.followSheet)}`);
      const d = await r.json();
      setFollows(d.tasks || []);
    } catch { }
  };

  const loadHelpers = async (c: CRMConfig = cfg) => {
    try {
      const [svcRes, docRes] = await Promise.all([
        fetch(`${HELPER_API}?spreadsheetId=${c.aptSid}&helperName=${DEFAULT_HELPER_MAP.services}`).then(r => r.json()).catch(() => ({ options: [] })),
        fetch(`${HELPER_API}?spreadsheetId=${c.aptSid}&helperName=${DEFAULT_HELPER_MAP.doctors}`).then(r => r.json()).catch(() => ({ options: [] })),
      ]);
      const svcs = (svcRes.options || []).map((o: HelperOption) => o.value);
      const docs = (docRes.options || []).map((o: HelperOption) => o.value);
      setServices(svcs.length ? svcs : FALLBACK_OPTIONS.services.map(o => o.value));
      setDoctors(docs.length  ? docs : FALLBACK_OPTIONS.doctors.map(o => o.value));
    } catch { }
  };

  // ── Branch switch (badge only — no data filter) ──────────────────────────────
  const switchBranch = (bid: string) => {
    const b = allBranches.find(x => x.branchId === bid);
    if (!b) return;
    setActiveBranchId(bid);
    setActiveBranchName(b.branchName);
  };

  // ── Save appointments ─────────────────────────────────────────────────────────
  const saveApt = async () => {
    if (!fApt.customer_name || !fApt.appointment_date || !fApt.service || !fApt.doctor) { alert("กรุณากรอกข้อมูลที่จำเป็น"); return; }

    // ── เช็คเวลาชน (สาขาเดียวกัน + วันเดียวกัน + เวลาทับ) ──────────────────
    const newBranch = (fApt as any).branch_id || activeBranchId;
    const newStart  = fApt.appointment_time || "00:00";
    const newEnd    = fApt.end_time         || "23:59";
    const conflicts = apts.filter(a => {
      if (a.appointment_id === eApt?.appointment_id) return false; // ข้ามตัวเอง (กรณีแก้ไข)
      if ((a as any).branch_id !== newBranch)        return false;
      if (a.appointment_date  !== fApt.appointment_date) return false;
      return a.appointment_time < newEnd && (a.end_time || "23:59") > newStart;
    });
    if (conflicts.length > 0) {
      const detail = conflicts.map(a => `• ${a.customer_name}  ${a.appointment_time}–${a.end_time}`).join("\n");
      const ok = window.confirm(`⚠️ เวลาชนกับนัดในสาขาเดียวกัน:\n${detail}\n\nยังต้องการบันทึกอยู่ไหม?`);
      if (!ok) return;
    }

    setSApt(true);
    try {
      const isEdit = !!eApt;
      const obj = { ...ea0(), ...fApt, appointment_id: eApt?.appointment_id || genId("APT"), created_at: eApt?.created_at || toISO(), created_by: (session as any)?.user?.email || "" } as Appointment;
      // inject branch_id จาก form (SuperAdmin เลือกเอง, BranchAdmin ได้ myBranchId อัตโนมัติ)
      const rowArr = aptToRow(obj);
      while (rowArr.length < 20) rowArr.push("");
      rowArr[19] = (fApt as any).branch_id || activeBranchId;

      if (isEdit) setApts(prev => prev.map(a => a.appointment_id === obj.appointment_id ? { ...obj, rowIndex: eApt!.rowIndex } : a));
      else        setApts(prev => [{ ...obj, rowIndex: 9999 }, ...prev]);
      closeMApt();
      fetch(APT_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spreadsheetId: cfg.aptSid, sheetName: cfg.aptSheet, action: isEdit ? "update" : "append", row: rowArr, ...(isEdit && { rowIndex: eApt?.rowIndex }) }) })
        .then(() => fApts());
    } catch (e: any) { alert(e.message); } finally { setSApt(false); }
  };

  const updAptStatus = async (apt: Appointment, s: Appointment["status"]) => {
    setApts(prev => prev.map(a => a.appointment_id === apt.appointment_id ? { ...a, status: s } : a));
    fetch(APT_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spreadsheetId: cfg.aptSid, sheetName: cfg.aptSheet, action: "status", rowIndex: apt.rowIndex, status: s }) })
      .then(() => fApts());
  };

  // ── Save customers ────────────────────────────────────────────────────────────
  const saveCust = async () => {
    if (!fCust.full_name || !fCust.phone_number) { alert("กรุณากรอกชื่อและเบอร์โทร"); return; }
    setSCust(true);
    try {
      const isEdit = !!eCust;
      const obj = { ...ec0(), ...fCust, customer_id: eCust?.customer_id || genId("CUS") } as Customer;
      const rowArr = custToRow(obj);
      while (rowArr.length < 17) rowArr.push("");
      rowArr[16] = (obj as any).branch_id || activeBranchId;
      await fetch(CUST_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spreadsheetId: cfg.custSid, sheetName: cfg.custSheet, action: isEdit ? "update" : "append", row: rowArr, ...(isEdit && { rowIndex: eCust?.rowIndex }) }) });
      await fCusts(); closeMCust();
    } catch (e: any) { alert(e.message); } finally { setSCust(false); }
  };

  const transferCust = async (c: Customer, newBranchId: string, newBranchName: string) => {
    const row = custToRow(c);
    while (row.length < 17) row.push("");
    row[16] = newBranchId;
    setCusts(prev => prev.map(x => x.customer_id === c.customer_id ? { ...x, branch_id: newBranchId } as any : x));
    await fetch(CUST_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spreadsheetId: cfg.custSid, sheetName: cfg.custSheet, action: "update", row, rowIndex: c.rowIndex }) });
    await fCusts();
  };

  // ── Save follow-ups ───────────────────────────────────────────────────────────
  const saveFollow = async () => {
    if (!fFollow.customer_name || !fFollow.due_date || !fFollow.task_type) { alert("กรุณากรอกข้อมูลที่จำเป็น"); return; }
    setSFollow(true);
    try {
      const isEdit = !!eFollow;
      const obj = { ...ef0(), ...fFollow, task_id: eFollow?.task_id || genId("FLW"), created_at: eFollow?.created_at || toISO(), created_by: (session as any)?.user?.email || "" } as FollowUp;
      if (isEdit) setFollows(prev => prev.map(f => f.task_id === obj.task_id ? { ...obj, rowIndex: eFollow!.rowIndex } : f));
      else        setFollows(prev => [{ ...obj, rowIndex: 9999 }, ...prev]);
      closeMFollow();
      const row = flwToRow(obj);
      while (row.length < 14) row.push("");
      row[13] = (fFollow as any).branch_id || activeBranchId;
      fetch(FOLLOW_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spreadsheetId: cfg.followSid, sheetName: cfg.followSheet, action: isEdit ? "update" : "append", row, ...(isEdit && { rowIndex: eFollow?.rowIndex }) }) })
        .then(() => fFollows());
    } catch (e: any) { alert(e.message); } finally { setSFollow(false); }
  };

  const updFollowStatus = async (f: FollowUp, s: FollowUp["status"]) => {
    setFollows(prev => prev.map(t => t.task_id === f.task_id ? { ...t, status: s } : t));
    fetch(FOLLOW_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spreadsheetId: cfg.followSid, sheetName: cfg.followSheet, action: "status", rowIndex: f.rowIndex, status: s }) })
      .then(() => fFollows());
  };

  // ── Modal helpers ─────────────────────────────────────────────────────────────
  const closeMApt    = () => { setMApt(false); setEApt(null); setFApt(ea0()); };
  const closeMCust   = () => { setMCust(false); setECust(null); setFCust(ec0()); };
  const closeMFollow = () => { setMFollow(false); setEFollow(null); setFFollow(ef0()); };

  const openApt  = (date?: string) => { setEApt(null); setFApt({ ...ea0(date), ...(!isSuperAdmin ? { branch_id: myBranchId } as any : {}) }); setMApt(true); };
  const editApt  = (a: Appointment) => { setEApt(a); setFApt({ ...a }); setMApt(true); };
  const openCust = () => { setECust(null); setFCust({ ...ec0(), branch_id: activeBranchId } as any); setMCust(true); };
  const editCust = (c: Customer) => { setECust(c); setFCust({ ...c }); setMCust(true); };
  const openFollow = (c?: Customer) => {
    setEFollow(null);
    const branchInject = !isSuperAdmin ? { branch_id: myBranchId } as any : {};
    setFFollow(c
      ? { ...ef0(), customer_id: c.customer_id, customer_name: c.full_name, customer_phone: c.phone_number, ...branchInject }
      : { ...ef0(), ...branchInject });
    setMFollow(true);
  };
  const editFollow = (f: FollowUp) => { setEFollow(f); setFFollow({ ...f }); setMFollow(true); };

  // open apt from customer detail
  const openAptForCust = (c: Customer) => {
    setEApt(null);
    setFApt({ ...ea0(), customer_id: c.customer_id, customer_name: c.full_name, customer_phone: c.phone_number, ...(!isSuperAdmin ? { branch_id: myBranchId } as any : {}) });
    setMApt(true);
  };

  // ── Derived — Branch Admin เห็นแค่สาขาตัวเอง, Central เห็นทั้งหมด ───────────
  const visibleApts = isSuperAdmin
    ? apts
    : apts.filter(a => !(a as any).branch_id || (a as any).branch_id === myBranchId);
  const visibleFollows = isSuperAdmin
    ? follows
    : follows.filter(f => !(f as any).branch_id || (f as any).branch_id === myBranchId);

  const pendingFollows = visibleFollows.filter(f => f.status === "pending");
  const todayApts      = visibleApts.filter(a => a.appointment_date === todayStr());

  const TABS: { id: TabId; label: string; badge?: number }[] = [
    { id: "cal",     label: "ปฏิทิน",  badge: todayApts.length },
    { id: "custs",   label: "ลูกค้า",  badge: 0 },
    { id: "follows", label: "ติดตาม",  badge: pendingFollows.length },
  ];

  // ── Loading screen ────────────────────────────────────────────────────────────
  if (status === "loading" || (loading && !error)) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e]">
      <div className="text-center">
        <div className="w-10 h-10 rounded-full border-2 border-rose-500/20 border-t-rose-400 animate-spin mx-auto mb-3" />
        <p className="text-slate-500 text-sm">กำลังโหลด CRM...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e]">
      <div className="text-center bg-white/[0.04] border border-white/10 rounded-2xl p-8 max-w-sm mx-4">
        <p className="text-white font-semibold mb-2">เกิดข้อผิดพลาด</p>
        <p className="text-slate-400 text-sm mb-4">{error}</p>
        <button onClick={() => window.location.reload()} className="px-5 py-2 bg-rose-500 text-white text-sm font-semibold rounded-xl hover:bg-rose-600 transition-colors">โหลดใหม่</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0f1e] pb-24 lg:pb-8" style={{ fontFamily: "var(--font-noto-sans-thai), sans-serif" }}>

      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-600/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-pink-600/5 blur-[120px] rounded-full" />
      </div>

      {/* ── Topbar ─────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#0a0f1e]/90 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 h-14 flex items-center justify-between gap-4">
          {/* Left: back + title */}
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} title="ย้อนกลับ"
              className="w-8 h-8 rounded-xl bg-white/[0.06] hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            </button>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            </div>
            <span className="text-white font-bold text-sm hidden sm:block">{pageTitle}</span>
          </div>

          {/* Right: branch badge + settings + user */}
          <div className="flex items-center gap-2">
            {/* Branch badge — info only, no filter */}
            {activeBranchName && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                <span className="text-rose-400 text-xs font-semibold">{activeBranchName}</span>
              </div>
            )}

            {/* Settings gear — admin only */}
            {isAdmin && (
              <button onClick={openSettings} title="ตั้งค่า CRM"
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${(!cfg.txSid || !effectiveClientId) ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-white/[0.06] text-slate-400 hover:bg-white/10 hover:text-white"}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </button>
            )}

            <div className="flex items-center gap-2">
              {(session as any)?.user?.image && (
                <img src={(session as any).user.image} className="w-7 h-7 rounded-full border border-white/10" alt="" />
              )}
              <span className="text-slate-400 text-xs hidden sm:block">{(session as any)?.user?.name?.split(" ")[0]}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-4 lg:px-6 py-5">

        {/* ── Stats row ─────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: "นัดวันนี้",  value: todayApts.length,      color: "text-rose-400" },
            { label: "ลูกค้า",     value: custs.length, color: "text-white" },
            { label: "รอติดตาม",   value: pendingFollows.length, color: "text-amber-400" },
          ].map(s => (
            <div key={s.label} className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-3.5 lg:p-4">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{s.label}</p>
              <p className={`text-2xl lg:text-3xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── Desktop tab bar ───────────────────────────────────────────────────── */}
        <div className="hidden lg:flex gap-1 mb-6 bg-white/[0.03] border border-white/[0.07] rounded-xl p-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${tab === t.id ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20" : "text-slate-400 hover:text-white hover:bg-white/[0.05]"}`}>
              {t.label}
              {(t.badge ?? 0) > 0 && (
                <span className={`min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center ${tab === t.id ? "bg-white/20" : "bg-rose-500/80 text-white"}`}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab content ───────────────────────────────────────────────────────── */}
        {tab === "cal" && (
          <CalTab apts={visibleApts} calY={calY} calM={calM} selDate={selDate}
            setSelDate={setSelDate} setCalY={setCalY} setCalM={setCalM}
            onOpenApt={openApt} onEditApt={editApt} onStatusChange={updAptStatus}
            isSuperAdmin={isSuperAdmin} allBranches={allBranches} />
        )}
        {tab === "custs" && (
          <CustTab customers={custs} courses={courses} apts={visibleApts}
            branchId={activeBranchId} isSuperAdmin={isAdmin}
            allBranches={allBranches} onOpenCust={openCust} onEditCust={editCust}
            onTransfer={transferCust}
            txMod={txMod} clientId={effectiveClientId} activeBranchName={activeBranchName}
            onOpenFollow={openFollow} onOpenApt={openAptForCust} />
        )}
        {tab === "follows" && (
          <FollowTab follows={visibleFollows} branchId={activeBranchId}
            isSuperAdmin={isAdmin} allBranches={allBranches} customers={custs}
            onOpenFollow={openFollow} onEditFollow={editFollow}
            updFollowStatus={updFollowStatus} />
        )}
      </div>

      {/* ── Mobile bottom nav ──────────────────────────────────────────────────── */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-[#0a0f1e]/95 backdrop-blur-xl border-t border-white/[0.07]">
        <div className="flex">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 relative transition-colors ${tab === t.id ? "text-rose-400" : "text-slate-500"}`}>
              {(t.badge ?? 0) > 0 && (
                <span className="absolute top-1.5 right-[calc(50%-10px)] min-w-[14px] h-3.5 px-1 rounded-full bg-rose-500 text-white text-[8px] font-bold flex items-center justify-center">
                  {t.badge! > 99 ? "99+" : t.badge}
                </span>
              )}
              <span className="text-[10px] font-semibold">{t.label}</span>
              {tab === t.id && <div className="absolute top-0 left-4 right-4 h-0.5 bg-rose-500 rounded-full" />}
            </button>
          ))}
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────────── */}
      {/* ── Settings modal ─────────────────────────────────────────────────────── */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowSettings(false)}>
          <div className="bg-[#131929] border border-white/10 rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-white/[0.07]">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                <h3 className="text-white font-bold">ตั้งค่า CRM</h3>
              </div>
              <button onClick={() => setShowSettings(false)} className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/10 flex items-center justify-center text-slate-400 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Config status summary */}
              <div className="bg-white/[0.03] rounded-xl p-3 space-y-1.5">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">สถานะ (อ่านจาก client_crm)</p>
                {[
                  { label: "Appointments",       ok: !!cfg.aptSid },
                  { label: "Customers (Master)", ok: !!cfg.custSid },
                  { label: "Follow-ups",         ok: !!cfg.followSid },
                  { label: "Sales Transactions", ok: !!cfg.txSid },
                  { label: "Drive / Photos",     ok: !!cfg.clientId },
                ].map(({ label, ok }) => (
                  <div key={label} className="flex items-center gap-2 text-xs">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ok ? "bg-emerald-400" : "bg-amber-400"}`} />
                    <span className="text-slate-400">{label}</span>
                    <span className={`ml-auto font-semibold ${ok ? "text-emerald-400" : "text-amber-400"}`}>{ok ? "✓" : "⚠ ยังไม่ได้ตั้งค่า"}</span>
                  </div>
                ))}
              </div>

              {/* Manual override section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 bg-rose-500 rounded-full" />
                  <p className="text-white text-sm font-bold">Sales Transactions (ประวัติรักษา)</p>
                </div>
                <div className="space-y-2.5">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 mb-1 block">Spreadsheet ID</label>
                    <input value={draftCfg.txSid} onChange={e => setDraftCfg(d => ({ ...d, txSid: e.target.value }))}
                      placeholder="1aBcD... (Google Sheets ID)"
                      className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-rose-500/50 placeholder:text-slate-600" />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-xs font-semibold text-slate-400 mb-1 block">ชื่อชีท</label>
                      <input value={draftCfg.txSheet} onChange={e => setDraftCfg(d => ({ ...d, txSheet: e.target.value }))}
                        placeholder="Sales Transactions"
                        className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500/50 placeholder:text-slate-600" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-400 mb-1 block">Config Sheet</label>
                      <input value={draftCfg.txConfig} onChange={e => setDraftCfg(d => ({ ...d, txConfig: e.target.value }))}
                        placeholder="Sales_Config"
                        className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500/50 placeholder:text-slate-600" />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-1 h-4 bg-violet-500 rounded-full" />
                  <p className="text-white text-sm font-bold">Client ID (Drive / Photos)</p>
                </div>
                <input value={draftCfg.clientId} onChange={e => setDraftCfg(d => ({ ...d, clientId: e.target.value }))}
                  placeholder="C006"
                  className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-rose-500/50 placeholder:text-slate-600" />
                <p className="text-slate-600 text-[11px] mt-1">ค่าจาก client_master — ใช้สำหรับอัปโหลดรูปภาพลง Drive</p>
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t border-white/[0.07]">
              <button onClick={() => setShowSettings(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.06] text-slate-400 text-sm font-semibold hover:bg-white/10 transition-colors">
                ยกเลิก
              </button>
              <button onClick={saveSettings}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold transition-colors shadow-lg shadow-rose-500/20">
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      <AptFormModal open={mApt} onClose={closeMApt} isEdit={!!eApt} saving={sApt}
        form={fApt} setForm={setFApt as any} customers={custs}
        services={services} doctors={doctors}
        isSuperAdmin={isSuperAdmin} allBranches={allBranches} activeBranchName={activeBranchName}
        onSave={saveApt} />
      <CustFormModal open={mCust} onClose={closeMCust} isEdit={!!eCust} saving={sCust}
        form={fCust} setForm={setFCust as any} onSave={saveCust} />
      <FlwFormModal open={mFollow} onClose={closeMFollow} isEdit={!!eFollow} saving={sFollow}
        form={fFollow} setForm={setFFollow as any} customers={custs}
        branchId={activeBranchId}
        isSuperAdmin={isSuperAdmin} allBranches={allBranches} activeBranchName={activeBranchName}
        onSave={saveFollow} />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e]">
        <div className="w-10 h-10 rounded-full border-2 border-rose-500/20 border-t-rose-400 animate-spin" />
      </div>
    }>
      <CRMDemoPage />
    </Suspense>
  );
}
