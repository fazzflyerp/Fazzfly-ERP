//path: app/ERP/payroll-leave/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface EligibleEmployee {
  name: string;
  nickname: string;
}

interface LeaveEntry {
  rowIndex: number;
  timestamp: string;
  recordedBy: string;
  employeeName: string;
  nickname: string;
  leaveDate: string;
  period: string;
  note: string;
}

interface AdjustResult {
  employee: string;
  found: boolean;
  period?: string;
  salesTotal?: number;
  commission?: number;
  leaveDetail?: { date: string; daySales: number; deduction: number }[];
  deductionTotal?: number;
  newCommission?: number;
}

export default function PayrollLeavePage() {
  const { status } = useSession();
  const router = useRouter();

  const [eligibleEmployees, setEligibleEmployees] = useState<EligibleEmployee[]>([]);
  const [entries, setEntries] = useState<LeaveEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [leaveDate, setLeaveDate] = useState("");
  const [note, setNote] = useState("");

  // ── คำนวณหักค่าคอมมิชชั่น ──
  const [adjustPeriod, setAdjustPeriod] = useState("");
  const [adjustResults, setAdjustResults] = useState<AdjustResult[] | null>(null);
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustWriting, setAdjustWriting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjustWritten, setAdjustWritten] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      fetchEntries();
    }
  }, [status]);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/payroll/leave-days");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "โหลดข้อมูลไม่สำเร็จ");
      setEligibleEmployees(data.eligibleEmployees || []);
      setEntries(data.entries || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedEmployee || !leaveDate) {
      setError("กรุณาเลือกพนักงานและวันที่ลา");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/payroll/leave-days", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee: selectedEmployee, leaveDate, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");

      setSuccess("บันทึกวันลาสำเร็จ");
      setLeaveDate("");
      setNote("");
      await fetchEntries();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (rowIndex: number) => {
    if (!confirm("ลบวันลารายการนี้?")) return;
    try {
      const res = await fetch(`/api/payroll/leave-days?rowIndex=${rowIndex}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ลบไม่สำเร็จ");
      await fetchEntries();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePreviewAdjust = async () => {
    if (!adjustPeriod.trim()) { setAdjustError("กรุณาระบุงวด เช่น ก.ค. 2026"); return; }
    setAdjustError(null);
    setAdjustWritten(false);
    setAdjustLoading(true);
    try {
      const res = await fetch(`/api/payroll/commission-adjust?period=${encodeURIComponent(adjustPeriod.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "คำนวณไม่สำเร็จ");
      setAdjustResults(data.results || []);
    } catch (err: any) {
      setAdjustError(err.message);
      setAdjustResults(null);
    } finally {
      setAdjustLoading(false);
    }
  };

  const handleConfirmWrite = async () => {
    if (!adjustResults) return;
    const hasDeduction = adjustResults.some((r) => r.found && (r.deductionTotal || 0) > 0);
    if (!hasDeduction) {
      if (!confirm("ไม่มีวันลาที่ต้องหักในงวดนี้ ต้องการเขียนค่าลงชีทอยู่ดีไหม? (Commission สุทธิจะเท่าเดิม)")) return;
    } else if (!confirm(`ยืนยันเขียนผลลัพธ์กลับเข้าชีท Payroll_Transaction งวด "${adjustPeriod}"? การกระทำนี้จะแก้ไขชีทจริงที่ใช้จ่ายเงินเดือน`)) {
      return;
    }
    setAdjustWriting(true);
    setAdjustError(null);
    try {
      const res = await fetch("/api/payroll/commission-adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: adjustPeriod.trim(), confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เขียนข้อมูลไม่สำเร็จ");
      setAdjustResults(data.results || []);
      setAdjustWritten(true);
    } catch (err: any) {
      setAdjustError(err.message);
    } finally {
      setAdjustWriting(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all";
  const labelClass = "block text-sm font-semibold text-slate-700 mb-1.5";

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <p className="text-slate-600 font-medium">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 h-16">
            <Link href="/ERP/home" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-base font-bold text-slate-900">วันลา (หักค่าคอมมิชชั่น)</h1>
              <p className="text-xs text-slate-500">เฉพาะพนักงานที่ได้ค่าคอมมิชชั่น</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto space-y-6">
        {success && (
          <div className="bg-emerald-50 border-l-4 border-emerald-500 rounded-lg p-4 text-sm font-semibold text-emerald-900">
            {success}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 text-sm font-semibold text-red-900">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-900">เพิ่มวันลา</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>พนักงาน</label>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className={`${inputClass} cursor-pointer`}
                required
              >
                <option value="">-- เลือกพนักงาน --</option>
                {eligibleEmployees.map((e) => (
                  <option key={e.name} value={e.name}>
                    {e.name.trim()} ({e.nickname})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>วันที่ลา</label>
              <input
                type="date"
                value={leaveDate}
                onChange={(e) => setLeaveDate(e.target.value)}
                className={inputClass}
                required
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>หมายเหตุ (ถ้ามี)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น ลาป่วย, ลากิจ"
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-lg hover:from-indigo-700 hover:to-indigo-800 shadow-lg shadow-indigo-500/30 disabled:opacity-50 transition-all"
          >
            {submitting ? "กำลังบันทึก..." : "บันทึกวันลา"}
          </button>
        </form>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
            <h2 className="text-sm font-bold text-slate-900">รายการวันลาที่บันทึกไว้ ({entries.length})</h2>
          </div>
          {entries.length === 0 ? (
            <p className="p-5 text-sm text-slate-400 text-center">ยังไม่มีข้อมูล</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {entries.map((entry) => (
                <div key={entry.rowIndex} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {entry.employeeName.trim()} <span className="text-slate-400">({entry.nickname})</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      ลาวันที่ {entry.leaveDate} · งวด {entry.period}
                      {entry.note && ` · ${entry.note}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(entry.rowIndex)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">คำนวณหักค่าคอมมิชชั่นจากวันลา</h2>
            <p className="text-xs text-slate-500 mt-1">
              คำนวณ = (ยอดขายวันที่ลา ÷ ยอดขายรวมย้อนหลัง 1 เดือน) × Commission ของงวดนั้น แล้วเขียนผลลัพธ์ลงคอลัมน์ใหม่ต่อท้าย
              (S/T/U) ใน Payroll_Transaction — ไม่แตะคอลัมน์ K เดิม
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={adjustPeriod}
              onChange={(e) => setAdjustPeriod(e.target.value)}
              placeholder="เช่น ก.ค. 2026"
              className={`${inputClass} sm:max-w-xs`}
            />
            <button
              type="button"
              onClick={handlePreviewAdjust}
              disabled={adjustLoading}
              className="px-5 py-2.5 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-all"
            >
              {adjustLoading ? "กำลังคำนวณ..." : "ดูตัวอย่าง (Preview)"}
            </button>
          </div>

          {adjustError && (
            <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-3 text-sm text-red-900">{adjustError}</div>
          )}

          {adjustWritten && (
            <div className="bg-emerald-50 border-l-4 border-emerald-500 rounded-lg p-3 text-sm font-semibold text-emerald-900">
              เขียนผลลัพธ์เข้าชีทเรียบร้อยแล้ว
            </div>
          )}

          {adjustResults && (
            <div className="space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                      <th className="py-2 pr-3">พนักงาน</th>
                      <th className="py-2 pr-3">Commission เดิม</th>
                      <th className="py-2 pr-3">วันลาที่ใช้คำนวณ</th>
                      <th className="py-2 pr-3">หัก</th>
                      <th className="py-2 pr-3">Commission ใหม่</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adjustResults.map((r) => (
                      <tr key={r.employee} className="border-b border-slate-100">
                        <td className="py-2 pr-3 font-medium text-slate-900">{r.employee.trim()}</td>
                        {!r.found ? (
                          <td colSpan={4} className="py-2 text-slate-400">ไม่พบแถวของงวดนี้ใน Payroll_Transaction</td>
                        ) : (
                          <>
                            <td className="py-2 pr-3">฿{(r.commission || 0).toLocaleString("th-TH")}</td>
                            <td className="py-2 pr-3 text-xs text-slate-500">
                              {r.leaveDetail && r.leaveDetail.length > 0
                                ? r.leaveDetail.map((d) => d.date).join(", ")
                                : "-"}
                            </td>
                            <td className="py-2 pr-3 text-red-600">
                              {(r.deductionTotal || 0) > 0 ? `-฿${(r.deductionTotal || 0).toLocaleString("th-TH")}` : "-"}
                            </td>
                            <td className="py-2 pr-3 font-bold text-emerald-700">
                              ฿{(r.newCommission ?? r.commission ?? 0).toLocaleString("th-TH")}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={handleConfirmWrite}
                disabled={adjustWriting}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-lg hover:from-emerald-700 hover:to-emerald-800 shadow-lg shadow-emerald-500/30 disabled:opacity-50 transition-all"
              >
                {adjustWriting ? "กำลังเขียนข้อมูล..." : "✅ ยืนยันเขียนเข้าชีทจริง"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
