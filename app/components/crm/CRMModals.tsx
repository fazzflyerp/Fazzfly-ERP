// app/components/crm/CRMModals.tsx
"use client";
import { Modal, MHead, BtnPrimary, BtnSecondary, Inp, Sel, Txt, FL, Badge, Ic, IC } from "@/app/components/crm/crm.ui";
import { S_CFG, F_CFG, MEMBER_CFG, TIMES, fmtDate, getFieldOptions } from "@/app/components/crm/crm.types";
import type { Appointment, Customer, Course, FollowUp, CRMConfig, HelperOption, FormField } from "@/app/components/crm/crm.types";

// ── Appointment Modal ─────────────────────────────────────────────────────────
interface AptModalProps {
  open: boolean; onClose: () => void;
  isEdit: boolean; loading: boolean;
  form: Partial<Appointment>; setForm: React.Dispatch<React.SetStateAction<Partial<Appointment>>>;
  customers: Customer[];
  config: CRMConfig;
  fields: FormField[];
  onSave: () => void;
}
export function AptModal({ open, onClose, isEdit, loading, form, setForm, customers, config, fields, onSave }: AptModalProps) {
  if (!open) return null;

  // fields ที่ระบบจัดการเองอัตโนมัติ — ซ่อนจาก form
  const HIDDEN = ["appointment_id","created_at","created_by","reminded_at"];
  // fields ที่ auto fill จาก customer dropdown — แสดงแบบ readonly
  const READONLY = ["customer_name","customer_phone"];

  const parseCust = (opt: HelperOption) => {
    const [name, phone] = opt.label.split(" - ").map(s => s.trim());
    return { name: name || opt.value, phone: phone || "" };
  };

  const renderField = (field: FormField) => {
    const key  = field.fieldName as keyof Appointment;
    const lbl  = `${field.label}${field.required ? " *" : ""}`;
    const val  = (form as any)[key] ?? "";
    const set  = (v: any) => setForm(f => ({ ...f, [key]: v }));

    // ซ่อน auto fields
    if (HIDDEN.includes(field.fieldName)) return null;

    // customer_id → dropdown จาก Helpers_C → auto fill name + phone
    if (field.fieldName === "customer_id") {
      const opts = config.helperOptions[field.helper || config.helperMap.customers] || [];
      return (
        <FL key={key} label={lbl} full>
          <Sel value={form.customer_id||""} onChange={e => {
            const opt = opts.find(o => o.value === e.target.value);
            const p   = opt ? parseCust(opt) : { name: "", phone: "" };
            setForm(f => ({ ...f, customer_id: e.target.value, customer_name: p.name, customer_phone: p.phone }));
          }}>
            <option value="">-- เลือกลูกค้า --</option>
            {opts.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
          </Sel>
        </FL>
      );
    }

    // customer_name, customer_phone → readonly auto fill
    if (READONLY.includes(field.fieldName))
      return <FL key={key} label={lbl}><Inp value={val} readOnly placeholder="auto fill"/></FL>;

    // status → chip selector
    if (field.fieldName === "status") return (
      <FL key={key} label={lbl} full>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(S_CFG) as Appointment["status"][]).map(s => (
            <button key={s} type="button" onClick={() => set(s)}
              className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-all border ${form.status===s ? `${S_CFG[s].bg} ${S_CFG[s].text} border-current` : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-pink-50"}`}>
              {S_CFG[s].l}
            </button>
          ))}
        </div>
      </FL>
    );

    // time → TIMES dropdown
    if (field.type === "time")
      return <FL key={key} label={lbl}><Sel value={val} onChange={e=>set(e.target.value)}>{TIMES.map(t=><option key={t}>{t}</option>)}</Sel></FL>;

    // dropdown → helper options
    if (field.type === "dropdown" && field.helper) {
      const opts = config.helperOptions[field.helper] || [];
      return (
        <FL key={key} label={lbl}>
          <Sel value={val} onChange={e=>set(e.target.value)}>
            <option value="">เลือก</option>
            {opts.map(o => <option key={o.value} value={o.value}>{o.label || o.value}</option>)}
          </Sel>
        </FL>
      );
    }

    if (field.type === "number")
      return <FL key={key} label={lbl}><Inp type="number" value={val} onChange={e=>set(Number(e.target.value))} placeholder="0"/></FL>;
    if (field.type === "date")
      return <FL key={key} label={lbl}><Inp type="date" value={val} onChange={e=>set(e.target.value)}/></FL>;
    if (field.type === "textarea")
      return <FL key={key} label={lbl} full><Txt value={val} onChange={e=>set(e.target.value)} rows={2}/></FL>;

    // text / default
    return <FL key={key} label={lbl}><Inp value={val} onChange={e=>set(e.target.value)}/></FL>;
  };

  // เรียง fields ตาม order
  const sorted = [...fields].sort((a, b) => a.order - b.order);

  return (
    <Modal onClose={onClose}>
      <MHead title={isEdit ? "แก้ไขนัดหมาย" : "นัดหมายใหม่"} onClose={onClose}/>
      <div className="px-4 sm:px-6 py-3 sm:py-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sorted.map(renderField)}
      </div>
      <div className="sticky bottom-0 bg-white border-t border-pink-100 flex gap-3 px-4 sm:px-6 py-4">
        <BtnSecondary onClick={onClose} className="flex-1 py-2.5">ยกเลิก</BtnSecondary>
        <BtnPrimary loading={loading} onClick={onSave} className="flex-1 py-2.5">บันทึกนัดหมาย</BtnPrimary>
      </div>
    </Modal>
  );
}

