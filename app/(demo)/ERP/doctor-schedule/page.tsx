"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const THAI_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

function buildPeriodOptions() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return `${THAI_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  });
}

function daysInPeriod(period: string): string[] {
  const parts = period.trim().split(/\s+/);
  const mIdx  = THAI_MONTHS.indexOf(parts[0]);
  const year  = parseInt(parts[1] || "0");
  if (mIdx < 0 || !year) return [];
  const count = new Date(year, mIdx + 1, 0).getDate();
  return Array.from({ length: count }, (_, i) => {
    const d = i + 1;
    return `${String(d).padStart(2, "0")}/${String(mIdx + 1).padStart(2, "0")}/${year}`;
  });
}

function dayLabel(dateStr: string): string {
  const [d, m, y] = dateStr.split("/").map(Number);
  const dt = new Date(y, m - 1, d);
  const day = ["อา","จ","อ","พ","พฤ","ศ","ส"][dt.getDay()];
  return `${d} ${day}`;
}

function isWeekend(dateStr: string): boolean {
  const [d, m, y] = dateStr.split("/").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 || day === 6;
}

interface Doctor { nickname: string; position: string; sittingRate: number }
type HoursMap = Record<string, Record<string, string>>; // date → nickname → hours

function Spinner() {
  return (
    <div className="relative w-5 h-5">
      <div className="absolute inset-0 rounded-full border-2 border-white/20" />
      <div className="absolute inset-0 rounded-full border-t-2 border-white animate-spin" />
    </div>
  );
}

function DoctorScheduleContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const spreadsheetId = searchParams.get("spreadsheetId") || "";

  const [branchId,   setBranchId]   = useState<string | null>(null);
  const [branchName, setBranchName] = useState<string | null>(null);
  const [isCentral,  setIsCentral]  = useState(false);
  const [allBranches, setAllBranches] = useState<{ branchId: string; branchName: string }[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<{ branchId: string; branchName: string } | null>(null);

  const periodOptions = buildPeriodOptions();
  const [period, setPeriod] = useState(periodOptions[0]);

  const [doctors, setDoctors]   = useState<Doctor[]>([]);
  const [hours,   setHours]     = useState<HoursMap>({});
  const [loading, setLoading]   = useState(false);
  const [saving,  setSaving]    = useState(false);
  const [error,   setError]     = useState<string | null>(null);
  const [saved,   setSaved]     = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/auth/branch-check")
      .then((r) => r.json())
      .then((data) => {
        const bid = (data.branchId || "").trim().toLowerCase();
        setBranchId(bid);
        setBranchName(data.branchName || bid);
        if (bid === "central") {
          setIsCentral(true);
          fetch("/api/auth/branches").then((r) => r.json()).then((d) => setAllBranches(d.branches || []));
        }
      });
  }, [status]);

  const effectiveBranch = isCentral
    ? selectedBranch
    : branchId ? { branchId, branchName: branchName || branchId } : null;

  // โหลด schedule
  const loadSchedule = useCallback(async () => {
    if (!spreadsheetId || !effectiveBranch) return;
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/api/payroll/doctor-schedule", window.location.origin);
      url.searchParams.set("spreadsheetId", spreadsheetId);
      url.searchParams.set("period", period);
      url.searchParams.set("branchId", effectiveBranch.branchId);
      const res  = await fetch(url.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setDoctors(data.doctors || []);

      // สร้าง hoursMap จาก entries
      const map: HoursMap = {};
      (data.entries || []).forEach((e: { date: string; nickname: string; hours: number }) => {
        if (!map[e.date]) map[e.date] = {};
        map[e.date][e.nickname] = e.hours > 0 ? String(e.hours) : "";
      });
      setHours(map);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [spreadsheetId, period, effectiveBranch]);

  useEffect(() => { loadSchedule(); }, [loadSchedule]);

  const updateHours = (date: string, nick: string, val: string) => {
    setSaved(false);
    setHours((prev) => ({
      ...prev,
      [date]: { ...(prev[date] || {}), [nick]: val },
    }));
  };

  const handleSave = async () => {
    if (!spreadsheetId || !effectiveBranch) return;
    setSaving(true);
    setError(null);
    try {
      const entries: { date: string; nickname: string; hours: number }[] = [];
      Object.entries(hours).forEach(([date, nickMap]) => {
        Object.entries(nickMap).forEach(([nick, h]) => {
          const n = parseFloat(h);
          if (n > 0) entries.push({ date, nickname: nick, hours: n });
        });
      });

      const res = await fetch("/api/payroll/doctor-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spreadsheetId,
          period,
          branchId: effectiveBranch.branchId,
          entries,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSaved(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // สรุป hours ต่อหมอ
  const totalByDoctor = (nick: string) =>
    Object.values(hours).reduce((s, m) => s + (parseFloat(m[nick] || "0") || 0), 0);

  const days = daysInPeriod(period);

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e]"><Spinner /></div>;
  }

  if (!spreadsheetId) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e]"><p className="text-slate-400">ไม่พบ spreadsheetId</p></div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] pb-16">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-8">

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <button onClick={() => spreadsheetId ? router.push(`/ERP/payroll-branch?spreadsheetId=${spreadsheetId}`) : router.back()}
            className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold">MD</div>
          <div>
            <h1 className="text-lg font-bold text-white">ปฏิทินเวรหมอ</h1>
            {effectiveBranch && <p className="text-xs text-slate-400">สาขา: {effectiveBranch.branchName}</p>}
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white/[0.04] backdrop-blur-xl rounded-2xl border border-white/10 p-4 sm:p-6 mb-5 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">งวดเดือน</label>
            <select value={period} onChange={(e) => { setPeriod(e.target.value); setSaved(false); }}
              className="px-3 py-2 text-sm text-white bg-white/[0.06] border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/60 transition-all">
              {periodOptions.map((p) => <option key={p} value={p} className="bg-[#0f1629]">{p}</option>)}
            </select>
          </div>

          {isCentral && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">สาขา</label>
              <select value={selectedBranch?.branchId || ""}
                onChange={(e) => {
                  const b = allBranches.find((x) => x.branchId === e.target.value) || null;
                  setSelectedBranch(b);
                }}
                className="px-3 py-2 text-sm text-white bg-white/[0.06] border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/60 transition-all">
                <option value="" className="bg-[#0f1629]">-- เลือกสาขา --</option>
                {allBranches.map((b) => <option key={b.branchId} value={b.branchId} className="bg-[#0f1629]">{b.branchName}</option>)}
              </select>
            </div>
          )}

          <button onClick={handleSave} disabled={saving || !effectiveBranch}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-purple-500 to-violet-600 rounded-xl hover:from-purple-600 hover:to-violet-700 disabled:opacity-50 transition-all shadow-lg shadow-purple-500/20">
            {saving ? <><Spinner />บันทึก...</> : saved ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                บันทึกแล้ว
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                บันทึก
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20"><Spinner /></div>
        )}

        {!loading && doctors.length === 0 && effectiveBranch && (
          <div className="bg-white/[0.04] rounded-2xl border border-white/10 p-8 text-center">
            <p className="text-slate-400 text-sm">ไม่พบหมอใน Helper_EMP สาขานี้</p>
            <p className="text-slate-600 text-xs mt-1">ตรวจสอบ col Q (sitting_rate) หรือ col R (commission_rate) ว่ามีค่า</p>
          </div>
        )}

        {!loading && doctors.length > 0 && (
          <>
            {/* Summary */}
            <div className="flex flex-wrap gap-3 mb-4">
              {doctors.map((doc) => {
                const total = totalByDoctor(doc.nickname);
                return (
                  <div key={doc.nickname} className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] border border-white/10 rounded-xl">
                    <span className="text-sm font-semibold text-white">{doc.nickname}</span>
                    <span className="text-xs text-purple-400">{total} ชม.</span>
                    <span className="text-xs text-slate-500">{(total * doc.sittingRate).toLocaleString()} ฿</span>
                  </div>
                );
              })}
            </div>

            {/* Calendar table */}
            <div className="bg-white/[0.04] backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.03]">
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 w-20 sticky left-0 bg-[#0d1526]">วัน</th>
                      {doctors.map((doc) => (
                        <th key={doc.nickname} className="px-3 py-3 text-xs font-medium text-white text-center min-w-[90px]">
                          <div>{doc.nickname}</div>
                          <div className="text-slate-500 font-normal text-[10px]">{doc.sittingRate.toLocaleString()}/ชม.</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {days.map((date) => {
                      const weekend = isWeekend(date);
                      return (
                        <tr key={date} className={`${weekend ? "bg-white/[0.02]" : ""} hover:bg-white/[0.03] transition-colors`}>
                          <td className={`px-4 py-2 text-xs sticky left-0 ${weekend ? "bg-[#0f1629] text-slate-500" : "bg-[#0d1526] text-slate-300"} font-mono`}>
                            {dayLabel(date)}
                          </td>
                          {doctors.map((doc) => (
                            <td key={doc.nickname} className="px-2 py-1.5 text-center">
                              <input
                                type="number"
                                min="0"
                                max="24"
                                step="0.5"
                                value={hours[date]?.[doc.nickname] ?? ""}
                                onChange={(e) => updateHours(date, doc.nickname, e.target.value)}
                                placeholder="—"
                                className={`w-16 px-2 py-1 text-center text-sm rounded-lg bg-white/[0.06] border transition-all focus:outline-none tabular-nums
                                  ${hours[date]?.[doc.nickname] && parseFloat(hours[date][doc.nickname]) > 0
                                    ? "border-purple-500/40 text-purple-300"
                                    : "border-white/[0.07] text-slate-400"
                                  } focus:border-purple-500/60 focus:text-white`}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-white/10 bg-white/[0.03]">
                      <td className="px-4 py-3 text-xs font-semibold text-slate-400 sticky left-0 bg-[#0d1526]">รวม</td>
                      {doctors.map((doc) => {
                        const total = totalByDoctor(doc.nickname);
                        return (
                          <td key={doc.nickname} className="px-2 py-3 text-center">
                            <div className="text-sm font-bold text-purple-300">{total} ชม.</div>
                            <div className="text-xs text-slate-500">{(total * doc.sittingRate).toLocaleString()} ฿</div>
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function DoctorSchedulePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e]">
        <div className="relative w-5 h-5">
          <div className="absolute inset-0 rounded-full border-2 border-purple-500/20" />
          <div className="absolute inset-0 rounded-full border-t-2 border-purple-400 animate-spin" />
        </div>
      </div>
    }>
      <DoctorScheduleContent />
    </Suspense>
  );
}
