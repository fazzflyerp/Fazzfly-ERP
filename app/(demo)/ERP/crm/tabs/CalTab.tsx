"use client";
import { TH_M_SHORT, TH_DAYS, makeDStr, getDays, getFirst, fmtDate } from "@/app/components/crm/crm.types";
import type { Appointment } from "@/app/components/crm/crm.types";

// ── Branch color palette (เปลี่ยนสีตามสาขา) ──────────────────────────────────
export const BRANCH_PALETTE = [
  { bg: "bg-rose-500/15",    text: "text-rose-400",    border: "border-rose-500/20"    },
  { bg: "bg-blue-500/15",    text: "text-blue-400",    border: "border-blue-500/20"    },
  { bg: "bg-violet-500/15",  text: "text-violet-400",  border: "border-violet-500/20"  },
  { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/20" },
  { bg: "bg-amber-500/15",   text: "text-amber-400",   border: "border-amber-500/20"   },
  { bg: "bg-cyan-500/15",    text: "text-cyan-400",    border: "border-cyan-500/20"    },
  { bg: "bg-orange-500/15",  text: "text-orange-400",  border: "border-orange-500/20"  },
  { bg: "bg-indigo-500/15",  text: "text-indigo-400",  border: "border-indigo-500/20"  },
];
const NO_BRANCH_CLS = { bg: "bg-slate-500/10", text: "text-slate-500", border: "border-slate-500/15" };

export function getBranchCls(branchId: string, allBranches: { branchId: string }[]) {
  if (!branchId) return NO_BRANCH_CLS;
  const idx = allBranches.findIndex(b => b.branchId === branchId);
  return BRANCH_PALETTE[(idx >= 0 ? idx : 0) % BRANCH_PALETTE.length];
}

const APT_STATUS: Record<string, { label: string; dot: string; cls: string }> = {
  pending:      { label: "รอยืนยัน",   dot: "bg-amber-400",   cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  confirmed:    { label: "ยืนยัน",     dot: "bg-blue-400",    cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  "in-progress":{ label: "กำลังทำ",   dot: "bg-violet-400",  cls: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  done:         { label: "เสร็จ",      dot: "bg-emerald-400", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  cancelled:    { label: "ยกเลิก",    dot: "bg-red-400",     cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  "no-show":    { label: "ไม่มา",      dot: "bg-slate-400",   cls: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
};

// ── Booking Request type (จาก LIFF / ลูกค้าจองเอง) ────────────────────────────
export interface BookingRequest {
  id:           string;
  customer_name: string;
  customer_phone?: string;
  service:      string;
  preferred_date: string;   // YYYY-MM-DD
  preferred_time: string;   // HH:mm
  notes?:       string;
  status:       "pending" | "accepted" | "rejected";
  created_at:   string;
  source?:      string;     // "liff" | "line" | "web" | …
}

const REQ_SOURCE_CFG: Record<string, { label: string; cls: string }> = {
  liff:    { label: "LIFF",    cls: "bg-green-500/15 text-green-400 border-green-500/30" },
  line:    { label: "LINE",    cls: "bg-green-500/15 text-green-400 border-green-500/30" },
  web:     { label: "Web",     cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  default: { label: "Request", cls: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
};

interface Props {
  apts:           Appointment[];
  calY:           number; calM: number;
  selDate:        string;
  setSelDate:     (d: string) => void;
  setCalY:        (y: number) => void;
  setCalM:        (m: number) => void;
  onOpenApt:      (date?: string) => void;
  onEditApt:      (a: Appointment) => void;
  onStatusChange: (a: Appointment, s: Appointment["status"]) => void;
  isSuperAdmin?:  boolean;
  allBranches?:   { branchId: string; branchName: string }[];
  // ── Booking requests (optional — ยังไม่มีข้อมูลจริง)
  requests?:      BookingRequest[];
  onAcceptRequest?: (r: BookingRequest) => void;
  onRejectRequest?: (r: BookingRequest) => void;
}

export default function CalTab({
  apts, calY, calM, selDate, setSelDate, setCalY, setCalM,
  onOpenApt, onEditApt, onStatusChange,
  isSuperAdmin = false,
  allBranches = [],
  requests = [],
  onAcceptRequest,
  onRejectRequest,
}: Props) {
  const branchName = (bid: string) => allBranches.find(b => b.branchId === bid)?.branchName || bid;
  const now     = new Date();
  const calDays = [...Array(getFirst(calY, calM)).fill(0), ...Array.from({ length: getDays(calY, calM) }, (_, i) => i + 1)];
  const selApts = apts.filter(a => a.appointment_date === selDate).sort((a, b) => a.appointment_time.localeCompare(b.appointment_time));
  const cntDate = (d: number) => apts.filter(a => a.appointment_date === makeDStr(calY, calM, d)).length;
  const isToday = (d: number) => now.getFullYear() === calY && now.getMonth() === calM && now.getDate() === d;
  const isSel   = (d: number) => makeDStr(calY, calM, d) === selDate;

  const prevMonth = () => { if (calM === 0) { setCalY(calY - 1); setCalM(11); } else setCalM(calM - 1); };
  const nextMonth = () => { if (calM === 11) { setCalY(calY + 1); setCalM(0); } else setCalM(calM + 1); };

  const pendingReqs = requests.filter(r => r.status === "pending");

  return (
    <div className="space-y-5">
      {/* ── Top row: Calendar + Appointment list ─────────────────────────────── */}
      <div className="grid lg:grid-cols-[340px_1fr] gap-5">

        {/* ── Calendar grid ── */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="w-8 h-8 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center text-slate-300 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            </button>
            <span className="text-white font-bold text-base">{TH_M_SHORT[calM]} {calY + 543}</span>
            <button onClick={nextMonth} className="w-8 h-8 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center text-slate-300 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {TH_DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-slate-500 py-1">{d}</div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-0.5">
            {calDays.map((d, i) => {
              if (!d) return <div key={`e${i}`} />;
              const cnt   = cntDate(d);
              const today = isToday(d);
              const sel   = isSel(d);
              return (
                <button key={d} onClick={() => setSelDate(makeDStr(calY, calM, d))}
                  className={`relative aspect-square rounded-xl flex flex-col items-center justify-center text-sm font-medium transition-all
                    ${sel    ? "bg-rose-500 text-white shadow-lg shadow-rose-500/30"
                    : today  ? "bg-white/[0.1] text-rose-400 ring-1 ring-rose-500/40"
                    :          "hover:bg-white/[0.06] text-slate-300"}`}>
                  {d}
                  {cnt > 0 && (
                    <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center
                      ${sel ? "bg-white/30 text-white" : "bg-rose-500/80 text-white"}`}>
                      {cnt}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick add */}
          <button onClick={() => onOpenApt(selDate)}
            className="mt-4 w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-sm font-semibold transition-colors flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            เพิ่มนัดหมาย {fmtDate(selDate)}
          </button>
        </div>

        {/* ── Appointment list ── */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-bold text-base">นัดหมาย {fmtDate(selDate)}</h3>
              <p className="text-slate-500 text-xs mt-0.5">{selApts.length} รายการ</p>
            </div>
            <button onClick={() => onOpenApt(selDate)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold transition-colors shadow-lg shadow-rose-500/20">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              เพิ่ม
            </button>
          </div>

          {selApts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-600">
              <svg className="w-10 h-10 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              <p className="text-sm">ไม่มีนัดหมายวันนี้</p>
            </div>
          ) : (
            <div className="space-y-3">
              {selApts.map(a => {
                const sc = APT_STATUS[a.status] || APT_STATUS.pending;
                return (
                  <div key={a.appointment_id} className="group flex items-start gap-4 p-4 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] transition-colors">
                    {/* Time */}
                    <div className="text-center min-w-[44px]">
                      <p className="text-rose-400 font-bold text-sm tabular-nums">{a.appointment_time}</p>
                      <p className="text-slate-600 text-[10px]">{a.end_time}</p>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-white font-semibold text-sm truncate">{a.customer_name}</p>
                        <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border ${sc.cls}`}>{sc.label}</span>
                      </div>
                      <p className="text-slate-400 text-xs truncate">{a.service}</p>
                      {a.doctor && <p className="text-slate-600 text-[11px] mt-0.5">👨‍⚕️ {a.doctor}</p>}
                      {a.notes  && <p className="text-slate-600 text-[11px] mt-0.5 italic truncate">{a.notes}</p>}
                      {isSuperAdmin && (() => {
                        const bid = (a as any).branch_id || "";
                        const cls = getBranchCls(bid, allBranches);
                        return (
                          <span className={`inline-block mt-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${cls.bg} ${cls.text} ${cls.border}`}>
                            📍 {bid ? branchName(bid) : "ไม่ระบุสาขา"}
                          </span>
                        );
                      })()}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onEditApt(a)} title="แก้ไข"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                      </button>
                      {a.status !== "done" && (
                        <button onClick={() => onStatusChange(a, "done")} title="เสร็จแล้ว"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Booking Requests panel (จาก LIFF / ลูกค้าจองเอง) ─────────────────── */}
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
        {/* Panel header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            {/* LINE-ish icon */}
            <div className="w-7 h-7 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
              </svg>
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">Request จากลูกค้า</h3>
              <p className="text-slate-500 text-[11px]">คำขอจอง LIFF / LINE OA</p>
            </div>
            {pendingReqs.length > 0 && (
              <span className="ml-1 min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                {pendingReqs.length}
              </span>
            )}
          </div>

          {/* Future: refresh / filter buttons */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-600 bg-white/[0.04] border border-white/[0.06] px-2 py-1 rounded-lg">
              {requests.length === 0 ? "ยังไม่มีข้อมูล" : `${requests.length} รายการ`}
            </span>
          </div>
        </div>

        {/* Request list */}
        {requests.length === 0 ? (
          /* ── Empty state ── */
          <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
              </svg>
            </div>
            <p className="text-slate-400 text-sm font-semibold mb-1">ยังไม่มี Request</p>
            <p className="text-slate-600 text-xs leading-relaxed max-w-xs">
              เมื่อลูกค้าจองผ่าน LIFF หรือ LINE OA<br/>
              คำขอจะปรากฏที่นี่รอการยืนยันจากเจ้าหน้าที่
            </p>
            {/* Placeholder columns hint */}
            <div className="mt-6 w-full max-w-lg">
              <div className="grid grid-cols-5 gap-2 text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2 px-3">
                <span>ลูกค้า</span>
                <span>บริการ</span>
                <span>วัน-เวลา</span>
                <span className="text-center">ช่องทาง</span>
                <span className="text-right">action</span>
              </div>
              {/* Ghost rows */}
              {[1, 2, 3].map(i => (
                <div key={i} className="grid grid-cols-5 gap-2 items-center px-3 py-3 rounded-xl border border-white/[0.04] mb-1.5"
                  style={{ opacity: 1 - i * 0.25 }}>
                  <div className="h-3 bg-white/[0.05] rounded-full" style={{ width: `${70 - i * 10}%` }} />
                  <div className="h-3 bg-white/[0.05] rounded-full" style={{ width: `${65 - i * 8}%` }} />
                  <div className="h-3 bg-white/[0.05] rounded-full w-4/5" />
                  <div className="flex justify-center"><div className="h-4 w-10 bg-white/[0.05] rounded-full" /></div>
                  <div className="flex justify-end gap-1">
                    <div className="h-6 w-8 bg-white/[0.05] rounded-lg" />
                    <div className="h-6 w-8 bg-white/[0.05] rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ── Request rows ── */
          <div>
            {/* Column headers */}
            <div className="hidden sm:grid grid-cols-[1fr_1fr_140px_80px_100px] gap-3 px-5 py-2.5 text-[10px] font-semibold text-slate-600 uppercase tracking-wider border-b border-white/[0.04]">
              <span>ลูกค้า</span>
              <span>บริการ</span>
              <span>วัน-เวลาที่ต้องการ</span>
              <span className="text-center">ช่องทาง</span>
              <span className="text-right">action</span>
            </div>

            <div className="divide-y divide-white/[0.04]">
              {requests.map(r => {
                const srcKey = r.source || "default";
                const src    = REQ_SOURCE_CFG[srcKey] || REQ_SOURCE_CFG.default;
                const isPending = r.status === "pending";
                return (
                  <div key={r.id}
                    className={`flex sm:grid sm:grid-cols-[1fr_1fr_140px_80px_100px] gap-3 items-center px-5 py-3.5 transition-colors
                      ${isPending ? "hover:bg-white/[0.025]" : "opacity-50"}`}>

                    {/* ลูกค้า */}
                    <div className="min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{r.customer_name}</p>
                      {r.customer_phone && <p className="text-slate-500 text-[11px]">{r.customer_phone}</p>}
                    </div>

                    {/* บริการ */}
                    <div className="min-w-0 hidden sm:block">
                      <p className="text-slate-300 text-xs truncate">{r.service || "—"}</p>
                      {r.notes && <p className="text-slate-600 text-[11px] italic truncate">{r.notes}</p>}
                    </div>

                    {/* วัน-เวลา */}
                    <div className="hidden sm:block text-xs text-slate-400">
                      <p className="font-semibold text-slate-300">{fmtDate(r.preferred_date)}</p>
                      <p>{r.preferred_time} น.</p>
                    </div>

                    {/* ช่องทาง */}
                    <div className="hidden sm:flex justify-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${src.cls}`}>
                        {src.label}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1.5 flex-shrink-0 ml-auto sm:ml-0">
                      {isPending && onAcceptRequest && (
                        <button onClick={() => onAcceptRequest(r)} title="รับนัด"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-[11px] font-semibold transition-colors border border-emerald-500/20">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                          รับ
                        </button>
                      )}
                      {isPending && onRejectRequest && (
                        <button onClick={() => onRejectRequest(r)} title="ปฏิเสธ"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] font-semibold transition-colors border border-red-500/20">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
                          ปฏิเสธ
                        </button>
                      )}
                      {r.status === "accepted" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">✓ รับแล้ว</span>
                      )}
                      {r.status === "rejected" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/15 text-slate-500 border border-slate-500/20">ปฏิเสธ</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