// ── Customer Modal ────────────────────────────────────────────────────────────
interface CustModalProps {
  open: boolean; onClose: () => void;
  isEdit: boolean; loading: boolean;
  form: Partial<Customer>; setForm: React.Dispatch<React.SetStateAction<Partial<Customer>>>;
  config: CRMConfig;
  fields: FormField[];
  onSave: () => void;
}
export function CustModal({ open, onClose, isEdit, loading, form, setForm, config, fields, onSave }: CustModalProps) {
  if (!open) return null;

  // ซ่อน auto fields
  const HIDDEN = ["customer_id", "created_at", "created_by", "tax_id"];

  const renderField = (field: FormField) => {
    const key = field.fieldName as keyof Customer;
    const lbl = `${field.label}${field.required ? " *" : ""}`;
    const val = (form as any)[key] ?? "";
    const set = (v: any) => setForm(f => ({ ...f, [key]: v }));

    if (HIDDEN.includes(field.fieldName)) return null;

    // เพศ → chip
    if (field.fieldName === "gender") return (
      <FL key={key} label={lbl} full>
        <div className="flex flex-wrap gap-2">
          {["ชาย","หญิง","อื่นๆ"].map(g => (
            <button key={g} type="button" onClick={() => set(g)}
              className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-all border ${form.gender===g ? "bg-rose-50 text-rose-500 border-rose-200" : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-pink-50"}`}>
              {g}
            </button>
          ))}
        </div>
      </FL>
    );

    // ระดับสมาชิก → chip
    if (field.fieldName === "member_level") return (
      <FL key={key} label={lbl} full>
        <div className="grid grid-cols-4 gap-2">
          {getFieldOptions(config, "members").map(m => {
            const mcf = MEMBER_CFG[m] || MEMBER_CFG["ทั่วไป"];
            return (
              <button key={m} type="button" onClick={() => set(m)}
                className={`py-2 rounded-xl text-xs font-semibold transition-all border ${form.member_level===m ? `${mcf.bg} ${mcf.text} ${mcf.border} shadow-sm` : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-pink-50"}`}>
                {m}
              </button>
            );
          })}
        </div>
      </FL>
    );

    if (field.fieldName === "notes" || field.type === "textarea")
      return <FL key={key} label={lbl} full><Txt value={val} onChange={e=>set(e.target.value)} rows={2} placeholder={field.placeholder}/></FL>;
    if (field.type === "date")
      return <FL key={key} label={lbl}><Inp type="date" value={val} onChange={e=>set(e.target.value)}/></FL>;

    return <FL key={key} label={lbl}><Inp value={val} onChange={e=>set(e.target.value)} placeholder={field.placeholder}/></FL>;
  };

  const sorted = fields.length > 0
    ? [...fields].sort((a, b) => a.order - b.order)
    : [];

  return (
    <Modal onClose={onClose}>
      <MHead title={isEdit ? "แก้ไขลูกค้า" : "เพิ่มลูกค้าใหม่"} onClose={onClose}/>
      <div className="px-4 sm:px-6 py-3 sm:py-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sorted.map(renderField)}
      </div>
      <div className="sticky bottom-0 bg-white border-t border-pink-100 flex gap-3 px-4 sm:px-6 py-4">
        <BtnSecondary onClick={onClose} className="flex-1 py-2.5">ยกเลิก</BtnSecondary>
        <BtnPrimary loading={loading} onClick={onSave} className="flex-1 py-2.5">บันทึกลูกค้า</BtnPrimary>
      </div>
    </Modal>
  );
}

// ── Follow-up Modal ───────────────────────────────────────────────────────────
interface FlwModalProps {
  open: boolean; onClose: () => void;
  isEdit: boolean; loading: boolean;
  form: Partial<FollowUp>; setForm: React.Dispatch<React.SetStateAction<Partial<FollowUp>>>;
  customers: Customer[];
  config: CRMConfig;
  onSave: () => void;
}
export function FlwModal({ open, onClose, isEdit, loading, form, setForm, customers, config, onSave }: FlwModalProps) {
  if (!open) return null;
  return (
    <Modal onClose={onClose}>
      <MHead title={isEdit ? "แก้ไขงานติดตาม" : "เพิ่มงานติดตาม"} onClose={onClose}/>
      <div className="px-4 sm:px-6 py-3 sm:py-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FL label="รหัสลูกค้า *" full>
          <Sel value={form.customer_id||""} onChange={e => {
            const opts = config.helperOptions[config.helperMap.customers] || [];
            const opt  = opts.find(o => o.value === e.target.value);
            const [name, phone] = opt ? opt.label.split(" - ").map(s=>s.trim()) : ["",""];
            setForm(f => ({...f, customer_id: e.target.value, customer_name: name||"", customer_phone: phone||""}));
          }}>
            <option value="">-- เลือกรหัสลูกค้า --</option>
            {(config.helperOptions[config.helperMap.customers] || []).map(o => (
              <option key={o.value} value={o.value}>{o.value}</option>
            ))}
          </Sel>
        </FL>
        <FL label="ชื่อลูกค้า"><Inp value={form.customer_name||""} readOnly placeholder="auto fill"/></FL>
        <FL label="เบอร์โทร"><Inp value={form.customer_phone||""} readOnly placeholder="auto fill"/></FL>
        <FL label="วันที่นัด *"><Inp type="date" value={form.due_date||""} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))}/></FL>
        <FL label="วันที่แจ้งเตือน"><Inp type="date" value={form.reminded_at||""} onChange={e=>setForm(f=>({...f,reminded_at:e.target.value}))}/></FL>
        <FL label="ประเภทงาน *" full>
          <div className="flex flex-wrap gap-2">
            {getFieldOptions(config, 'taskTypes').map(t => (
              <button key={t} type="button" onClick={() => setForm(f => ({...f, task_type: t}))}
                className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-all border ${form.task_type===t ? "bg-rose-50 text-rose-500 border-rose-200" : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-pink-50"}`}>
                {t}
              </button>
            ))}
          </div>
        </FL>
        <FL label="รายละเอียด" full><Txt value={form.description||""} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={3} placeholder="สิ่งที่ต้องทำ..."/></FL>
        <FL label="หมายเหตุ" full><Txt value={form.notes||""} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2} placeholder="บันทึกเพิ่มเติม..."/></FL>
      </div>
      <div className="sticky bottom-0 bg-white border-t border-pink-100 flex gap-3 px-4 sm:px-6 py-4">
        <BtnSecondary onClick={onClose} className="flex-1 py-2.5">ยกเลิก</BtnSecondary>
        <BtnPrimary loading={loading} onClick={onSave} className="flex-1 py-2.5">บันทึกงาน</BtnPrimary>
      </div>
    </Modal>
  );
}

