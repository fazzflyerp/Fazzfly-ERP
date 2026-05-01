// app/components/StaffCalendar.tsx
"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { useUserRole } from "@/app/context/UserRoleContext";

// ── Types ────────────────────────────────────────────────────────────────────
export interface Employee {
  rowIndex: number;
  name: string;
  staffId: string;
  role: string;           // position
  nickname: string;
  email: string;          // ใช้ลิงก์กับ User session
  baseSalary: number;
  otCost: number;         // บาท/นาที
  lateCost: number;       // บาท/นาที
  leaveCost: number;      // บาท/วัน
  commissionAmount: number;
  bankAccount: string;
  startDate: string;
  endDate: string;
  leave_quota: number;    // -1=ไม่กำหนด, 0=หักทันที, N=ได้ N วัน
}
export interface ScheduleEntry {
  rowIndex?: number;
  id: string; date: string; employee_name: string;
  type: "work" | "leave" | "sick" | "holiday" | string;
}

// ── Constants ────────────────────────────────────────────────────────────────
export const SCHED_TYPES = [
  { key: "work",    label: "ทำงาน",   color: "#15803d", bg: "rgba(22,163,74,0.13)",  dot: "#16a34a" },
  { key: "leave",   label: "ลาพัก",   color: "#be123c", bg: "rgba(225,29,72,0.12)",  dot: "#e11d48" },
  { key: "sick",    label: "ลาป่วย",  color: "#b45309", bg: "rgba(217,119,6,0.13)",  dot: "#d97706" },
  { key: "holiday", label: "วันหยุด", color: "#475569", bg: "rgba(100,116,139,0.12)", dot: "#64748b" },
] as const;

const TH_DAYS   = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const TH_M_LONG = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const TH_M_SHORT = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

function pad2(n: number) { return String(n).padStart(2, "0"); }
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function makeDStr(y: number, m: number, d: number) { return `${y}-${pad2(m+1)}-${pad2(d)}`; }
function getDays(y: number, m: number) { return new Date(y, m+1, 0).getDate(); }
function getFirst(y: number, m: number) { return new Date(y, m, 1).getDay(); }

function fmtDateLong(s: string) {
  const d = new Date(s + "T12:00:00");
  return `${d.getDate()} ${TH_M_LONG[d.getMonth()]} ${d.getFullYear()+543}`;
}

function countUsedLeave(schedule: ScheduleEntry[], empName: string, year: number) {
  return schedule.filter(s =>
    s.employee_name === empName &&
    (s.type === "leave" || s.type === "sick") &&
    s.date.startsWith(String(year))
  ).length;
}

function QuotaBadge({ quota, used }: { quota: number; used: number }) {
  if (quota < 0) return null;
  const remaining = quota - used;
  if (quota === 0) return (
    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "rgba(239,68,68,0.12)", color: "#b91c1c" }}>ไม่มีโควต้า</span>
  );
  return (
    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={remaining < 0
      ? { background: "rgba(239,68,68,0.12)", color: "#b91c1c" }
      : { background: "rgba(22,163,74,0.10)", color: "#15803d" }}>
      {remaining < 0 ? `เกิน ${Math.abs(remaining)} วัน ⚠️` : `คงเหลือ ${remaining}/${quota} วัน`}
    </span>
  );
}

// ── Portal wrapper ──────────────────────────────────────────────────────────
function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); return () => setMounted(false); }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

