// app/components/crm/CalendarTab.tsx
"use client";
import { useState, useMemo, useRef, useEffect } from "react";
import { Ic, IC, Badge } from "@/app/components/crm/crm.ui";
import { S_CFG, TH_M_LONG, TH_DAYS, makeDStr, fmtDate, pad2, todayStr } from "@/app/components/crm/crm.types";
import type { Appointment } from "@/app/components/crm/crm.types";
import { SCHED_TYPES, type Employee, type ScheduleEntry } from "@/app/components/StaffCalendar";

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
  employees: Employee[];
  schedule: ScheduleEntry[];
  spreadsheetId: string;
  onScheduleChange: () => void;
}

type ViewMode = "day" | "week";

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 07:00–21:00
const HOUR_H = 64; // px per hour
const GRID_START = 7 * 60; // 420 min
const TIME_W = 52; // px, time label column
const TH_DAYS_FULL = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];

const APT_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  confirmed: { bg: "rgba(225,29,72,0.10)",  border: "#e11d48", label: "#9f1239" },
  done:      { bg: "rgba(22,163,74,0.10)",   border: "#16a34a", label: "#14532d" },
  "no-show": { bg: "rgba(100,116,139,0.10)", border: "#64748b", label: "#334155" },
  cancelled: { bg: "rgba(234,88,12,0.10)",   border: "#ea580c", label: "#7c2d12" },
  pending:   { bg: "rgba(168,85,247,0.10)",  border: "#a855f7", label: "#581c87" },
};

function parseMin(t?: string): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function getWeekDays(dateStr: string): string[] {
  const d = new Date(dateStr + "T12:00:00");
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  return Array.from({ length: 7 }, (_, i) => shiftDate(dateStr, diff + i));
}

interface LayoutApt extends Appointment { col: number; colTotal: number; }

function layoutDay(dayApts: Appointment[]): LayoutApt[] {
  const sorted = [...dayApts].sort((a, b) => parseMin(a.appointment_time) - parseMin(b.appointment_time));
  const colEnds: number[] = [];
  const placed: LayoutApt[] = sorted.map(apt => {
    const s = parseMin(apt.appointment_time);
    const e = Math.max(s + 30, parseMin(apt.end_time));
    let col = colEnds.findIndex(end => end <= s);
    if (col === -1) col = colEnds.length;
    colEnds[col] = e;
    return { ...apt, col, colTotal: 1 };
  });
  placed.forEach(apt => {
    const s = parseMin(apt.appointment_time);
    const e = Math.max(s + 30, parseMin(apt.end_time));
    apt.colTotal = Math.max(1, placed.filter(b => {
      const bs = parseMin(b.appointment_time);
      const be = Math.max(bs + 30, parseMin(b.end_time));
      return bs < e && be > s;
    }).length);
  });
  return placed;
}