// ── Appointment Detail Panel ──────────────────────────────────────────────────
interface AptDetailProps {
  apt: Appointment | null; onClose: () => void;
  onEdit: (a: Appointment) => void;
  onViewProfile: (a: Appointment) => void;
  updAptStatus: (a: Appointment, s: Appointment["status"]) => void;
}
export function AptDetailPanel({ apt, onClose, onEdit, onViewProfile, updAptStatus }: AptDetailProps) {
  if (!apt) return null;
  return (
    <Modal onClose={onClose}>
      <div className="sticky top-0 bg-white z-10 border-b border-pink-200 rounded-t-3xl">
        <div className="flex sm:hidden justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-pink-200"/>
        </div>
        <div className="flex items-center justify-between px-5 sm:px-6 py-3 sm:py-4">
          <Badge label={S_CFG[apt.status].l} bg={S_CFG[apt.status].bg} text={S_CFG[apt.status].text}/>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      </div>
      <div className="px-4 sm:px-6 py-3 sm:py-4 space-y-4">
        <div>
          <p className="text-xl font-bold text-slate-800">{apt.customer_name}</p>
          <p className="text-sm text-slate-600 mt-0.5">{apt.customer_phone}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            {l:"วันที่", v:fmtDate(apt.appointment_date)},
            {l:"เวลา",  v:`${apt.appointment_time} – ${apt.end_time}`},
            {l:"บริการ",v:apt.service},
            {l:"แพทย์", v:apt.doctor},
            {l:"ราคา",  v:apt.price>0?`฿${apt.price.toLocaleString()}`:"-"},
            {l:"มัดจำ", v:apt.deposit>0?`฿${apt.deposit.toLocaleString()}`:"-"},
          ].map(({l,v}) => (
            <div key={l} className="bg-pink-50/60 rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-pink-500 mb-0.5">{l}</p>
              <p className="text-sm font-semibold text-slate-700">{v}</p>
            </div>
          ))}
        </div>
        {apt.notes && (
          <div className="bg-pink-50/60 rounded-xl px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-pink-500 mb-0.5">หมายเหตุ</p>
            <p className="text-sm text-slate-600 italic">"{apt.notes}"</p>
          </div>
        )}
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-2">เปลี่ยนสถานะ</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(S_CFG) as Appointment["status"][]).filter(s => s !== apt.status).map(s => (
              <button key={s} onClick={() => updAptStatus(apt, s)}
                className={`text-xs px-3 py-1.5 rounded-xl font-semibold border transition-all hover:opacity-80 ${S_CFG[s].bg} ${S_CFG[s].text}`}>
                → {S_CFG[s].l}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="sticky bottom-0 bg-white border-t border-pink-100 flex gap-3 px-4 sm:px-6 py-4">
        <BtnSecondary onClick={() => { onEdit(apt); onClose(); }} className="flex-1 py-2.5 gap-2">
          <Ic d={IC.edit} cls="w-4 h-4"/>แก้ไข
        </BtnSecondary>
        <BtnPrimary onClick={() => onViewProfile(apt)} className="flex-1 py-2.5 gap-2">
          <Ic d={IC.person} cls="w-4 h-4"/>โปรไฟล์
        </BtnPrimary>
      </div>
    </Modal>
  );
}

