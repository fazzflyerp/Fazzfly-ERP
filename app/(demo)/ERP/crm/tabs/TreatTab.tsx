"use client";
import { useState } from "react";
import { fmtDate } from "@/app/components/crm/crm.types";
import type { Customer } from "@/app/components/crm/crm.types";
import ImageUpload from "@/app/components/ImageUpload";

export interface Treatment {
  rowIndex?:      number;
  treatment_id:   string;
  created_at:     string;
  customer_id:    string;
  customer_name:  string;
  customer_phone: string;
  appointment_id: string;
  branch_id:      string;
  branch_name:    string;
  treatment_date: string;
  service:        string;
  doctor:         string;
  price:          number;
  notes:          string;
  before_photo:   string;
  after_photo:    string;
  created_by:     string;
}

interface Props {
  treatments:  Treatment[];
  customers:   Customer[];
  branchId:    string;
  branchName:  string;
  services:    string[];
  doctors:     string[];
  onSave:      (t: Partial<Treatment>, isEdit: boolean, rowIndex?: number) => Promise<void>;
}

const isImgUrl = (v: string) => v.startsWith("https://") && (v.includes("drive.google.com") || v.includes("googleusercontent"));

export default function TreatTab({ treatments, customers, branchId, branchName, services, doctors, onSave }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTreat, setEditTreat] = useState<Treatment | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const blank = (): Partial<Treatment> => ({
    customer_id: "", customer_name: "", customer_phone: "",
    treatment_date: new Date().toISOString().slice(0, 10),
    service: "", doctor: "", price: 0, notes: "", before_photo: "", after_photo: "",
    branch_id: branchId, branch_name: branchName,
  });
  const [form, setForm] = useState<Partial<Treatment>>(blank());

  const filtered = treatments.filter(t =>
    !q || t.customer_name.includes(q) || t.service.includes(q) || t.doctor.includes(q)
  );

  const openAdd = () => { setEditTreat(null); setForm(blank()); setOpen(true); };
  const openEdit = (t: Treatment) => { setEditTreat(t); setForm({ ...t }); setOpen(true); };
  const close = () => { setOpen(false); setEditTreat(null); setForm(blank()); };

  const custOpts = customers.filter(c => {
    const cb = (c as any).branch_id;
    return !cb || cb === branchId;
  });

  const handleCustChange = (id: string) => {
    const c = customers.find(x => x.customer_id === id);
    setForm(f => ({ ...f, customer_id: id, customer_name: c?.full_name || "", customer_phone: c?.phone_number || "" }));
  };

  const handleSave = async () => {
    if (!form.customer_id || !form.treatment_date || !form.service) {
      alert("กรุณากรอกลูกค้า วันที่ และบริการ"); return;
    }
    setSaving(true);
    try { await onSave(form, !!editTreat, editTreat?.rowIndex); close(); }
    catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาชื่อ บริการ แพทย์..."
            className="w-full pl-9 pr-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500/50 transition-colors" />
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold transition-colors shadow-lg shadow-rose-500/20">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          บันทึกการรักษา
        </button>
      </div>

      <p className="text-slate-600 text-xs">{filtered.length} รายการ</p>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-slate-600">
          <svg className="w-10 h-10 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <p className="text-sm">ยังไม่มีประวัติรักษา</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(t => (
            <div key={t.treatment_id} className="group bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.07] rounded-xl p-4 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-white font-semibold text-sm">{t.customer_name}</span>
                    <span className="text-rose-400/80 text-xs bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">{t.branch_name || t.branch_id}</span>
                  </div>
                  <p className="text-slate-300 text-sm">{t.service}</p>
                  <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                    <span>📅 {fmtDate(t.treatment_date)}</span>
                    {t.doctor && <span>👨‍⚕️ {t.doctor}</span>}
                    {t.price > 0 && <span className="text-emerald-400">฿{t.price.toLocaleString("th-TH")}</span>}
                  </div>
                  {t.notes && <p className="text-slate-600 text-xs mt-1 italic">{t.notes}</p>}
                </div>

                {/* Photos */}
                <div className="flex gap-2 flex-shrink-0">
                  {t.before_photo && isImgUrl(t.before_photo) && (
                    <button onClick={() => setLightbox(t.before_photo)} title="ก่อน"
                      className="relative w-14 h-14 rounded-lg overflow-hidden border border-white/10 hover:border-rose-500/50 transition-colors">
                      <img src={t.before_photo} alt="before" className="w-full h-full object-cover" />
                      <span className="absolute bottom-0 inset-x-0 text-[9px] text-center bg-black/60 text-slate-300 py-0.5">ก่อน</span>
                    </button>
                  )}
                  {t.after_photo && isImgUrl(t.after_photo) && (
                    <button onClick={() => setLightbox(t.after_photo)} title="หลัง"
                      className="relative w-14 h-14 rounded-lg overflow-hidden border border-white/10 hover:border-emerald-500/50 transition-colors">
                      <img src={t.after_photo} alt="after" className="w-full h-full object-cover" />
                      <span className="absolute bottom-0 inset-x-0 text-[9px] text-center bg-black/60 text-slate-300 py-0.5">หลัง</span>
                    </button>
                  )}
                </div>

                {/* Edit */}
                <button onClick={() => openEdit(t)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto" onClick={close}>
          <div className="bg-[#131929] border border-white/10 rounded-2xl w-full max-w-lg my-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-white/[0.07]">
              <h3 className="text-white font-bold">{editTreat ? "แก้ไขประวัติรักษา" : "บันทึกการรักษา"}</h3>
              <button onClick={close} className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/10 flex items-center justify-center text-slate-400 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Customer */}
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1.5 block">ลูกค้า *</label>
                <select value={form.customer_id} onChange={e => handleCustChange(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500/50">
                  <option value="">— เลือกลูกค้า —</option>
                  {custOpts.map(c => <option key={c.customer_id} value={c.customer_id}>{c.full_name} ({c.phone_number})</option>)}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1.5 block">วันที่รักษา *</label>
                <input type="date" value={form.treatment_date} onChange={e => setForm(f => ({ ...f, treatment_date: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500/50" />
              </div>

              {/* Service + Doctor */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1.5 block">บริการ *</label>
                  <input list="services-list" value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))}
                    placeholder="เลือกหรือพิมพ์บริการ"
                    className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500/50" />
                  <datalist id="services-list">{services.map(s => <option key={s} value={s}/>)}</datalist>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1.5 block">แพทย์</label>
                  <input list="doctors-list" value={form.doctor} onChange={e => setForm(f => ({ ...f, doctor: e.target.value }))}
                    placeholder="เลือกหรือพิมพ์ชื่อ"
                    className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500/50" />
                  <datalist id="doctors-list">{doctors.map(d => <option key={d} value={d}/>)}</datalist>
                </div>
              </div>

              {/* Price + Notes */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1.5 block">ราคา (บาท)</label>
                  <input type="number" value={form.price || ""} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))}
                    placeholder="0"
                    className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500/50" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1.5 block">หมายเหตุ</label>
                  <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="บันทึก..."
                    className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500/50" />
                </div>
              </div>

              {/* Photos */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-2 block">📸 รูปก่อน</label>
                  <ImageUpload fieldName="before_photo" label="รูปก่อน" required={false}
                    value={form.before_photo} onChange={url => setForm(f => ({ ...f, before_photo: url }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-2 block">✨ รูปหลัง</label>
                  <ImageUpload fieldName="after_photo" label="รูปหลัง" required={false}
                    value={form.after_photo} onChange={url => setForm(f => ({ ...f, after_photo: url }))} />
                </div>
              </div>

              {/* Branch info */}
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/5 border border-rose-500/10">
                <svg className="w-4 h-4 text-rose-400/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                <span className="text-rose-400/80 text-xs">บันทึกใต้สาขา: <strong>{branchName || branchId}</strong></span>
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t border-white/[0.07]">
              <button onClick={close} className="flex-1 py-2.5 rounded-xl bg-white/[0.06] text-slate-400 text-sm font-semibold hover:bg-white/10 transition-colors">
                ยกเลิก
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 shadow-lg shadow-rose-500/20">
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4" onClick={() => setLightbox(null)}>
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setLightbox(null)} className="absolute -top-3 -right-3 z-10 w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
            <img src={lightbox} alt="" className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl mx-auto block" />
            <a href={lightbox} target="_blank" rel="noopener noreferrer"
              className="block text-center mt-3 text-xs text-slate-500 hover:text-slate-300 transition-colors">เปิดในแท็บใหม่ ↗</a>
          </div>
        </div>
      )}
    </div>
  );
}
