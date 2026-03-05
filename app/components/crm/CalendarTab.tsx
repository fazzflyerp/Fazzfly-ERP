// app/components/crm/CalendarTab.tsx
"use client";
import { Ic, IC, Badge } from "@/app/components/crm/crm.ui";
import { S_CFG, TH_M_LONG, TH_DAYS, makeDStr, fmtDate } from "@/app/components/crm/crm.types";
import type { Appointment } from "@/app/components/crm/crm.types";

interface Props {
  apts: Appointment[];
  calY: number; calM: number;
  calDays: (number | 0)[];
  selDate: string;
  selApts: Appointment[];
  setSelDate: (d: string) => void;
  setCalY: (y: number) => void;
  setCalM: (m: number) => void;
  cntDate: (d: string) => number;
  isTodayC: (d: number) => boolean;
  isSelC: (d: number) => boolean;
  openApt: (date?: string) => void;
  setDApt: (a: Appointment) => void;
}

export default function CalendarTab({
  apts, calY, calM, calDays, selDate, selApts,
  setSelDate, setCalY, setCalM,
  cntDate, isTodayC, isSelC, openApt, setDApt,
}: Props) {
  return (
    <div className="animate-fadeIn">
      <div className="grid grid-cols-2 gap-4">

        {/* ── Left ── */}
        <div className="space-y-3">

          {/* Calendar card */}
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg shadow-pink-100/50 border border-pink-200 overflow-hidden">
            <div className="flex items-center justify-between px-3 pt-3 pb-2">
              <button onClick={() => { const d = new Date(calY, calM-1); setCalY(d.getFullYear()); setCalM(d.getMonth()); }}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-700 transition-colors">
                <Ic d={IC.chL} cls="w-4 h-4"/>
              </button>
              <div className="text-center">
                <p className="text-xs font-bold text-slate-800">{TH_M_LONG[calM]}</p>
                <p className="text-[10px] text-slate-700 font-medium">{calY+543}</p>
              </div>
              <button onClick={() => { const d = new Date(calY, calM+1); setCalY(d.getFullYear()); setCalM(d.getMonth()); }}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-700 transition-colors">
                <Ic d={IC.chR} cls="w-4 h-4"/>
              </button>
            </div>

            <div className="grid grid-cols-7 px-2">
              {TH_DAYS.map(d => <p key={d} className="text-center text-[9px] font-bold text-slate-700 py-0.5">{d}</p>)}
            </div>

            <div className="grid grid-cols-7 px-2 pb-2">
              {calDays.map((day, i) => {
                if (!day) return <div key={`e${i}`}/>;
                const dk  = makeDStr(calY, calM, day as number);
                const cnt = cntDate(dk);
                const sel = isSelC(day as number);
                const tod = isTodayC(day as number);
                return (
                  <button key={day} onClick={() => setSelDate(dk)}
                    className="aspect-square rounded-lg flex flex-col items-center justify-center text-[11px] font-semibold relative transition-all"
                    style={{
                      background: sel ? "linear-gradient(135deg,#f43f5e,#ec4899)" : tod ? "#fff5f6" : "transparent",
                      color: sel ? "#fff" : tod ? "#f43f5e" : "#374151",
                      fontWeight: sel || tod ? 700 : 500,
                      outline: tod && !sel ? "1.5px solid #f43f5e" : "none",
                      outlineOffset: -1,
                      boxShadow: sel ? "0 2px 8px rgba(244,63,94,.35)" : "none",
                    }}>
                    {day}
                    {cnt > 0 && (
                      <span className="absolute bottom-0.5 flex gap-[2px]">
                        {Array.from({ length: Math.min(cnt, 3) }).map((_, j) => (
                          <span key={j} className="w-0.5 h-0.5 rounded-full" style={{ background: sel ? "rgba(255,255,255,.8)" : "#f43f5e" }}/>
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Month stats */}
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-md shadow-pink-100/50 border border-pink-200 px-3 py-3">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">สรุปเดือนนี้</p>
            <div className="space-y-1.5">
              {(["confirmed","done","no-show","cancelled"] as Appointment["status"][]).map(s => {
                const n = apts.filter(a => {
                  const d = new Date(a.appointment_date);
                  return d.getMonth() === calM && d.getFullYear() === calY && a.status === s;
                }).length;
                return n > 0 ? (
                  <div key={s} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: S_CFG[s].dot }}/>
                      <span className="text-[11px] text-slate-600">{S_CFG[s].l}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-700">{n}</span>
                  </div>
                ) : null;
              })}
            </div>
          </div>

          <button onClick={() => openApt(selDate)}
            className="w-full px-4 py-2.5 bg-pink-500 hover:bg-pink-600 text-white rounded-xl font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2">
            <Ic d={IC.plus} cls="w-4 h-4"/>
            นัดหมายใหม่
          </button>
        </div>

        {/* ── Right: timeline ── */}
        <div className="min-w-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-base font-bold text-slate-800">{fmtDate(selDate)}</p>
              <p className="text-xs text-slate-600 mt-0.5">
                {selApts.length > 0 ? `${selApts.length} นัดหมาย` : "วันว่าง"}
              </p>
            </div>
            <button onClick={() => openApt(selDate)}
              className="flex items-center gap-1 px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white rounded-xl text-xs font-semibold shadow-sm transition-all">
              <Ic d={IC.plus} cls="w-3.5 h-3.5"/>เพิ่มนัด
            </button>
          </div>

          {selApts.length === 0 ? (
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-dashed border-pink-200 flex flex-col items-center justify-center py-10 gap-2">
              <p className="text-sm text-slate-600">ไม่มีนัดหมายวันนี้</p>
              <button onClick={() => openApt(selDate)} className="text-xs font-semibold text-slate-800 hover:text-slate-600 underline transition-colors">
                + เพิ่มนัดหมาย
              </button>
            </div>
          ) : (
            <div className="relative space-y-3">
              <div className="absolute left-[62px] top-0 bottom-4 w-px" style={{ background: "linear-gradient(180deg,#fce7f3,transparent)" }}/>
              {selApts.map(apt => {
                const cfg = S_CFG[apt.status];
                return (
                  <div key={apt.appointment_id} className="flex items-start gap-4">
                    <div className="w-[62px] flex-shrink-0 text-right pt-3.5">
                      <p className="text-xs font-bold text-slate-700 leading-tight">{apt.appointment_time}</p>
                      <p className="text-[10px] text-slate-600 leading-tight">{apt.end_time}</p>
                    </div>
                    <div className="flex-shrink-0 pt-[18px]" style={{ marginLeft: "-0.5px" }}>
                      <span className="w-2.5 h-2.5 block rounded-full border-2 border-white shadow-sm" style={{ background: cfg.dot }}/>
                    </div>
                    <button onClick={() => setDApt(apt)}
                      className="flex-1 min-w-0 text-left bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg shadow-pink-50 p-4 border border-pink-200 hover:shadow-2xl hover:shadow-pink-100 hover:-translate-y-1 transition-all duration-300 group">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-slate-800 group-hover:text-rose-500 transition-colors">{apt.customer_name}</p>
                            <Badge label={cfg.l} bg={cfg.bg} text={cfg.text}/>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5">{apt.customer_phone}</p>
                        </div>
                        {apt.price > 0 && <p className="text-sm font-bold text-rose-500 flex-shrink-0">฿{apt.price.toLocaleString()}</p>}
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold text-white" style={{ background: "#e11d48" }}>{apt.service}</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{apt.doctor}</span>
                        {apt.deposit > 0 && <span className="text-xs px-2.5 py-0.5 rounded-full bg-pink-50 text-pink-500 font-medium">มัดจำ ฿{apt.deposit.toLocaleString()}</span>}
                      </div>
                      {apt.notes && <p className="text-xs text-slate-600 mt-2 italic line-clamp-1">"{apt.notes}"</p>}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}