// ── Customer Detail Panel ─────────────────────────────────────────────────────
import { useState as _useState, useEffect as _useEffect, useRef as _useRef, useCallback as _useCallback } from "react";

interface DriveFolder { id: string; name: string }
interface DriveImage  { id: string; name: string; mimeType: string; thumbnailLink: string | null; webViewLink: string | null; createdTime: string | null; size: string | null }

function PhotoCard({ img, clientId, onClick }: { img: DriveImage; clientId: string; onClick: () => void }) {
  const src = `/api/crm/photos/file?clientId=${encodeURIComponent(clientId)}&fileId=${img.id}`;
  return (
    <button onClick={onClick}
      className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 hover:opacity-90 transition-opacity">
      <img
        src={src}
        alt={img.name}
        className="w-full h-full object-cover"
        loading="lazy"
        onError={(e) => {
          const el = e.currentTarget;
          el.style.display = "none";
          const p = el.parentElement;
          if (p) p.innerHTML = `<div class="w-full h-full flex flex-col items-center justify-center gap-1 p-2"><svg class="w-6 h-6" style="color:#cbd5e1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg><span style="font-size:9px;color:#94a3b8">โหลดไม่ได้</span></div>`;
        }}
      />
    </button>
  );
}

interface TxRecord {
  rowIndex: number;
  date: string;
  program: string;
  quantity: string;
  doctor: string;
  staff: string;
  usedCourse: boolean;
}

interface CustDetailProps {
  cust: Customer | null; onClose: () => void;
  courses: Course[]; apts: Appointment[];
  clientId: string;
  txMod: { spreadsheetId: string; sheetName: string; configName?: string } | null;
  onEdit: (c: Customer) => void;
  onFollow: (c: Customer) => void;
  onBookApt: (c: Customer) => void;
}

const DETAIL_TABS = [
  { id: "info",      label: "ข้อมูล" },
  { id: "treatment", label: "ประวัติการรักษา" },
  { id: "course",    label: "คอร์ส / Member" },
  { id: "photo",     label: "รูปภาพ" },
];

