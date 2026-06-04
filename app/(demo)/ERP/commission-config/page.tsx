"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface SalesStaff { nickname: string; fullName: string; position: string; branchId: string }
interface Tier { min: number; max: number | null; rate: number; nickname: string }

function Spinner() {
  return (
    <div className="relative w-5 h-5">
      <div className="absolute inset-0 rounded-full border-2 border-white/20" />
      <div className="absolute inset-0 rounded-full border-t-2 border-white animate-spin" />
    </div>
  );
}

function fmtNum(n: number) { return n.toLocaleString("th-TH"); }

function CommissionConfigContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const spreadsheetId = searchParams.get("spreadsheetId") || "";

  const [branchId,    setBranchId]    = useState<string | null>(null);
  const [isCentral,   setIsCentral]   = useState(false);
  const [allBranches, setAllBranches] = useState<{ branchId: string; branchName: string }[]>([]);
  const [selBranch,   setSelBranch]   = useState("");

  const [staff,   setStaff]   = useState<SalesStaff[]>([]);
  const [tiers,   setTiers]   = useState<Tier[]>([]);
  const [selNick, setSelNick] = useState<string>("__default__"); // __default__ = ใช้กับทุกคน

  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/auth/branch-check").then((r) => r.json()).then((d) => {
      const bid = (d.branchId || "").trim().toLowerCase();
      setBranchId(bid);
      if (bid === "central") {
        setIsCentral(true);
        fetch("/api/auth/branches").then((r) => r.json()).then((dd) => setAllBranches(dd.branches || []));
      }
    });
  }, [status]);

  const filterBranch = isCentral ? selBranch : (branchId || "");

  const load = useCallback(async () => {
    if (!spreadsheetId) return;
    setLoading(true); setError(null);
    try {
      const url = new URL("/api/payroll/commission-config", window.location.origin);
      url.searchParams.set("spreadsheetId", spreadsheetId);
      if (filterBranch) url.searchParams.set("branchId", filterBranch);
      const res  = await fetch(url.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStaff(data.salesStaff || []);
      setTiers(data.tiers || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [spreadsheetId, filterBranch]);

  useEffect(() => { load(); }, [load]);

  // tiers ที่กำลัง edit (กรองตาม selNick)
  const currentTiers = tiers.filter((t) =>
    selNick === "__default__" ? !t.nickname : t.nickname === selNick
  );

  const updateTier = (idx: number, field: keyof Tier, val: string) => {
    setSaved(false);
    setTiers((prev) => {
      const filtered = prev.filter((t) =>
        selNick === "__default__" ? !t.nickname : t.nickname === selNick
      );
      const others = prev.filter((t) =>
        selNick === "__default__" ? !!t.nickname : t.nickname !== selNick
      );
      const updated = [...filtered];
      if (field === "max") {
        updated[idx] = { ...updated[idx], max: val === "" ? null : Number(val) };
      } else if (field === "min" || field === "rate") {
        updated[idx] = { ...updated[idx], [field]: Number(val) };
      }
      return [...others, ...updated].sort((a, b) => {
        if (a.nickname < b.nickname) return -1;
        if (a.nickname > b.nickname) return 1;
        return a.min - b.min;
      });
    });
  };

  const addTier = () => {
    setSaved(false);
    const last = currentTiers[currentTiers.length - 1];
    const newMin = last ? (last.max ?? (last.min + 10000)) : 0;
    setTiers((prev) => [...prev, { min: newMin, max: null, rate: 0, nickname: selNick === "__default__" ? "" : selNick }]);
  };

  const removeTier = (idx: number) => {
    setSaved(false);
    setTiers((prev) => {
      const filtered = prev.filter((t) =>
        selNick === "__default__" ? !t.nickname : t.nickname === selNick
      );
      const others = prev.filter((t) =>
        selNick === "__default__" ? !!t.nickname : t.nickname !== selNick
      );
      filtered.splice(idx, 1);
      return [...others, ...filtered];
    });
  };

  const save = async () => {
    if (!spreadsheetId) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/payroll/commission-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spreadsheetId, tiers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSaved(true);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  if (status === "loading") return <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e]"><Spinner /></div>;

  return (
    <div className="min-h-screen bg-[#0a0f1e] pb-16">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-green-600/5 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-6 sm:px-6 sm:py-8">

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <button onClick={() => spreadsheetId ? router.push(`/ERP/payroll-branch?spreadsheetId=${spreadsheetId}`) : router.back()} className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-xs font-bold">%</div>
          <h1 className="text-lg font-bold text-white">ตั้งค่าค่าคอมขั้นบันได</h1>
        </div>

        {/* Branch filter (central) */}
        {isCentral && (
          <div className="bg-white/[0.04] rounded-2xl border border-white/10 p-4 mb-5 flex items-center gap-3">
            <label className="text-xs text-slate-400 shrink-0">สาขา</label>
            <select value={selBranch} onChange={(e) => setSelBranch(e.target.value)}
              className="flex-1 px-3 py-2 text-sm text-white bg-white/[0.06] border border-white/10 rounded-xl focus:outline-none transition-all">
              <option value="" className="bg-[#0f1629]">ทุกสาขา</option>
              {allBranches.map((b) => <option key={b.branchId} value={b.branchId} className="bg-[#0f1629]">{b.branchName}</option>)}
            </select>
          </div>
        )}

        {error && <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* Left: เลือกคน */}
          <div className="sm:col-span-1">
            <div className="bg-white/[0.04] backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
              <div className="px-4 py-3 bg-white/[0.03] border-b border-white/5">
                <p className="text-xs font-semibold text-slate-300">เลือกพนักงาน</p>
              </div>
              <div className="p-2 space-y-1">
                {/* default tier */}
                <button
                  onClick={() => setSelNick("__default__")}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${selNick === "__default__" ? "bg-green-500/15 text-green-300 border border-green-500/30" : "text-slate-400 hover:bg-white/5"}`}
                >
                  <div className="font-medium">ค่าคอม default</div>
                  <div className="text-xs opacity-60">ใช้กับทุกคนที่ไม่มีเฉพาะ</div>
                </button>

                {loading ? (
                  <div className="flex justify-center py-4"><Spinner /></div>
                ) : staff.length === 0 ? (
                  <p className="text-xs text-slate-600 px-3 py-2">ไม่พบพนักงานขาย</p>
                ) : (
                  staff.map((s) => {
                    const hasCustom = tiers.some((t) => t.nickname === s.nickname);
                    return (
                      <button key={s.nickname} onClick={() => setSelNick(s.nickname)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${selNick === s.nickname ? "bg-green-500/15 text-green-300 border border-green-500/30" : "text-slate-400 hover:bg-white/5"}`}>
                        <div className="font-medium flex items-center gap-2">
                          {s.nickname}
                          {hasCustom && <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded-md">กำหนดเอง</span>}
                        </div>
                        <div className="text-xs opacity-60">{s.fullName}</div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right: ตั้งค่า tiers */}
          <div className="sm:col-span-2">
            <div className="bg-white/[0.04] backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
              <div className="px-4 py-3 bg-white/[0.03] border-b border-white/5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-300">
                    ขั้นบันได — {selNick === "__default__" ? "ค่าคอม default" : selNick}
                  </p>
                  {selNick !== "__default__" && (
                    <p className="text-[10px] text-slate-500 mt-0.5">ถ้าไม่ตั้งจะใช้ค่า default แทน</p>
                  )}
                </div>
                <button onClick={save} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 transition-all">
                  {saving ? <Spinner /> : saved ? "✓ บันทึกแล้ว" : "บันทึก"}
                </button>
              </div>

              <div className="p-4 space-y-3">
                {/* Header */}
                {currentTiers.length > 0 && (
                  <div className="grid grid-cols-[1fr_1fr_80px_32px] gap-2 px-1">
                    <p className="text-xs text-slate-500">ตั้งแต่ (฿)</p>
                    <p className="text-xs text-slate-500">ถึง (฿, ว่าง=ไม่จำกัด)</p>
                    <p className="text-xs text-slate-500 text-right">อัตรา %</p>
                    <span />
                  </div>
                )}

                {currentTiers.length === 0 && (
                  <div className="text-center py-6">
                    <p className="text-slate-500 text-sm">ยังไม่มีขั้นบันได</p>
                    <p className="text-slate-600 text-xs mt-1">กดเพิ่มเพื่อตั้งค่า</p>
                  </div>
                )}

                {currentTiers.map((tier, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_80px_32px] gap-2 items-center">
                    <input type="number" min="0" value={tier.min} onChange={(e) => updateTier(idx, "min", e.target.value)}
                      className="px-3 py-2 text-sm text-white bg-white/[0.06] border border-white/10 rounded-lg focus:outline-none focus:border-green-500/60 tabular-nums" />
                    <input type="number" min="0" value={tier.max ?? ""} onChange={(e) => updateTier(idx, "max", e.target.value)}
                      placeholder="ไม่จำกัด"
                      className="px-3 py-2 text-sm text-white bg-white/[0.06] border border-white/10 rounded-lg focus:outline-none focus:border-green-500/60 tabular-nums placeholder:text-slate-600" />
                    <input type="number" min="0" max="100" step="0.1" value={tier.rate} onChange={(e) => updateTier(idx, "rate", e.target.value)}
                      className="px-3 py-2 text-sm text-green-300 bg-white/[0.06] border border-white/10 rounded-lg focus:outline-none focus:border-green-500/60 tabular-nums text-right" />
                    <button onClick={() => removeTier(idx)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}

                <button onClick={addTier}
                  className="w-full px-4 py-2.5 text-sm font-medium text-green-400 bg-green-500/5 hover:bg-green-500/10 border-2 border-dashed border-green-500/25 hover:border-green-500/40 rounded-xl transition-all">
                  + เพิ่มขั้น
                </button>

                {/* Preview */}
                {currentTiers.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <p className="text-xs text-slate-500 mb-2">ตัวอย่าง</p>
                    <div className="space-y-1">
                      {currentTiers.map((t, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">
                            {fmtNum(t.min)} – {t.max !== null ? fmtNum(t.max) : "∞"} ฿
                          </span>
                          <span className="text-green-400 font-semibold">{t.rate}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CommissionConfigPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#0a0f1e]"><div className="relative w-5 h-5"><div className="absolute inset-0 rounded-full border-2 border-green-500/20" /><div className="absolute inset-0 rounded-full border-t-2 border-green-400 animate-spin" /></div></div>}>
      <CommissionConfigContent />
    </Suspense>
  );
}
