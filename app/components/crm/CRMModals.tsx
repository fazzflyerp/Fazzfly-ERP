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
      <div className="px-6 py-4 grid grid-cols-2 gap-3">
        {sorted.map(renderField)}
      </div>
      <div className="flex gap-3 px-6 pb-6">
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
      <div className="px-6 py-4 grid grid-cols-2 gap-3">
        {sorted.map(renderField)}
      </div>
      <div className="flex gap-3 px-6 pb-6">
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
      <div className="px-6 py-4 grid grid-cols-2 gap-3">
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
      <div className="flex gap-3 px-6 pb-6">
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
      <div className="flex items-center justify-between px-6 py-4 border-b border-pink-200">
        <Badge label={S_CFG[apt.status].l} bg={S_CFG[apt.status].bg} text={S_CFG[apt.status].text}/>
        <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div className="px-6 py-4 space-y-4">
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
      <div className="flex gap-3 px-6 pb-6">
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
interface CustDetailProps {
  cust: Customer | null; onClose: () => void;
  courses: Course[]; apts: Appointment[];
  onEdit: (c: Customer) => void;
  onFollow: (c: Customer) => void;
  onBookApt: (c: Customer) => void;
}
export function CustDetailPanel({ cust, onClose, courses, apts, onEdit, onFollow, onBookApt }: CustDetailProps) {
  if (!cust) return null;
  const ml  = cust.member_level || "ทั่วไป";
  const mcf = MEMBER_CFG[ml] || MEMBER_CFG["ทั่วไป"];
  const actCourses = courses.filter(c => c.customer_id === cust.customer_id && c.status === "active");
  const custApts   = apts.filter(a => a.customer_id === cust.customer_id).sort((a, b) => b.appointment_date.localeCompare(a.appointment_date)).slice(0, 4);

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center gap-3 px-6 py-4 border-b border-pink-200">
        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${mcf.grad} flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-md`}>
          {cust.full_name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800">{cust.full_name}</p>
          {cust.nickname && <p className="text-xs text-slate-600">({cust.nickname})</p>}
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div className="px-6 py-4 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {[
            {l:"เบอร์โทร", v:cust.phone_number},
            {l:"LINE",     v:cust.line_id||"-"},
            {l:"เพศ",      v:cust.gender||"-"},
            {l:"วันเกิด",  v:fmtDate(cust.birthdate)||"-"},
            {l:"ผิว",      v:cust.skin_type||"-"},
            {l:"สมาชิก",  v:cust.member_level||"ทั่วไป"},
          ].map(({l,v}) => (
            <div key={l} className="bg-pink-50/60 rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-pink-500 mb-0.5">{l}</p>
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

        {actCourses.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-pink-500 mb-2">คอร์สที่ใช้งาน</p>
            <div className="space-y-2">
              {actCourses.map(co => (
                <div key={co.course_id} className="bg-pink-50/60 rounded-xl p-3">
                  <div className="flex justify-between mb-1.5">
                    <p className="text-xs font-bold text-rose-500">{co.course_name}</p>
                    <span className="text-xs font-bold text-rose-500">{co.remaining_sessions} ครั้ง</span>
                  </div>
                  <div className="h-1.5 bg-pink-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min((co.used_sessions/co.total_sessions)*100,100)}%`, background: "linear-gradient(90deg,#f43f5e,#ec4899)" }}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {custApts.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-pink-500 mb-2">ประวัตินัดหมาย</p>
            <div className="space-y-1.5">
              {custApts.map(a => (
                <div key={a.appointment_id} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-700">{fmtDate(a.appointment_date)} · {a.appointment_time}</p>
                    <p className="text-xs text-slate-600">{a.service}</p>
                  </div>
                  <Badge label={S_CFG[a.status].l} bg={S_CFG[a.status].bg} text={S_CFG[a.status].text}/>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-2 px-6 pb-6">
        <BtnSecondary onClick={() => { onEdit(cust); onClose(); }} className="py-2.5 px-4">แก้ไข</BtnSecondary>
        <BtnSecondary onClick={() => { onFollow(cust); onClose(); }} className="flex-1 py-2.5 gap-2">
          <Ic d={IC.follow} cls="w-4 h-4"/>ติดตาม
        </BtnSecondary>
        <BtnPrimary onClick={() => { onBookApt(cust); onClose(); }} className="flex-1 py-2.5 gap-2">
          <Ic d={IC.cal} cls="w-4 h-4"/>นัดหมาย
        </BtnPrimary>
      </div>
    </Modal>
  );
}