export function CustDetailPanel({ cust, onClose, courses, apts, clientId, txMod, onEdit, onFollow, onBookApt }: CustDetailProps) {
  const [activeTab, setActiveTab] = _useState("info");

  // ── Treatment history state ───────────────────────────────────────────────
  const [txList,    setTxList]    = _useState<TxRecord[]>([]);
  const [txLoading, setTxLoading] = _useState(false);
  const [txLoaded,  setTxLoaded]  = _useState<string | null>(null);
  const [txError,   setTxError]   = _useState<string | null>(null);

  _useEffect(() => {
    if (activeTab !== "treatment" || !cust || !txMod) return;
    if (txLoaded === cust.customer_id) return;
    setTxLoading(true);
    setTxError(null);

    const params = new URLSearchParams({
      spreadsheetId: txMod.spreadsheetId,
      sheetName:     txMod.sheetName,
      configName:    txMod.configName || "Sales_Config",
      customerId:    cust.customer_id,
    });
    const url = `/api/crm/transactions?${params.toString()}`;
    fetch(url)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setTxError(d.error); return; }
        setTxList(d.transactions || []);
        setTxLoaded(cust.customer_id);
      })
      .catch(e => { console.error(e); setTxError(e.message); })
      .finally(() => setTxLoading(false));
  }, [activeTab, cust, txMod, txLoaded]);

  // reset treatment เมื่อเปลี่ยนลูกค้า
  _useEffect(() => {
    setTxList([]);
    setTxLoaded(null);
  }, [cust?.customer_id]);

  // ── Photo browser state ───────────────────────────────────────────────────
  const [rootFolderId, setRootFolderId]   = _useState<string | null>(null);
  const [breadcrumb,   setBreadcrumb]     = _useState<DriveFolder[]>([]);
  const [currentId,    setCurrentId]      = _useState<string | null>(null);
  const [folders,      setFolders]        = _useState<DriveFolder[]>([]);
  const [images,       setImages]         = _useState<DriveImage[]>([]);
  const [photoLoading, setPhotoLoading]   = _useState(false);
  const [uploading,    setUploading]      = _useState(false);
  const [refreshKey,   setRefreshKey]     = _useState(0);
  const [lightbox,     setLightbox]       = _useState<DriveImage | null>(null);
  const [uploadDate,   setUploadDate]     = _useState(() => new Date().toISOString().slice(0, 10));
  const fileInputRef = _useRef<HTMLInputElement>(null);

  // reset photo state ทุกครั้งที่ลูกค้าเปลี่ยน
  _useEffect(() => {
    setRootFolderId(null);
    setCurrentId(null);
    setBreadcrumb([]);
    setFolders([]);
    setImages([]);
    setLightbox(null);
  }, [cust?.customer_id]);

  // เมื่อ switch tab มา "photo" → หา/สร้าง root customer folder
  _useEffect(() => {
    if (activeTab !== "photo" || !cust || !clientId) return;
    if (rootFolderId) return;
    setPhotoLoading(true);
    fetch(`/api/crm/photos?clientId=${encodeURIComponent(clientId)}&action=root&customerId=${encodeURIComponent(cust.customer_id)}&customerName=${encodeURIComponent(cust.full_name)}`)
      .then(r => r.json())
      .then(d => {
        if (d.folderId) {
          setRootFolderId(d.folderId);
          setCurrentId(d.folderId);
          setBreadcrumb([]);
        }
      })
      .catch(console.error)
      .finally(() => setPhotoLoading(false));
  }, [activeTab, cust, clientId, rootFolderId]);

  // list contents เมื่อ currentId เปลี่ยน หรือ refreshKey เปลี่ยน
  _useEffect(() => {
    if (!currentId || !clientId) return;
    setPhotoLoading(true);
    fetch(`/api/crm/photos?clientId=${encodeURIComponent(clientId)}&action=list&folderId=${encodeURIComponent(currentId)}`)
      .then(r => r.json())
      .then(d => {
        setFolders(d.folders || []);
        setImages(d.images   || []);
      })
      .catch(console.error)
      .finally(() => setPhotoLoading(false));
  }, [currentId, clientId, refreshKey]);

  const enterFolder = _useCallback((folder: DriveFolder) => {
    if (!currentId) return;
    setBreadcrumb(prev => [...prev, { id: currentId, name: breadcrumb.length === 0 ? "หน้าหลัก" : breadcrumb[breadcrumb.length - 1].name }]);
    setCurrentId(folder.id);
    setFolders([]);
    setImages([]);
  }, [currentId, breadcrumb]);

  const goBack = _useCallback(() => {
    setBreadcrumb(prev => {
      const next = [...prev];
      const parent = next.pop();
      if (parent) setCurrentId(parent.id);
      return next;
    });
    setFolders([]);
    setImages([]);
  }, []);

  const handleUpload = _useCallback(async (file: File) => {
    if (!clientId || !cust) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("clientId",     clientId);
    fd.append("customerId",   cust.customer_id);
    fd.append("customerName", cust.full_name);
    fd.append("date",         uploadDate);
    fd.append("label",        "photo");
    fd.append("file",         file);
    try {
      const res = await fetch("/api/crm/photos", { method: "POST", body: fd });
      const d   = await res.json();
      if (!res.ok) throw new Error(d.error || "Upload failed");
      // refresh current folder
      setRefreshKey(k => k + 1);
    } catch (e: any) {
      alert("อัปโหลดไม่สำเร็จ: " + e.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [clientId, cust, uploadDate, currentId, rootFolderId]);

  // folder name display helpers
  const monthNames: Record<string, string> = {
    "01":"มกราคม","02":"กุมภาพันธ์","03":"มีนาคม","04":"เมษายน",
    "05":"พฤษภาคม","06":"มิถุนายน","07":"กรกฎาคม","08":"สิงหาคม",
    "09":"กันยายน","10":"ตุลาคม","11":"พฤศจิกายน","12":"ธันวาคม",
  };
  // depth: 0=customer root (showing years), 1=year (showing months), 2=month (showing days), 3=day (showing images)
  const depth = breadcrumb.length;
  const fmtFolderName = (name: string, d: number) => {
    if (d === 1) return monthNames[name] || name;
    if (d === 2) return `วันที่ ${name}`;
    return name;
  };

  if (!cust) return null;

  const ml  = cust.member_level || "ทั่วไป";
  const mcf = MEMBER_CFG[ml] || MEMBER_CFG["ทั่วไป"];
  const actCourses = courses.filter(c => c.customer_id === cust.customer_id && c.status === "active");
  const allCourses = courses.filter(c => c.customer_id === cust.customer_id);
  const custApts   = apts.filter(a => a.customer_id === cust.customer_id)
    .sort((a, b) => b.appointment_date.localeCompare(a.appointment_date));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
      <div
        className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[88vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle – mobile only */}
        <div className="flex sm:hidden justify-center pt-2.5 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-pink-200"/>
        </div>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 sm:py-4 border-b border-pink-100 flex-shrink-0">
          <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${mcf.grad} flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow`}>
            {cust.full_name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 truncate">{cust.full_name}</p>
            <p className="text-xs text-slate-500">{cust.nickname ? `(${cust.nickname}) · ` : ""}{cust.phone_number || "ไม่มีเบอร์"}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-pink-100 flex-shrink-0 overflow-x-auto scrollbar-hide">
          {DETAIL_TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-shrink-0 px-4 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === t.id
                  ? "border-rose-500 text-rose-600"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Tab: ข้อมูล ── */}
          {activeTab === "info" && (
            <div className="px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { l: "เบอร์โทร", v: cust.phone_number || "-" },
                  { l: "LINE",     v: cust.line_id || "-" },
                  { l: "เพศ",      v: cust.gender || "-" },
                  { l: "วันเกิด",  v: fmtDate(cust.birthdate) || "-" },
                  { l: "ผิว",      v: cust.skin_type || "-" },
                  { l: "สมาชิก",  v: cust.member_level || "ทั่วไป" },
                ].map(({ l, v }) => (
                  <div key={l} className="bg-pink-50/60 rounded-xl px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-pink-400 mb-0.5">{l}</p>
                    <p className="text-sm font-semibold text-slate-700">{v}</p>
                  </div>
                ))}
              </div>
              {(cust.allergy || cust.medical_history) && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 flex items-start gap-2">
                  <Ic d={IC.warn} cls="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5"/>
                  <div>
                    {cust.allergy && <p className="text-xs font-bold text-amber-700">แพ้: {cust.allergy}</p>}
                    {cust.medical_history && <p className="text-xs text-amber-600">โรค: {cust.medical_history}</p>}
                  </div>
                </div>
              )}
              {cust.notes && (
                <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">หมายเหตุ</p>
                  <p className="text-xs text-slate-600">{cust.notes}</p>
                </div>
              )}
              {custApts.slice(0, 3).length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-pink-400 mb-2">นัดหมายล่าสุด</p>
                  <div className="space-y-1.5">
                    {custApts.slice(0, 3).map(a => (
                      <div key={a.appointment_id} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
                        <div>
                          <p className="text-xs font-semibold text-slate-700">{fmtDate(a.appointment_date)} · {a.appointment_time}</p>
                          <p className="text-xs text-slate-500">{a.service}</p>
                        </div>
                        <Badge label={S_CFG[a.status]?.l || a.status} bg={S_CFG[a.status]?.bg || "bg-slate-100"} text={S_CFG[a.status]?.text || "text-slate-600"}/>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Tab: ประวัติการรักษา ── */}
          {activeTab === "treatment" && (
            <div className="px-4 py-3 space-y-2">
              {/* no txMod */}
              {!txMod && (
                <div className="py-8 flex flex-col items-center text-center">
                  <p className="text-sm font-semibold text-slate-400">ยังไม่ได้เชื่อมข้อมูล Transaction</p>
                  <p className="text-xs text-slate-300 mt-1">ตรวจสอบ client_crm — module_name ต้องเป็น "transaction"</p>
                </div>
              )}

              {/* error */}
              {txMod && txError && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-3 text-xs text-red-600">
                  <p className="font-bold mb-1">เกิดข้อผิดพลาด</p>
                  <p className="font-mono break-all">{txError}</p>
                </div>
              )}

              {/* loading */}
              {txMod && txLoading && (
                <div className="flex justify-center py-10">
                  <svg className="w-6 h-6 animate-spin text-rose-300" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                </div>
              )}

              {/* empty */}
              {txMod && !txLoading && txList.length === 0 && (
                <div className="py-8 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center mb-2">
                    <svg className="w-6 h-6 text-rose-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                  </div>
                  <p className="text-xs text-slate-400">ยังไม่มีประวัติการรักษา</p>
                </div>
              )}

              {/* list */}
              {txMod && !txLoading && txList.map((tx, i) => (
                <div key={i} className="bg-white border border-pink-100 rounded-2xl px-4 py-3 space-y-2">
                  {/* top row: date + badge ใช้คอร์ส */}
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-700">{fmtDate(tx.date) || tx.date}</p>
                    {tx.usedCourse && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600">ใช้คอร์ส</span>
                    )}
                  </div>

                  {/* program */}
                  {tx.program && (
                    <p className="text-sm font-semibold text-slate-800 leading-snug">{tx.program}</p>
                  )}

                  {/* meta row */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {tx.quantity && (
                      <span className="text-[11px] text-slate-500">จำนวน <span className="font-semibold text-slate-700">{tx.quantity}</span></span>
                    )}
                    {tx.doctor && (
                      <span className="text-[11px] text-slate-500">แพทย์ <span className="font-semibold text-slate-700">{tx.doctor}</span></span>
                    )}
                    {tx.staff && (
                      <span className="text-[11px] text-slate-500">BT <span className="font-semibold text-slate-700">{tx.staff}</span></span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Tab: คอร์ส / Member ── */}
          {activeTab === "course" && (
            <div className="px-5 py-4 space-y-3">
              {allCourses.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center text-center">
                  <div className="w-14 h-14 rounded-2xl bg-pink-50 flex items-center justify-center mb-3">
                    <svg className="w-7 h-7 text-pink-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-400">ไม่มีคอร์ส</p>
                </div>
              ) : (
                allCourses.map(co => (
                  <div key={co.course_id} className={`rounded-2xl p-4 border ${co.status === "active" ? "bg-pink-50/60 border-pink-100" : "bg-slate-50 border-slate-100"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-bold text-slate-700">{co.course_name}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${co.status === "active" ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-500"}`}>
                        {co.status === "active" ? "ใช้งาน" : co.status === "completed" ? "ครบแล้ว" : "หมดอายุ"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                      <span>ใช้แล้ว {co.used_sessions}/{co.total_sessions} ครั้ง</span>
                      <span className="font-bold text-rose-500">คงเหลือ {co.remaining_sessions} ครั้ง</span>
                    </div>
                    <div className="h-1.5 bg-pink-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min((co.used_sessions / (co.total_sessions || 1)) * 100, 100)}%`, background: co.status === "active" ? "linear-gradient(90deg,#f43f5e,#ec4899)" : "#cbd5e1" }}/>
                    </div>
                    {co.expire_date && (
                      <p className="text-[10px] text-slate-400 mt-1.5">หมดอายุ: {fmtDate(co.expire_date)}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Tab: รูปภาพ ── */}
          {activeTab === "photo" && (
            <div className="flex flex-col h-full">

              {/* Upload bar */}
              <div className="px-4 py-3 border-b border-pink-50 flex-shrink-0 flex items-center gap-2">
                <input type="date" value={uploadDate} onChange={e => setUploadDate(e.target.value)}
                  className="text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-rose-300 flex-shrink-0"/>
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border-2 border-dashed border-rose-200 text-rose-400 hover:bg-rose-50 transition-colors text-xs font-semibold disabled:opacity-50">
                  {uploading ? (
                    <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>กำลังอัปโหลด...</>
                  ) : (
                    <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>อัปโหลดรูปภาพ</>
                  )}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={async e => {
                    const files = Array.from(e.target.files || []);
                    for (const f of files) await handleUpload(f);
                  }}/>
              </div>

              {/* Breadcrumb */}
              {breadcrumb.length > 0 && (
                <div className="px-4 py-2 flex items-center gap-1 text-xs text-slate-500 flex-shrink-0 border-b border-pink-50">
                  <button onClick={() => { setCurrentId(rootFolderId); setBreadcrumb([]); setFolders([]); setImages([]); }}
                    className="text-rose-400 hover:underline font-semibold">หน้าหลัก</button>
                  {breadcrumb.slice(1).map((b, i) => (
                    <span key={b.id} className="flex items-center gap-1">
                      <span className="text-slate-300">/</span>
                      <button onClick={() => {
                        const idx = i + 1;
                        const target = breadcrumb[idx];
                        setBreadcrumb(prev => prev.slice(0, idx));
                        setCurrentId(target.id);
                        setFolders([]); setImages([]);
                      }} className="hover:underline">{b.name}</button>
                    </span>
                  ))}
                  <span className="text-slate-300">/</span>
                  <span className="font-semibold text-slate-600">{depth === 0 ? "ทั้งหมด" : depth === 1 ? "ปี" : depth === 2 ? "เดือน" : "วัน"}</span>
                </div>
              )}

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {photoLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <svg className="w-6 h-6 animate-spin text-rose-300" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  </div>
                ) : (
                  <>
                    {/* Folders */}
                    {folders.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {breadcrumb.length > 0 && (
                          <button onClick={goBack}
                            className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                            <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 17l-5-5m0 0l5-5m-5 5h12"/></svg>
                            <span className="text-[10px] text-slate-400 font-medium">ย้อนกลับ</span>
                          </button>
                        )}
                        {folders.map(f => (
                          <button key={f.id} onClick={() => enterFolder(f)}
                            className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-amber-50 hover:bg-amber-100 transition-colors">
                            <svg className="w-7 h-7 text-amber-400" fill="currentColor" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                            <span className="text-[10px] text-amber-700 font-semibold text-center leading-tight">{fmtFolderName(f.name, depth)}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Back button when no folders */}
                    {folders.length === 0 && breadcrumb.length > 0 && (
                      <button onClick={goBack}
                        className="flex items-center gap-1.5 mb-3 text-xs text-slate-400 hover:text-slate-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12"/></svg>
                        ย้อนกลับ
                      </button>
                    )}

                    {/* Images grid */}
                    {images.length > 0 && (
                      <div className="grid grid-cols-3 gap-1.5">
                        {images.map(img => (
                          <PhotoCard key={img.id} img={img} clientId={clientId} onClick={() => setLightbox(img)} />
                        ))}
                      </div>
                    )}

                    {/* Empty */}
                    {folders.length === 0 && images.length === 0 && !photoLoading && (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center mb-2">
                          <svg className="w-6 h-6 text-purple-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                          </svg>
                        </div>
                        <p className="text-xs text-slate-400">ยังไม่มีรูปภาพ</p>
                        <p className="text-[10px] text-slate-300 mt-0.5">กดอัปโหลดรูปด้านบน</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Lightbox ── */}
          {lightbox && (
            <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
              {/* ปุ่มปิด */}
              <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
              {/* ปุ่มเปิดใน Drive */}
              {lightbox.webViewLink && (
                <a href={lightbox.webViewLink} target="_blank" rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-medium transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                  เปิดใน Drive
                </a>
              )}
              <img
                src={`/api/crm/photos/file?clientId=${encodeURIComponent(clientId)}&fileId=${lightbox.id}`}
                alt={lightbox.name}
                className="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
                onClick={e => e.stopPropagation()}
              />
              <div className="absolute bottom-4 left-0 right-0 text-center text-white/60 text-xs">{lightbox.name}</div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-pink-100 flex-shrink-0">
          <BtnSecondary onClick={() => { onEdit(cust); onClose(); }} className="py-2.5 px-4 text-xs">แก้ไข</BtnSecondary>
          <BtnSecondary onClick={() => { onFollow(cust); onClose(); }} className="flex-1 py-2.5 gap-1.5 text-xs">
            <Ic d={IC.follow} cls="w-3.5 h-3.5"/>ติดตาม
          </BtnSecondary>
          <BtnPrimary onClick={() => { onBookApt(cust); onClose(); }} className="flex-1 py-2.5 gap-1.5 text-xs">
            <Ic d={IC.cal} cls="w-3.5 h-3.5"/>นัดหมาย
          </BtnPrimary>
        </div>
      </div>
    </div>
  );
}