// ── Mini Calendar (reused in both desktop sidebar and mobile bottom) ────────
function MiniCal({ calY, calM, calDays, isTodayC, isSelC, cntDate, makeDStr, setSelDate, setCalY, setCalM, setView }: {
  calY: number; calM: number; calDays: (number | 0)[];
  isTodayC: (d: number) => boolean; isSelC: (d: number) => boolean;
  cntDate: (d: string) => number;
  makeDStr: (y: number, m: number, d: number) => string;
  setSelDate: (d: string) => void;
  setCalY: (y: number) => void; setCalM: (m: number) => void;
  setView: (v: ViewMode) => void;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-md shadow-pink-50 border border-pink-200 overflow-hidden">
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <button onClick={() => { const d = new Date(calY, calM - 1); setCalY(d.getFullYear()); setCalM(d.getMonth()); }}
          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors">
          <Ic d={IC.chL} cls="w-4 h-4"/>
        </button>
        <div className="text-center">
          <p className="text-xs font-bold text-slate-800">{TH_M_LONG[calM]}</p>
          <p className="text-[10px] text-slate-500">{calY + 543}</p>
        </div>
        <button onClick={() => { const d = new Date(calY, calM + 1); setCalY(d.getFullYear()); setCalM(d.getMonth()); }}
          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors">
          <Ic d={IC.chR} cls="w-4 h-4"/>
        </button>
      </div>
      <div className="grid grid-cols-7 px-2">
        {TH_DAYS.map(d => <p key={d} className="text-center text-[9px] font-bold text-slate-400 py-0.5">{d}</p>)}
      </div>
      <div className="grid grid-cols-7 px-2 pb-2 gap-y-0.5">
        {calDays.map((day, i) => {
          if (!day) return <div key={`e${i}`}/>;
          const dk = makeDStr(calY, calM, day as number);
          const cnt = cntDate(dk);
          const sel = isSelC(day as number);
          const tod = isTodayC(day as number);
          return (
            <button key={day} onClick={() => { setSelDate(dk); setView("day"); }}
              className="aspect-square rounded-lg flex flex-col items-center justify-center text-[11px] font-semibold relative transition-all"
              style={{
                background: sel ? "linear-gradient(135deg,#f43f5e,#ec4899)" : tod ? "#fff5f6" : "transparent",
                color: sel ? "#fff" : tod ? "#f43f5e" : "#374151",
                outline: tod && !sel ? "1.5px solid #fda4af" : "none",
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
  );
}

export default function CalendarTab({
  apts, calY, calM, calDays, selDate, selApts,
  setSelDate, setCalY, setCalM,
  cntDate, isTodayC, isSelC, openApt, setDApt,
  employees, schedule, spreadsheetId, onScheduleChange,
}: Props) {
  const hasEmployees = employees.length > 0;
  const [view, setView] = useState<ViewMode>("day");
  const gridRef = useRef<HTMLDivElement>(null);
  const today = todayStr();

  const [nowMin, setNowMin] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });
  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date();
      setNowMin(n.getHours() * 60 + n.getMinutes());
    }, 60000);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll to current time
  useEffect(() => {
    if (!gridRef.current) return;
    const top = Math.max(0, ((nowMin - GRID_START) / 60 * HOUR_H) - 80);
    gridRef.current.scrollTop = top;
  }, [view]);

  const weekDays = useMemo(() => getWeekDays(selDate), [selDate]);
  const dayLayout = useMemo(() => layoutDay(selApts), [selApts]);
  const weekAptsByDate = useMemo(() => {
    const map: Record<string, LayoutApt[]> = {};
    weekDays.forEach(d => { map[d] = layoutDay(apts.filter(a => a.appointment_date === d)); });
    return map;
  }, [apts, weekDays]);

  const selDateObj = new Date(selDate + "T12:00:00");

  return (
    <div className="animate-fadeIn flex flex-col lg:flex-row gap-4 lg:gap-6">

      {/* ── Left sidebar (desktop only) ── */}
      <div className="hidden lg:flex flex-col gap-3 w-60 flex-shrink-0">
        <MiniCal {...{ calY, calM, calDays, isTodayC, isSelC, cntDate, makeDStr, setSelDate, setCalY, setCalM, setView }}/>

        {/* Month stats */}
        <div className="bg-white rounded-2xl shadow-md shadow-pink-50 border border-pink-200 px-3 py-3">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">สรุปเดือนนี้</p>
          <div className="space-y-1.5">
            {(["confirmed","done","no-show","cancelled"] as Appointment["status"][]).map(s => {
              const n = apts.filter(a => {
                const d = new Date(a.appointment_date);
                return d.getMonth() === calM && d.getFullYear() === calY && a.status === s;
              }).length;
              return n > 0 ? (
                <div key={s} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: S_CFG[s]?.dot }}/>
                    <span className="text-xs text-slate-600">{S_CFG[s]?.l}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-700">{n}</span>
                </div>
              ) : null;
            })}
          </div>
        </div>

        <button onClick={() => openApt(selDate)}
          className="w-full px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2">
          <Ic d={IC.plus} cls="w-4 h-4"/>นัดหมายใหม่
        </button>
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 min-w-0 flex flex-col gap-3">

        {/* Top bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            {(["day","week"] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={view === v
                  ? { background: "white", color: "#e11d48", boxShadow: "0 1px 4px rgba(0,0,0,.10)" }
                  : { color: "#64748b" }}>
                {v === "day" ? "รายวัน" : "รายสัปดาห์"}
              </button>
            ))}
          </div>

          {/* Prev / Next */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelDate(view === "day" ? shiftDate(selDate, -1) : shiftDate(selDate, -7))}
              className="w-8 h-8 rounded-xl bg-white border border-slate-200 hover:border-pink-300 flex items-center justify-center text-slate-600 shadow-sm transition-all">
              <Ic d={IC.chL} cls="w-4 h-4"/>
            </button>
            <button
              onClick={() => setSelDate(view === "day" ? shiftDate(selDate, 1) : shiftDate(selDate, 7))}
              className="w-8 h-8 rounded-xl bg-white border border-slate-200 hover:border-pink-300 flex items-center justify-center text-slate-600 shadow-sm transition-all">
              <Ic d={IC.chR} cls="w-4 h-4"/>
            </button>
          </div>

          {/* Date label */}
          <p className="flex-1 min-w-0 text-base font-bold text-slate-800 truncate">
            {view === "day"
              ? `${TH_DAYS_FULL[selDateObj.getDay()]}ที่ ${fmtDate(selDate)}`
              : `${fmtDate(weekDays[0])} – ${fmtDate(weekDays[6])}`}
          </p>

          {/* Today + Add */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setSelDate(today)}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:border-pink-300 rounded-xl text-xs font-semibold text-slate-600 shadow-sm transition-all">
              วันนี้
            </button>
            <button onClick={() => openApt(selDate)}
              className="lg:hidden flex items-center gap-1 px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-semibold shadow-sm transition-all">
              <Ic d={IC.plus} cls="w-3.5 h-3.5"/>เพิ่ม
            </button>
          </div>
        </div>

        {/* ── Day View ── */}
        {view === "day" && (
          <div className="bg-white rounded-2xl shadow-lg shadow-pink-50 border border-pink-200 overflow-hidden flex flex-col"
            style={{ height: "calc(100vh - 260px)", minHeight: 480 }}>

            {/* Day header strip */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-pink-100 flex-shrink-0 bg-gradient-to-r from-white to-pink-50/40">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shadow-sm ${selDate === today ? "bg-rose-500 text-white shadow-rose-200" : "bg-slate-100 text-slate-700"}`}>
                  {selDateObj.getDate()}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{TH_DAYS_FULL[selDateObj.getDay()]}</p>
                  <p className="text-xs text-slate-500">
                    {selApts.length === 0 ? "ไม่มีนัดหมาย" : `${selApts.length} นัดหมาย`}
                  </p>
                </div>
              </div>
              <button onClick={() => openApt(selDate)}
                className="hidden lg:flex items-center gap-1.5 px-3 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-semibold shadow-sm shadow-rose-200 transition-all">
                <Ic d={IC.plus} cls="w-3.5 h-3.5"/>นัดหมายใหม่
              </button>
            </div>

            {/* Staff schedule strip */}
            {hasEmployees && (
              <div className="px-4 py-2 border-b border-pink-50 flex-shrink-0 bg-slate-50/50">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex-shrink-0">พนักงาน</span>
                  {employees.map(emp => {
                    const entry = schedule.find(s => s.date === selDate && s.employee_name === emp.name);
                    const t = entry ? SCHED_TYPES.find(x => x.key === entry.type) : null;
                    return (
                      <span key={emp.name}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
                        style={t
                          ? { background: t.bg, borderColor: t.dot + "80", color: t.color }
                          : { background: "rgba(241,245,249,0.8)", borderColor: "#e2e8f0", color: "#94a3b8" }}>
                        {emp.name.split(/[\s.]/)[0]}
                        {t && <span className="opacity-75">· {t.label}</span>}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Time grid */}
            <div ref={gridRef} className="flex-1 overflow-y-auto">
              <div className="flex" style={{ height: HOURS.length * HOUR_H + "px" }}>

                {/* Time labels */}
                <div className="flex-shrink-0 select-none" style={{ width: TIME_W + "px" }}>
                  {HOURS.map(h => (
                    <div key={h} style={{ height: HOUR_H + "px" }}
                      className="flex items-start justify-end pr-3 pt-1">
                      <span className="text-[10px] text-slate-400 font-medium leading-none">{pad2(h)}:00</span>
                    </div>
                  ))}
                </div>

                {/* Events area */}
                <div className="flex-1 relative border-l border-slate-100">
                  {/* Hour lines */}
                  {HOURS.map((h, idx) => (
                    <div key={h} className="absolute inset-x-0 border-t border-slate-100"
                      style={{ top: idx * HOUR_H + "px", height: HOUR_H + "px" }}>
                      <div className="absolute inset-x-0 border-t border-dashed border-slate-50" style={{ top: HOUR_H / 2 + "px" }}/>
                    </div>
                  ))}

                  {/* Current time indicator */}
                  {selDate === today && nowMin >= GRID_START && nowMin < GRID_START + HOURS.length * 60 && (
                    <div className="absolute inset-x-0 z-20 pointer-events-none flex items-center"
                      style={{ top: (nowMin - GRID_START) / 60 * HOUR_H + "px" }}>
                      <div className="w-3 h-3 rounded-full bg-rose-500 shadow-md shadow-rose-300 flex-shrink-0 -ml-1.5"/>
                      <div className="flex-1 h-[2px] bg-rose-400/70"/>
                    </div>
                  )}

                  {/* Empty state */}
                  {selApts.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
                      <div className="w-14 h-14 rounded-2xl bg-pink-50 flex items-center justify-center">
                        <Ic d={IC.cal} cls="w-7 h-7 text-pink-300"/>
                      </div>
                      <p className="text-sm font-medium text-slate-400">ไม่มีนัดหมายวันนี้</p>
                    </div>
                  )}

                  {/* Appointment blocks */}
                  {dayLayout.map(apt => {
                    const s = parseMin(apt.appointment_time);
                    const e = Math.max(s + 30, parseMin(apt.end_time));
                    const top = Math.max(0, (s - GRID_START) / 60 * HOUR_H);
                    const h = Math.max(28, (e - s) / 60 * HOUR_H);
                    const cw = 100 / apt.colTotal;
                    const c = APT_COLORS[apt.status] || APT_COLORS.confirmed;
                    const short = h < 46;
                    return (
                      <button key={apt.appointment_id} onClick={() => setDApt(apt)}
                        className="absolute text-left rounded-xl overflow-hidden transition-all hover:brightness-95 hover:shadow-md active:scale-[.98]"
                        style={{
                          top: top + 2 + "px",
                          height: h - 4 + "px",
                          left: `calc(${apt.col * cw}% + 4px)`,
                          width: `calc(${cw}% - 8px)`,
                          background: c.bg,
                          borderLeft: `3px solid ${c.border}`,
                          boxShadow: "0 1px 4px rgba(0,0,0,.06)",
                        }}>
                        <div className="px-2 py-1 h-full flex flex-col justify-center gap-0.5">
                          <p className="text-[10px] font-bold leading-none truncate" style={{ color: c.border }}>
                            {apt.appointment_time}{!short && apt.end_time ? ` – ${apt.end_time}` : ""}
                          </p>
                          <p className="text-[12px] font-semibold text-slate-800 leading-tight truncate">{apt.customer_name}</p>
                          {!short && (
                            <p className="text-[10px] text-slate-500 leading-tight truncate">{apt.service}{apt.doctor ? ` · ${apt.doctor}` : ""}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Week View ── */}
        {view === "week" && (
          <div className="bg-white rounded-2xl shadow-lg shadow-pink-50 border border-pink-200 overflow-hidden flex flex-col"
            style={{ height: "calc(100vh - 260px)", minHeight: 480 }}>

            {/* Week header */}
            <div className="flex-shrink-0 border-b border-pink-100 overflow-x-auto">
              <div className="flex" style={{ minWidth: TIME_W + 7 * 90 + "px" }}>
                <div style={{ width: TIME_W + "px", flexShrink: 0 }}/>
                {weekDays.map(d => {
                  const obj = new Date(d + "T12:00:00");
                  const isToday = d === today;
                  const isSel = d === selDate;
                  const cnt = apts.filter(a => a.appointment_date === d).length;
                  return (
                    <button key={d} onClick={() => { setSelDate(d); setView("day"); }}
                      className="flex-1 py-2 px-1 text-center border-l border-slate-100 hover:bg-pink-50 transition-colors"
                      style={{ minWidth: 90 }}>
                      <p className="text-[10px] text-slate-400 font-medium">{TH_DAYS[obj.getDay()]}</p>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto text-sm font-bold transition-colors mt-0.5 ${isToday ? "bg-rose-500 text-white shadow-sm shadow-rose-200" : isSel ? "bg-rose-100 text-rose-600" : "text-slate-700 hover:bg-pink-100"}`}>
                        {obj.getDate()}
                      </div>
                      {cnt > 0
                        ? <p className="text-[9px] text-rose-400 font-bold mt-0.5">{cnt} นัด</p>
                        : <p className="text-[9px] text-transparent mt-0.5">–</p>}
                      {/* Schedule indicators */}
                      {hasEmployees && (() => {
                        const dayEnts = schedule.filter(s => s.date === d);
                        if (!dayEnts.length) return null;
                        const leaveCount = dayEnts.filter(e => e.type !== "work").length;
                        return leaveCount > 0
                          ? <p className="text-[9px] font-bold mt-0.5" style={{ color: "#e11d48" }}>ลา {leaveCount} คน</p>
                          : <p className="text-[9px] font-bold mt-0.5" style={{ color: "#16a34a" }}>ทีมพร้อม</p>;
                      })()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Week time grid */}
            <div ref={gridRef} className="flex-1 overflow-auto">
              <div className="flex" style={{ minWidth: TIME_W + 7 * 90 + "px", height: HOURS.length * HOUR_H + "px" }}>

                {/* Time labels */}
                <div className="flex-shrink-0 border-r border-slate-100 select-none" style={{ width: TIME_W + "px" }}>
                  {HOURS.map(h => (
                    <div key={h} style={{ height: HOUR_H + "px" }}
                      className="flex items-start justify-end pr-3 pt-1 border-t border-slate-100">
                      <span className="text-[10px] text-slate-400 font-medium">{pad2(h)}:00</span>
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {weekDays.map(d => {
                  const isToday = d === today;
                  const dayApts = weekAptsByDate[d] || [];
                  return (
                    <div key={d} className="relative border-l border-slate-100 flex-1" style={{ minWidth: 90 }}>
                      {/* Hour lines */}
                      {HOURS.map(h => (
                        <div key={h} className="border-t border-slate-100"
                          style={{ height: HOUR_H + "px", background: isToday ? "rgba(255,241,242,0.35)" : undefined }}/>
                      ))}

                      {/* Now indicator */}
                      {isToday && nowMin >= GRID_START && nowMin < GRID_START + HOURS.length * 60 && (
                        <div className="absolute inset-x-0 h-[2px] bg-rose-400/80 z-10 pointer-events-none"
                          style={{ top: (nowMin - GRID_START) / 60 * HOUR_H + "px" }}/>
                      )}

                      {/* Apt blocks */}
                      {dayApts.map(apt => {
                        const s = parseMin(apt.appointment_time);
                        const e = Math.max(s + 30, parseMin(apt.end_time));
                        const top = Math.max(0, (s - GRID_START) / 60 * HOUR_H);
                        const h = Math.max(20, (e - s) / 60 * HOUR_H);
                        const cw = 100 / apt.colTotal;
                        const c = APT_COLORS[apt.status] || APT_COLORS.confirmed;
                        return (
                          <button key={apt.appointment_id} onClick={() => setDApt(apt)}
                            className="absolute text-left rounded-lg overflow-hidden transition-all hover:brightness-95 active:scale-[.97]"
                            style={{
                              top: top + 1 + "px",
                              height: h - 2 + "px",
                              left: `calc(${apt.col * cw}% + 2px)`,
                              width: `calc(${cw}% - 4px)`,
                              background: c.bg,
                              borderLeft: `2.5px solid ${c.border}`,
                            }}>
                            <div className="px-1 py-0.5 h-full flex flex-col justify-center">
                              <p className="text-[9px] font-bold truncate leading-none" style={{ color: c.border }}>{apt.appointment_time}</p>
                              <p className="text-[10px] font-semibold text-slate-800 truncate leading-tight">{apt.customer_name}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Mobile: Mini calendar below grid ── */}
        <div className="lg:hidden">
          <MiniCal {...{ calY, calM, calDays, isTodayC, isSelC, cntDate, makeDStr, setSelDate, setCalY, setCalM, setView }}/>
          <button onClick={() => openApt(selDate)}
            className="mt-3 w-full px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2">
            <Ic d={IC.plus} cls="w-4 h-4"/>นัดหมายใหม่
          </button>
        </div>
      </div>

    </div>
  );
}

// Inline ScheduleModal — same design as StaffCalendar's modal
function ScheduleModalInline({ date, employees, entries, onClose, onSaved }: {
  date: string; employees: Employee[]; entries: ScheduleEntry[];
  onClose: () => void; onSaved: () => Promise<void>;
}) {
  const TH_M = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  const dateObj = new Date(date + "T12:00:00");
  const dateLabel = `${dateObj.getDate()} ${TH_M[dateObj.getMonth()]} ${dateObj.getFullYear() + 543}`;

  const [local, setLocal] = useState<Record<string, string>>(
    () => Object.fromEntries(entries.map(e => [e.employee_name, e.type]))
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      for (const emp of employees) {
        const existing = entries.find(e => e.employee_name === emp.name);
        const newType  = local[emp.name] || "";
        if (existing && existing.type === newType) continue;
        if (!existing && !newType) continue;
        if (existing?.rowIndex) {
          await fetch("/api/crm/schedule", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "delete", rowIndex: existing.rowIndex }) });
        }
        if (newType) {
          const id = `SCH${Date.now().toString().slice(-8)}`;
          await fetch("/api/crm/schedule", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "append", row: [id, date, emp.name, newType, "", new Date().toISOString(), ""] }) });
        }
      }
      await onSaved();
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl z-10 overflow-hidden">
        <div className="flex sm:hidden justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-200"/>
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-b border-pink-100">
          <div>
            <p className="font-bold text-slate-800">ตารางงานพนักงาน</p>
            <p className="text-xs text-slate-500">{dateLabel}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 text-sm font-bold">✕</button>
        </div>
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {employees.map(emp => (
            <div key={emp.name}>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: "linear-gradient(135deg,#fda4af,#e11d48)" }}>
                  {emp.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{emp.name}</p>
                  {emp.role && <p className="text-xs text-slate-500">{emp.role}</p>}
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap ml-10">
                <button onClick={() => setLocal(p => { const n = {...p}; delete n[emp.name]; return n; })}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold border transition-all"
                  style={(local[emp.name] || "") === "" ? { background: "#f1f5f9", color: "#64748b", borderColor: "#cbd5e1" } : { color: "#94a3b8", borderColor: "#e2e8f0" }}>
                  ไม่ระบุ
                </button>
                {SCHED_TYPES.map(t => {
                  const sel = local[emp.name] === t.key;
                  return (
                    <button key={t.key} onClick={() => setLocal(p => ({ ...p, [emp.name]: t.key }))}
                      className="px-2.5 py-1 rounded-full text-xs font-semibold border transition-all"
                      style={sel ? { background: t.dot, color: "white", borderColor: "transparent" } : { background: t.bg, color: t.color, borderColor: t.dot + "60" }}>
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-3 px-5 py-4 border-t border-pink-100">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">ยกเลิก</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold shadow-sm transition-all disabled:opacity-50"
            style={{ background: "#e11d48" }}>
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}
