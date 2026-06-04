"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import QuickNavDemo, { QuickNavDemoTrigger } from "@/app/components/QuickNavDemo";

interface FeeConfigItem {
  field_name: string;
  label:      string;
  fee_pct:    number;
  active:     boolean;
}

interface BranchConfig {
  branchId:   string;
  branchName: string;
  configs:    FeeConfigItem[];
  loading:    boolean;
  saving:     boolean;
  saved:      boolean;
  error:      string | null;
  dirty:      boolean;
}

function SettingsPage() {
  const { data: session, status } = useSession();
  const router       = useRouter();
  const searchParams = useSearchParams();

  const spreadsheetId   = searchParams.get("spreadsheetId")   || "";
  const histSheetParam  = searchParams.get("histSheet")        || "Expense Transaction";
  const configNameParam = searchParams.get("configName")       || "";
  const salesConfigName = searchParams.get("salesConfigName")  || "Helper_Sales_config";

  const [navOpen, setNavOpen] = useState(false);
  const [userRole,    setUserRole]    = useState<string>("STAFF");
  const [allBranches, setAllBranches] = useState<{ branchId: string; branchName: string }[]>([]);
  const [branches,    setBranches]    = useState<BranchConfig[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  // ── Batch mode ────────────────────────────────────────────────────────────────
  const [batchMode,       setBatchMode]       = useState<"daily" | "monthly">("daily");
  const [batchModeSaving, setBatchModeSaving] = useState(false);
  const [batchModeSaved,  setBatchModeSaved]  = useState(false);

  const isSuperAdmin = userRole === "SUPER_ADMIN";

  // ── auth redirect ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  // ── load user role + branches + batchMode ────────────────────────────────────
  useEffect(() => {
    if (status !== "authenticated" || !spreadsheetId) return;
    (async () => {
      try {
        const [roleRes, branchRes, modeRes] = await Promise.all([
          fetch("/api/auth/user-role"),
          fetch("/api/auth/branches"),
          fetch(`/api/expense/batch-mode?spreadsheetId=${encodeURIComponent(spreadsheetId)}`),
        ]);
        const roleData   = roleRes.ok   ? await roleRes.json()   : {};
        const branchData = branchRes.ok ? await branchRes.json() : {};
        const modeData   = modeRes.ok   ? await modeRes.json()   : {};
        setUserRole(roleData.role || "STAFF");
        setAllBranches(branchData.branches || []);
        if (modeData.mode) setBatchMode(modeData.mode);
      } catch {}
    })();
  }, [status, spreadsheetId]);

  const saveBatchMode = async (mode: "daily" | "monthly") => {
    if (!isSuperAdmin || !spreadsheetId) return;
    setBatchMode(mode);
    setBatchModeSaving(true);
    setBatchModeSaved(false);
    try {
      await fetch("/api/expense/batch-mode", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ spreadsheetId, mode }),
      });
      setBatchModeSaved(true);
      setTimeout(() => setBatchModeSaved(false), 3000);
    } catch {}
    finally { setBatchModeSaving(false); }
  };

  // ── load fee config ทุก branch ────────────────────────────────────────────────
  const loadAllConfigs = useCallback(async (branches: { branchId: string; branchName: string }[]) => {
    if (!branches.length || !spreadsheetId) return;

    // init state
    setBranches(branches.map((b) => ({
      branchId:   b.branchId,
      branchName: b.branchName,
      configs:    [],
      loading:    true,
      saving:     false,
      saved:      false,
      error:      null,
      dirty:      false,
    })));
    setPageLoading(false);

    // load แต่ละ branch แบบ parallel
    await Promise.all(branches.map(async (b) => {
      try {
        const url = new URL(window.location.origin + "/api/expense/fee-config");
        url.searchParams.set("spreadsheetId",   spreadsheetId);
        url.searchParams.set("branchId",        b.branchId);
        url.searchParams.set("salesConfigName", salesConfigName);
        const res  = await fetch(url.toString());
        const data = res.ok ? await res.json() : {};
        setBranches((prev) => prev.map((br) =>
          br.branchId === b.branchId
            ? { ...br, loading: false, configs: data.configs || [], error: res.ok ? null : (data.error || "โหลดไม่สำเร็จ") }
            : br
        ));
      } catch (e: any) {
        setBranches((prev) => prev.map((br) =>
          br.branchId === b.branchId ? { ...br, loading: false, error: e.message } : br
        ));
      }
    }));
  }, [spreadsheetId, salesConfigName]);

  useEffect(() => {
    if (allBranches.length) loadAllConfigs(allBranches);
  }, [allBranches, loadAllConfigs]);

  // ── save fee config สำหรับ branch เดียว ──────────────────────────────────────
  const saveBranch = useCallback(async (branchId: string) => {
    const br = branches.find((b) => b.branchId === branchId);
    if (!br || !isSuperAdmin) return;

    setBranches((prev) => prev.map((b) =>
      b.branchId === branchId ? { ...b, saving: true, error: null } : b
    ));
    try {
      const res  = await fetch("/api/expense/fee-config", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ spreadsheetId, branchId, configs: br.configs }),
      });
      const data = await res.json().catch(() => ({}));
      setBranches((prev) => prev.map((b) =>
        b.branchId === branchId
          ? { ...b, saving: false, dirty: false, saved: true, error: res.ok ? null : (data.error || "บันทึกไม่สำเร็จ") }
          : b
      ));
      // ล้าง saved badge หลัง 3 วิ
      setTimeout(() => {
        setBranches((prev) => prev.map((b) => b.branchId === branchId ? { ...b, saved: false } : b));
      }, 3000);
    } catch (e: any) {
      setBranches((prev) => prev.map((b) =>
        b.branchId === branchId ? { ...b, saving: false, error: e.message } : b
      ));
    }
  }, [branches, spreadsheetId, isSuperAdmin]);

  // ── update config field ───────────────────────────────────────────────────────
  const updateConfig = (branchId: string, idx: number, patch: Partial<FeeConfigItem>) => {
    setBranches((prev) => prev.map((b) =>
      b.branchId !== branchId ? b : {
        ...b,
        dirty:   true,
        saved:   false,
        configs: b.configs.map((c, i) => i === idx ? { ...c, ...patch } : c),
      }
    ));
  };

  // ── build back URL ────────────────────────────────────────────────────────────
  const backParams = new URLSearchParams({ spreadsheetId, histSheet: histSheetParam });
  if (configNameParam) backParams.set("configName", configNameParam);
  const backUrl = `/ERP/expense?${backParams.toString()}`;

  if (status === "loading" || pageLoading)
    return (
      <div className="min-h-screen bg-[#070d1f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="min-h-screen bg-[#070d1f] text-white">

      {/* ── Sticky top bar ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 h-14 bg-[#070d1f]/95 backdrop-blur border-b border-white/[0.06] flex items-center px-4 gap-3">
        <QuickNavDemoTrigger onClick={() => setNavOpen(true)} />
        <button
          onClick={() => router.push(backUrl)}
          className="p-2 rounded-xl hover:bg-white/10 transition-colors text-slate-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-purple-400 rounded-lg flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
        </div>
        <div>
          <h1 className="text-sm font-bold text-white leading-tight">ตั้งค่าค่าธรรมเนียม &amp; VAT</h1>
          {!isSuperAdmin && (
            <p className="text-[10px] text-amber-400">อ่านได้อย่างเดียว — Central เท่านั้นที่แก้ไขได้</p>
          )}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* ── Batch Mode Card ─────────────────────────────────────────────────── */}
        <div className="bg-[#0f1629] border border-white/[0.07] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-500/30 to-blue-500/30 border border-cyan-500/30 rounded-xl flex items-center justify-center">
                <svg className="w-4 h-4 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">รูปแบบการบันทึกค่าธรรมเนียม</p>
                <p className="text-[10px] text-slate-500">ใช้กับทุกสาขาพร้อมกัน</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {batchModeSaving && (
                <div className="w-3.5 h-3.5 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
              )}
              {batchModeSaved && !batchModeSaving && (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/30 rounded-full text-[11px] font-semibold text-emerald-400">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                  </svg>
                  บันทึกแล้ว
                </span>
              )}
              {!isSuperAdmin && (
                <span className="text-[10px] text-slate-600">อ่านได้อย่างเดียว</span>
              )}
            </div>
          </div>

          <div className="px-5 py-4 grid grid-cols-2 gap-3">
            {([
              {
                value:   "daily" as const,
                label:   "แยกรายวัน",
                desc:    "1 แถวต่อวันที่ที่ลูกค้าทำรายการ — ตรงกับยอดจริงแต่ละวัน",
                color:   "cyan",
              },
              {
                value:   "monthly" as const,
                label:   "รวมรายเดือน",
                desc:    "1 แถวต่อเดือน รวมยอดทั้งเดือน — ใช้วันสุดท้ายของเดือน",
                color:   "purple",
              },
            ] as const).map((opt) => {
              const active = batchMode === opt.value;
              const colorCls = opt.color === "cyan"
                ? { card: "bg-cyan-500/10 border-cyan-500/30", dot: "border-cyan-400", fill: "bg-cyan-400", text: "text-cyan-300" }
                : { card: "bg-purple-500/10 border-purple-500/30", dot: "border-purple-400", fill: "bg-purple-400", text: "text-purple-300" };
              return (
                <button
                  key={opt.value}
                  disabled={!isSuperAdmin || batchModeSaving}
                  onClick={() => saveBatchMode(opt.value)}
                  className={`flex flex-col gap-2 px-4 py-3.5 rounded-xl border text-left transition-all disabled:cursor-not-allowed ${
                    active
                      ? `${colorCls.card}`
                      : "bg-white/[0.02] border-white/[0.06] hover:border-white/15"
                  }`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      active ? colorCls.dot : "border-slate-600"
                    }`}>
                      {active && <span className={`w-1.5 h-1.5 rounded-full ${colorCls.fill}`} />}
                    </span>
                    <span className={`text-sm font-semibold ${active ? colorCls.text : "text-slate-400"}`}>
                      {opt.label}
                    </span>
                  </div>
                  <p className={`text-[11px] pl-5 leading-relaxed ${active ? "text-slate-300" : "text-slate-600"}`}>
                    {opt.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {branches.length === 0 && (
          <div className="text-center py-16 text-slate-500 text-sm">ไม่พบข้อมูลสาขา</div>
        )}

        {branches.map((br) => (
          <BranchCard
            key={br.branchId}
            branch={br}
            isSuperAdmin={isSuperAdmin}
            onUpdate={updateConfig}
            onSave={saveBranch}
          />
        ))}
      </div>
      <QuickNavDemo isOpen={navOpen} onClose={() => setNavOpen(false)} />
    </div>
  );
}

// ─── BranchCard ───────────────────────────────────────────────────────────────

function BranchCard({
  branch,
  isSuperAdmin,
  onUpdate,
  onSave,
}: {
  branch:       BranchConfig;
  isSuperAdmin: boolean;
  onUpdate:     (branchId: string, idx: number, patch: Partial<FeeConfigItem>) => void;
  onSave:       (branchId: string) => void;
}) {
  const { branchId, branchName, configs, loading, saving, saved, error, dirty } = branch;

  return (
    <div className="bg-[#0f1629] border border-white/[0.07] rounded-2xl overflow-hidden">

      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-indigo-500/30 rounded-xl flex items-center justify-center">
            <svg className="w-4 h-4 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{branchName}</p>
            <p className="text-[10px] text-slate-500">{branchId}</p>
          </div>
        </div>

        {/* status badges */}
        <div className="flex items-center gap-2">
          {loading && (
            <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          )}
          {saved && !dirty && (
            <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/30 rounded-full text-[11px] font-semibold text-emerald-400">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
              </svg>
              บันทึกแล้ว
            </span>
          )}
          {dirty && !saving && isSuperAdmin && (
            <span className="px-2.5 py-1 bg-amber-500/15 border border-amber-500/30 rounded-full text-[11px] font-semibold text-amber-400">
              มีการแก้ไข
            </span>
          )}
        </div>
      </div>

      {/* Config rows */}
      <div className="px-5 py-4">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-white/[0.03] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : configs.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">ไม่พบ payment channel — ตรวจสอบ {`Helper_Sales_config`}</p>
        ) : (
          <div className="space-y-2">
            {configs.map((fc, idx) => (
              <div
                key={fc.field_name}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                  fc.active
                    ? "bg-purple-500/10 border-purple-500/25"
                    : "bg-white/[0.02] border-white/[0.05]"
                }`}>

                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={fc.active}
                  disabled={!isSuperAdmin}
                  onChange={() => onUpdate(branchId, idx, { active: !fc.active })}
                  className="w-4 h-4 shrink-0 accent-purple-500 cursor-pointer disabled:cursor-not-allowed"
                />

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${fc.active ? "text-white" : "text-slate-500"}`}>
                    {fc.label}
                  </p>
                  {fc.field_name === "__vat__" && (
                    <p className="text-[10px] text-amber-400/80">คิดจากยอดขายรวม</p>
                  )}
                </div>

                {/* % input */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={fc.fee_pct}
                    readOnly={!isSuperAdmin}
                    disabled={!fc.active || !isSuperAdmin}
                    onChange={(e) => onUpdate(branchId, idx, { fee_pct: Number(e.target.value) || 0 })}
                    className={`w-16 px-2 py-1.5 text-sm text-right rounded-lg border transition-colors
                      bg-white/[0.05] text-white
                      focus:outline-none focus:ring-1 focus:ring-purple-500/50
                      disabled:opacity-30 read-only:cursor-default
                      ${fc.active && isSuperAdmin
                        ? "border-white/15 hover:border-purple-500/40"
                        : "border-white/[0.06]"
                      }`}
                  />
                  <span className="text-xs text-slate-400 w-3">%</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            {error}
          </div>
        )}
      </div>

      {/* Footer — save button */}
      {isSuperAdmin && !loading && configs.length > 0 && (
        <div className="px-5 pb-4 flex justify-end">
          <button
            onClick={() => onSave(branchId)}
            disabled={saving || !dirty}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
              dirty
                ? "text-white bg-gradient-to-r from-purple-500 to-purple-400 hover:from-purple-600 hover:to-purple-500 shadow-lg shadow-purple-500/20"
                : "text-slate-500 bg-white/[0.03] border border-white/[0.06] cursor-not-allowed"
            }`}>
            {saving ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                กำลังบันทึก...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
                </svg>
                บันทึก {branchName}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── export ───────────────────────────────────────────────────────────────────

export default function Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#070d1f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SettingsPage />
    </Suspense>
  );
}