// ── Schedule Modal (Admin — จัดการทุกคน) ─────────────────────────────────────
function ScheduleModal({ date, employees, entries, schedule, onClose, onSaved }: {
  date: string; employees: Employee[]; entries: ScheduleEntry[];
  schedule: ScheduleEntry[];
  onClose: () => void; onSaved: () => Promise<void>;
}) {
  const year = new Date(date + "T12:00:00").getFullYear();
  const [local, setLocal] = useState<Record<string, string>>(
    () => Object.fromEntries(entries.map(e => [e.employee_name, e.type]))
  );
  const [saving, setSaving] = useState(false);

  const post = (body: object) => fetch("/api/crm/schedule", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const save = async () => {
    setSaving(true);
    try {
      for (const emp of employees) {
        const existing = entries.find(e => e.employee_name === emp.name);
        const newType  = local[emp.name] || "";
        if (existing && existing.type === newType) continue;
        if (!existing && !newType) continue;
        if (existing?.rowIndex) await post({ action: "delete", rowIndex: existing.rowIndex });
        if (newType) {
          const id = `SCH${Date.now().toString().slice(-8)}`;
          await post({ action: "append", row: [id, date, emp.name, newType, "", new Date().toISOString(), ""] });
        }
      }
      await onSaved();
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}/>
        <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl z-10 overflow-hidden flex flex-col max-h-[90dvh]">
          <div className="flex sm:hidden justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-slate-200"/>
          </div>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
            <div>
              <p className="font-bold text-slate-800">ตารางงานพนักงาน</p>
              <p className="text-xs text-slate-500">{fmtDateLong(date)}</p>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold transition-colors">✕</button>
          </div>

          <div className="p-5 space-y-5 overflow-y-auto flex-1">
            {employees.map(emp => {
              const used = countUsedLeave(schedule, emp.name, year);
              const t    = SCHED_TYPES.find(x => x.key === local[emp.name]);
              const type = local[emp.name];
              const willExceed = emp.leave_quota >= 0 && (type === "leave" || type === "sick") && (used + 1) > emp.leave_quota;
              return (
                <div key={emp.name}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                      style={{ background: "linear-gradient(135deg,#fda4af,#e11d48)" }}>
                      {emp.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-semibold text-slate-800">{emp.name}</p>
                        {emp.role && <span className="text-[10px] text-slate-400">{emp.role}</span>}
                      </div>
                      <QuotaBadge quota={emp.leave_quota} used={used}/>
                    </div>
                    {t && <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: t.bg, color: t.color }}>{t.label}</span>}
                  </div>
                  <div className="flex gap-1.5 flex-wrap ml-11">
                    <button onClick={() => setLocal(p => { const n = {...p}; delete n[emp.name]; return n; })}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                      style={!local[emp.name]
                        ? { background: "#f1f5f9", color: "#64748b", borderColor: "#cbd5e1", fontWeight: 800 }
                        : { color: "#94a3b8", borderColor: "#e2e8f0" }}>
                      ไม่ระบุ
                    </button>
                    {SCHED_TYPES.map(st => {
                      const sel = local[emp.name] === st.key;
                      const warn = (st.key === "leave" || st.key === "sick") && emp.leave_quota >= 0 && !sel && (used + 1) > emp.leave_quota;
                      return (
                        <button key={st.key} onClick={() => setLocal(p => ({ ...p, [emp.name]: st.key }))}
                          className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                          style={sel ? { background: st.dot, color: "white", borderColor: "transparent" }
                            : { background: st.bg, color: st.color, borderColor: st.dot + "55" }}>
                          {st.label}{warn ? " ⚠️" : ""}
                        </button>
                      );
                    })}
                  </div>
                  {willExceed && (
                    <p className="ml-11 mt-1.5 text-[10px] font-semibold text-red-500">
                      {emp.leave_quota === 0 ? "⚠️ ไม่มีโควต้าลา — จะถูกหักเงินเดือน" : `⚠️ ลาเกินโควต้า (${used+1}/${emp.leave_quota} วัน) — จะถูกหักเงินเดือน`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 px-5 py-4 border-t border-slate-100 flex-shrink-0">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              ยกเลิก
            </button>
            <button onClick={save} disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold shadow-sm transition-all disabled:opacity-50"
              style={{ background: "#e11d48" }}>
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

// ── Leave Modal (Admin เลือกทุกคน / Employee เห็นแค่ตัวเอง) ──────────────────
function LeaveModal({ myEmployee, employees, schedule, onClose, onSaved, defaultDate }: {
  myEmployee: Employee | null;
  employees: Employee[];
  schedule: ScheduleEntry[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  defaultDate?: string;
}) {
  const { isAdmin } = useUserRole();
  const year = new Date().getFullYear();

  const [selEmpName, setSelEmpName] = useState(myEmployee?.name || "");
  const [date, setDate]             = useState(defaultDate || todayStr());
  const [type, setType]             = useState("leave");
  const [notes, setNotes]           = useState("");
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");

  const selEmp     = employees.find(e => e.name === selEmpName) || myEmployee;
  const used       = selEmp ? countUsedLeave(schedule, selEmp.name, year) : 0;
  const willExceed = selEmp && selEmp.leave_quota >= 0 && (type === "leave" || type === "sick") && (used + 1) > selEmp.leave_quota;
  const alreadyHas = selEmp && schedule.some(s => s.date === date && s.employee_name === selEmp.name);

  const availTypes = isAdmin() ? SCHED_TYPES : SCHED_TYPES.filter(t => t.key !== "work" && t.key !== "holiday");

  const save = async () => {
    if (!selEmpName) { setError("กรุณาเลือกพนักงาน"); return; }
    if (!date)       { setError("กรุณาเลือกวันที่"); return; }
    setSaving(true); setError("");
    try {
      const existing = schedule.find(s => s.date === date && s.employee_name === selEmpName);
      const post = (body: object) => fetch("/api/crm/schedule", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (existing?.rowIndex) await post({ action: "delete", rowIndex: existing.rowIndex });
      const id = `SCH${Date.now().toString().slice(-8)}`;
      await post({ action: "append", row: [id, date, selEmpName, type, notes, new Date().toISOString(), ""] });
      await onSaved();
      onClose();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  if (employees.length === 0) return (
    <Portal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}/>
        <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl z-10 p-6 text-center">
          <p className="text-2xl mb-3">👥</p>
          <p className="font-bold text-slate-800 mb-1">ยังไม่มีข้อมูลพนักงาน</p>
          <p className="text-sm text-slate-500 mb-4">กรุณาเพิ่มพนักงานในชีท <span className="font-mono font-bold text-slate-700">Employees</span> ใน Master Sheet ก่อน</p>
          <button onClick={onClose} className="w-full py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: "#e11d48" }}>ปิด</button>
        </div>
      </div>
    </Portal>
  );

  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}/>
        <div className="relative bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl z-10 overflow-hidden flex flex-col max-h-[90dvh]">
          <div className="flex sm:hidden justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-slate-200"/>
          </div>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
            <div>
              <p className="font-bold text-slate-800">{isAdmin() ? "ลงตาราง / แจ้งลา" : "แจ้งลา"}</p>
              {myEmployee && !isAdmin() && <p className="text-xs text-slate-500">{myEmployee.name}</p>}
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold transition-colors">✕</button>
          </div>

          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            {/* เลือกพนักงาน: Admin เห็นทุกคน, Employee เห็นตัวเอง */}
            {(isAdmin() || !myEmployee) && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">พนักงาน</p>
                <select value={selEmpName} onChange={e => setSelEmpName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all">
                  <option value="">-- เลือกพนักงาน --</option>
                  {employees.map(e => <option key={e.name} value={e.name}>{e.name}{e.role ? ` (${e.role})` : ""}</option>)}
                </select>
              </div>
            )}

            {/* Quota summary */}
            {selEmp && selEmp.leave_quota >= 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: "linear-gradient(135deg,#fda4af,#e11d48)" }}>{selEmp.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{selEmp.name}</p>
                  <QuotaBadge quota={selEmp.leave_quota} used={used}/>
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">วันที่</p>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"/>
              {alreadyHas && <p className="text-[10px] text-amber-500 mt-1">⚠️ มีข้อมูลวันนี้อยู่แล้ว — จะถูกแทนที่</p>}
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">ประเภท</p>
              <div className="flex gap-2 flex-wrap">
                {availTypes.map(t => {
                  const sel = type === t.key;
                  return (
                    <button key={t.key} onClick={() => setType(t.key)}
                      className="flex-1 min-w-[80px] py-2 rounded-xl text-xs font-semibold border transition-all"
                      style={sel ? { background: t.dot, color: "white", borderColor: "transparent" }
                        : { background: t.bg, color: t.color, borderColor: t.dot + "55" }}>
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">หมายเหตุ</p>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="เหตุผล..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all resize-none"/>
            </div>

            {willExceed && (
              <div className="rounded-xl px-4 py-3 bg-red-50 border border-red-200">
                <p className="text-xs font-bold text-red-600">
                  {selEmp?.leave_quota === 0 ? "⚠️ ไม่มีโควต้าลา — จะถูกหักเงินเดือน"
                    : `⚠️ ลาเกินโควต้า (${used+1}/${selEmp?.leave_quota} วัน) — จะถูกหักเงินเดือน`}
                </p>
              </div>
            )}

            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
          </div>

          <div className="flex gap-3 px-5 py-4 border-t border-slate-100 flex-shrink-0">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">ยกเลิก</button>
            <button onClick={save} disabled={saving || !selEmpName}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold shadow-sm transition-all disabled:opacity-50"
              style={{ background: "#e11d48" }}>
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

// ── Init Sheet Modal (Admin — กดครั้งเดียว) ───────────────────────────────────
function InitSheetModal({ onClose }: { onClose: () => void }) {
  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}/>
        <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl z-10 p-6">
          <h3 className="font-bold text-slate-800 mb-1">ตั้งค่า Employees Sheet</h3>
          <p className="text-sm text-slate-500 mb-4">เพิ่มข้อมูลใน Master Sheet ชีท <span className="font-mono font-bold text-slate-700">client_db</span> 1 แถว:</p>
          <div className="bg-slate-50 rounded-xl p-3 mb-4 text-[11px] font-mono text-slate-600 space-y-1.5 overflow-x-auto">
            <p className="font-bold text-slate-700 font-sans text-xs">คอลัมน์ใน client_db (A–D):</p>
            <p><span className="text-rose-500">A</span> DB_ID — เช่น DB010</p>
            <p><span className="text-rose-500">B</span> Client ID — C003</p>
            <p><span className="text-rose-500">C</span> <span className="font-bold">Employees</span></p>
            <p><span className="text-rose-500">D</span> spreadsheet URL ของ Employees sheet</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-800 space-y-1">
            <p className="font-bold">Header แถวแรกของ Employees sheet (อ่านอัตโนมัติ):</p>
            <p className="font-mono">staff_name | staff_id | position | base_salary | ot_cost | late_cost | leave_cost | commission_amount | bank_account | start_date | end_date | status | nickname</p>
            <p className="mt-1">เพิ่มคอลัมน์ <span className="font-mono font-bold">email</span> และ <span className="font-mono font-bold">leave_quota</span> ถ้าต้องการลิงก์ User + โควต้าลา</p>
          </div>
          <button onClick={onClose}
            className="w-full py-2.5 rounded-xl text-white text-sm font-semibold"
            style={{ background: "#e11d48" }}>รับทราบ</button>
        </div>
      </div>
    </Portal>
  );
}

// ── DayCell ──────────────────────────────────────────────────────────────────
function DayCell({ day, isToday, aptCount, dayEntries, canEdit, onClick }: {
  day: number; isToday: boolean; aptCount: number;
  dayEntries: ScheduleEntry[]; canEdit: boolean; onClick: () => void;
}) {
  return (
    <div onClick={canEdit ? onClick : undefined}
      className={`min-h-[72px] sm:min-h-[88px] border-b border-r border-slate-100 p-1.5 transition-colors select-none
        ${canEdit ? "cursor-pointer hover:bg-slate-50/80 active:bg-slate-100/80" : ""}
        ${isToday ? "bg-rose-50/60" : ""}`}>
      <div className="flex items-start justify-between mb-1">
        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold leading-none
          ${isToday ? "bg-rose-500 text-white" : "text-slate-600"}`}>{day}</span>
        {aptCount > 0 && (
          <span className="text-[9px] font-bold text-white rounded-full px-1.5 py-0.5 leading-none"
            style={{ background: "#e11d48" }}>{aptCount} นัด</span>
        )}
      </div>
      {dayEntries.length > 0 && (
        <div className="flex flex-col gap-0.5 mt-0.5">
          {dayEntries.slice(0, 3).map(e => {
            const t = SCHED_TYPES.find(x => x.key === e.type);
            if (!t) return null;
            const short = e.employee_name.split(/[\s.]/)[0];
            return (
              <div key={e.employee_name}
                className="text-[9px] font-semibold px-1 py-0.5 rounded leading-tight truncate"
                style={{ background: t.bg, color: t.color }}>
                {short} · {t.label}
              </div>
            );
          })}
          {dayEntries.length > 3 && <div className="text-[9px] text-slate-400 pl-1">+{dayEntries.length - 3}</div>}
        </div>
      )}
    </div>
  );
}

// ── Main StaffCalendar ───────────────────────────────────────────────────────
interface Props {
  employees?: Employee[]; schedule?: ScheduleEntry[]; aptCounts?: Record<string, number>;
  spreadsheetId?: string;
  clientId?: string;  // self-fetch mode
  compact?: boolean;
}

export default function StaffCalendar({ employees: empProp, schedule: schProp, aptCounts: aptProp, spreadsheetId: sidProp, clientId, compact = false }: Props) {
  const { isAdmin } = useUserRole();
  const { data: session } = useSession();
  const userEmail = (session?.user?.email || "").toLowerCase();

  const [loading, setLoading]   = useState(!empProp);
  const [employees, setEmployees] = useState<Employee[]>(empProp || []);
  const [schedule,  setSchedule]  = useState<ScheduleEntry[]>(schProp || []);
  const [aptCounts, setAptCounts] = useState<Record<string, number>>(aptProp || {});
  const [sid, setSid]             = useState(sidProp || "");

  const now = new Date();
  const [calY, setCalY] = useState(now.getFullYear());
  const [calM, setCalM] = useState(now.getMonth());

  // Modal states
  const [scheduleDate, setScheduleDate]     = useState<string | null>(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showInitModal, setShowInitModal]   = useState(false);

  const myEmployee   = employees.find(e => e.email && e.email === userEmail) || null;
  const hasEmployees = employees.length > 0;

  useEffect(() => {
    if (empProp !== undefined) {
      setEmployees(empProp);
      setSchedule(schProp || []);
      setAptCounts(aptProp || {});
      return;
    }
    if (!clientId) return;
    setLoading(true);

    // fetch employees + schedule ก่อนเสมอ (ไม่ต้องรอ CRM modules)
    Promise.all([
      fetch("/api/crm/employees").then(r => r.json()).catch(() => ({ employees: [] })),
      fetch("/api/crm/schedule").then(r => r.json()).catch(() => ({ schedule: [] })),
    ]).then(([empD, schD]) => {
      setEmployees(empD.employees || []);
      setSchedule(schD.schedule || []);
    }).finally(() => setLoading(false));

    // fetch appointments แยกต่างหาก (สำหรับ dot บนปฏิทิน)
    fetch(`/api/crm/modules?clientId=${clientId}`)
      .then(r => r.json())
      .then(async d => {
        const spreadsheetId =
          d.appointments?.spreadsheetId ||
          d.modules?.find((m: any) => m.spreadsheetId)?.spreadsheetId || "";
        if (!spreadsheetId) return;
        setSid(spreadsheetId);
        const aptD = await fetch(`/api/crm/appointments?spreadsheetId=${spreadsheetId}`).then(r => r.json());
        const counts: Record<string, number> = {};
        for (const a of (aptD.appointments || [])) counts[a.appointment_date] = (counts[a.appointment_date] || 0) + 1;
        setAptCounts(counts);
      })
      .catch(() => {});
  }, [clientId, empProp, schProp, aptProp]);

  const refreshSchedule = useCallback(async () => {
    const r = await fetch("/api/crm/schedule");
    const d = await r.json();
    setSchedule(d.schedule || []);
  }, []);

  const refreshEmployees = useCallback(async () => {
    const r = await fetch("/api/crm/employees");
    const d = await r.json();
    setEmployees(d.employees || []);
  }, []);

  // Calendar grid
  const calDays = useMemo<(number | 0)[]>(() => {
    const days = getDays(calY, calM);
    const first = getFirst(calY, calM);
    const arr: (number | 0)[] = [...Array(first).fill(0), ...Array.from({ length: days }, (_, i) => i + 1)];
    while (arr.length % 7 !== 0) arr.push(0);
    return arr;
  }, [calY, calM]);

  const today = todayStr();
  const activeSid = sid || sidProp || "";

  const quotaWarnings = useMemo(() => employees
    .filter(e => e.leave_quota >= 0)
    .map(e => ({ emp: e, used: countUsedLeave(schedule, e.name, calY) }))
    .filter(({ emp, used }) => used > emp.leave_quota || (emp.leave_quota === 0 && used > 0))
  , [employees, schedule, calY]);

  const prevMonth = () => { const d = new Date(calY, calM - 1); setCalY(d.getFullYear()); setCalM(d.getMonth()); };
  const nextMonth = () => { const d = new Date(calY, calM + 1); setCalY(d.getFullYear()); setCalM(d.getMonth()); };

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 overflow-hidden ${compact ? "shadow-sm" : "shadow-md"}`}>
      {/* Header */}
      <div className={`flex items-center justify-between border-b border-slate-100 ${compact ? "px-4 py-3" : "px-5 py-4"}`}>
        <div>
          <h3 className={`font-bold text-slate-800 ${compact ? "text-sm" : "text-base"}`}>
            {hasEmployees ? "ปฏิทินทีมงาน" : "ปฏิทินนัดหมาย"}
          </h3>
          {!compact && (
            <p className="text-xs text-slate-500 mt-0.5">
              {hasEmployees ? "ตารางพนักงาน + นัดหมายลูกค้า" : "นัดหมายลูกค้ารายเดือน"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!loading && isAdmin() && (
            <button onClick={() => setShowLeaveModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white shadow-sm transition-all hover:opacity-90"
              style={{ background: "#e11d48" }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
              </svg>
              ลงตาราง
            </button>
          )}
          {!loading && !isAdmin() && myEmployee && (
            <button onClick={() => setShowLeaveModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white shadow-sm transition-all hover:opacity-90"
              style={{ background: "#e11d48" }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
              </svg>
              แจ้งลา
            </button>
          )}
          <button onClick={prevMonth}
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors text-sm">‹</button>
          <span className="text-sm font-semibold text-slate-700 min-w-[110px] text-center">{TH_M_LONG[calM]} {calY + 543}</span>
          <button onClick={nextMonth}
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors text-sm">›</button>
        </div>
      </div>

      {isAdmin() && quotaWarnings.length > 0 && (
        <div className="px-5 py-2.5 border-b border-red-100 bg-red-50/60">
          <p className="text-xs font-bold text-red-600 mb-1">⚠️ พนักงานลาเกินโควต้า</p>
          <div className="flex flex-wrap gap-2">
            {quotaWarnings.map(({ emp, used }) => (
              <span key={emp.name} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                {emp.name} — ใช้ {used}/{emp.leave_quota} วัน
              </span>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 text-sm gap-2">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          กำลังโหลด...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
            {TH_DAYS.map((d, i) => (
              <div key={d} className={`py-2 text-center text-[10px] font-bold ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-slate-500"}`}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calDays.map((day, i) => {
              if (!day) return <div key={`e${i}`} className="min-h-[72px] sm:min-h-[88px] border-b border-r border-slate-50 bg-slate-50/30"/>;
              const dk      = makeDStr(calY, calM, day);
              const isToday = dk === today;
              const dayEnts = schedule.filter(s => s.date === dk);
              return (
                <DayCell key={day} day={day} isToday={isToday}
                  aptCount={aptCounts[dk] || 0} dayEntries={dayEnts}
                  canEdit={isAdmin()} onClick={() => setScheduleDate(dk)}/>
              );
            })}
          </div>

          <div className="flex items-center gap-3 sm:gap-4 px-4 py-3 border-t border-slate-100 bg-slate-50/60 flex-wrap">
            {hasEmployees && SCHED_TYPES.map(t => (
              <div key={t.key} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: t.bg, border: `1.5px solid ${t.dot}` }}/>
                <span className="text-[10px] text-slate-500">{t.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-1">
              <span className="min-w-[20px] h-3.5 rounded-full flex-shrink-0 flex items-center justify-center px-1" style={{ background: "#e11d48" }}>
                <span className="text-[7px] text-white font-bold">n</span>
              </span>
              <span className="text-[10px] text-slate-500">นัดหมาย</span>
            </div>
            {isAdmin() && hasEmployees && (
              <span className="text-[10px] text-slate-400 ml-auto">คลิกวันเพื่อแก้ไขตาราง</span>
            )}
          </div>
        </>
      )}

      {/* Modals */}
      {scheduleDate && isAdmin() && (
        <ScheduleModal
          date={scheduleDate} employees={employees}
          entries={schedule.filter(s => s.date === scheduleDate)}
          schedule={schedule}
          onClose={() => setScheduleDate(null)}
          onSaved={refreshSchedule}/>
      )}
      {showLeaveModal && (
        <LeaveModal
          myEmployee={isAdmin() ? null : myEmployee}
          employees={employees} schedule={schedule}
          onClose={() => setShowLeaveModal(false)}
          onSaved={refreshSchedule}/>
      )}
      {showInitModal && (
        <InitSheetModal onClose={() => setShowInitModal(false)}/>
      )}
    </div>
  );
}
