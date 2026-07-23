"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const BASE_SYSTEMS = [
  {
    key: "erp",
    label: "Fazzfly ERP",
    sub: "ระบบบริหารจัดการองค์กร",
    route: "/ERP/home-demo",
    gradient: "from-blue-500 via-cyan-500 to-sky-400",
    glowColor: "rgba(59,130,246,0.35)",
    border: "border-blue-200/60",
    demoLocked: false,
    icon: (
      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    key: "crm",
    label: "Fazzfly CRM",
    sub: "ระบบบริหารลูกค้าสัมพันธ์",
    route: "", // ── set dynamically after fetching CRM config ──
    gradient: "from-rose-500 via-pink-500 to-fuchsia-400",
    glowColor: "rgba(244,63,94,0.35)",
    border: "border-rose-200/60",
    demoLocked: true, // ── unlocked dynamically if CRM config found ──
    icon: (
      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    key: "tasks",
    label: "Task Manager",
    sub: "ระบบมอบหมายและติดตามงาน",
    route: "/tasks",
    gradient: "from-violet-500 via-indigo-500 to-blue-500",
    glowColor: "rgba(139,92,246,0.35)",
    border: "border-violet-200/60",
    demoLocked: true,
    icon: (
      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
];

export default function SelectSystemDemoPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [userData, setUserData] = useState<{ clientName: string } | null>(null);
  const [branchName, setBranchName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [systems, setSystems] = useState(BASE_SYSTEMS);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!session) return;
    Promise.all([
      fetch("/api/user/modules-demo").then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
        return data;
      }),
      fetch("/api/auth/branch-check").then((r) => r.json()).catch(() => ({})),
    ])
      .then(([modules, branch]) => {
        setUserData({ clientName: modules.clientName || "Guest" });
        setBranchName(branch.branchName || null);
        setRole(branch.role || null);

        // ── ดึง CRM config จาก client_crm sheet ────────────────────────
        const clientId: string = modules.clientId || "";

        // ── Training card — เฉพาะ C006 ─────────────────────────────────
        if (clientId === "C006") {
          setSystems(prev => {
            if (prev.some(s => s.key === "training")) return prev;
            return [...prev, {
              key: "training",
              label: "คู่มือการใช้งาน",
              sub: "Training & Demo Guide",
              route: "/training",
              gradient: "from-amber-500 via-orange-400 to-yellow-400",
              glowColor: "rgba(245,158,11,0.35)",
              border: "border-amber-200/60",
              demoLocked: false,
              icon: (
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              ),
            }];
          });
        }

        if (clientId) {
          fetch(`/api/crm/modules?clientId=${clientId}`)
            .then(r => r.json())
            .then(crm => {
              if (!crm.hasCRM) return;
              const aptSid  = crm.appointments?.spreadsheetId || "";
              const custSid = crm.Master?.spreadsheetId       || "";
              const flwSid  = crm.followup?.spreadsheetId     || "";
              const aptSheet = crm.appointments?.sheetName    || "appointments";
              const custSheet = crm.Master?.sheetName         || "Customers";
              const flwSheet  = crm.followup?.sheetName       || "followup_tasks";
              if (!aptSid) return;

              const txSid    = crm.transaction?.spreadsheetId || "";
              const txSheet  = crm.transaction?.sheetName     || "";
              const txConfig = crm.transaction?.configName    || "Sales_Config";

              const params = new URLSearchParams({ spreadsheetId: aptSid, aptSheet, clientId });
              if (custSid && custSid !== aptSid) params.set("custSid",    custSid);
              if (flwSid  && flwSid  !== aptSid) params.set("followSid",  flwSid);
              if (custSheet !== "Customers")      params.set("custSheet",  custSheet);
              if (flwSheet  !== "followup_tasks") params.set("followSheet",flwSheet);
              if (txSid)   params.set("txSid",    txSid);
              if (txSheet) params.set("txSheet",  txSheet);
              if (txConfig && txConfig !== "Sales_Config") params.set("txConfig", txConfig);

              const crmRoute = `/ERP/crm?${params.toString()}`;
              setSystems(prev => prev.map(s =>
                s.key === "crm" ? { ...s, route: crmRoute, demoLocked: false } : s
              ));
            })
            .catch(() => { /* CRM ไม่มี config — ทิ้งไว้ locked */ });
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [session]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-blue-500/20" />
            <div className="absolute inset-0 rounded-full border-t-2 border-blue-400 animate-spin" />
          </div>
          <p className="text-slate-400 text-sm tracking-widest uppercase animate-pulse">Loading</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e]">
        <div className="text-center">
          <p className="text-white font-semibold mb-2">โหลดข้อมูลไม่ได้</p>
          <p className="text-slate-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] relative overflow-hidden">

      {/* ── Ambient background ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[120px]" />
        <div className="absolute top-[40%] left-[40%] w-[300px] h-[300px] rounded-full bg-cyan-500/5 blur-[80px]" />
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* ── Topbar ── */}
      <header className="relative z-20 flex items-center justify-between px-6 py-4 border-b border-white/5 backdrop-blur-xl bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl overflow-hidden">
            <Image src="/logo2.png" alt="Fazzfly" width={32} height={32} className="object-contain" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">Fazzfly</span>
          <span className="text-slate-600 text-lg font-light">Platform</span>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-slate-400 hover:text-white text-sm"
        >
          {session?.user?.image && (
            <img src={session.user.image} className="w-5 h-5 rounded-full" alt="" />
          )}
          <span className="hidden sm:inline">{session?.user?.name?.split(" ")[0]}</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" />
          </svg>
        </button>
      </header>

      {/* ── Main ── */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-65px)] px-4 py-16">

        {/* Hero */}
        <div className={`text-center mb-14 transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
          <p className="text-xs uppercase tracking-[0.3em] text-blue-400/80 font-semibold mb-5">
            Enterprise Business Solutions
          </p>
          <h1 className="text-5xl sm:text-6xl font-bold text-white mb-4 leading-tight">
            ยินดีต้อนรับ
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-sky-400 bg-clip-text text-transparent">
              {userData?.clientName}
            </span>
          </h1>

          <div className="flex items-center justify-center gap-3 mt-5 flex-wrap">
            {role && (() => {
              const roleMap: Record<string, { label: string; color: string; dot: string; glow: string }> = {
                SUPER_ADMIN: { label: "Super Admin", color: "border-rose-500/30 bg-rose-500/10 text-rose-300", dot: "bg-rose-400", glow: "shadow-[0_0_6px_2px_rgba(244,63,94,0.5)]" },
                ADMIN:       { label: "Admin",       color: "border-amber-500/30 bg-amber-500/10 text-amber-300", dot: "bg-amber-400", glow: "shadow-[0_0_6px_2px_rgba(251,191,36,0.5)]" },
                STAFF:       { label: "Staff",       color: "border-green-500/30 bg-green-500/10 text-green-300", dot: "bg-green-400", glow: "shadow-[0_0_6px_2px_rgba(74,222,128,0.5)]" },
              };
              const r = roleMap[role] ?? roleMap.STAFF;
              return (
                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border backdrop-blur-xl ${r.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${r.dot} ${r.glow}`} />
                  <span className="text-xs font-bold tracking-widest uppercase">{r.label}</span>
                </div>
              );
            })()}
            {branchName && (
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 backdrop-blur-xl">
                <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-xs font-semibold text-blue-300 tracking-wide">{branchName}</span>
              </div>
            )}
          </div>

          <p className="text-slate-500 mt-6 text-base">เลือกระบบที่ต้องการใช้งาน</p>
        </div>

        {/* Cards */}
        <div className={`grid gap-5 w-full max-w-4xl transition-all duration-700 delay-150 sm:grid-cols-2 lg:grid-cols-3 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          {systems.map((sys, i) => {
            const locked = sys.demoLocked;
            return locked ? (
              /* ── Locked card ── */
              <div key={sys.key} className="group relative" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="relative bg-white/[0.02] backdrop-blur-2xl border border-white/[0.06] rounded-[26px] p-8 flex flex-col gap-6 overflow-hidden opacity-60 select-none">
                  {/* Top shimmer line — dimmed */}
                  <div className={`absolute top-0 left-8 right-8 h-px bg-gradient-to-r ${sys.gradient} opacity-20`} />

                  {/* Lock badge */}
                  <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10">
                    <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">เต็มเท่านั้น</span>
                  </div>

                  {/* Icon — grayscale */}
                  <div className="relative w-fit">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-white/[0.06]">
                      <div className="opacity-40">{sys.icon}</div>
                    </div>
                  </div>

                  {/* Text */}
                  <div>
                    <p className="text-slate-400 font-bold text-xl tracking-tight">{sys.label}</p>
                    <p className="text-slate-600 text-sm mt-1 leading-relaxed">{sys.sub}</p>
                  </div>

                  {/* CTA — locked */}
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/[0.04]">
                    <span className="text-xs font-semibold uppercase tracking-widest text-slate-600">
                      เฉพาะเวอร์ชันเต็ม
                    </span>
                    <button
                      className="text-[10px] font-semibold text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
                      onClick={(e) => { e.stopPropagation(); window.location.href = "/#register"; }}>
                      สนใจ?
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* ── Active card ── */
              <div
                key={sys.key}
                onClick={() => router.push(sys.route)}
                className="group relative cursor-pointer"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div
                  className="absolute -inset-0.5 rounded-[28px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"
                  style={{ background: `radial-gradient(circle, ${sys.glowColor}, transparent 70%)` }}
                />
                <div className={`relative bg-white/[0.04] backdrop-blur-2xl border ${sys.border} rounded-[26px] p-8 flex flex-col gap-6 overflow-hidden transition-all duration-300 group-hover:bg-white/[0.07] group-hover:-translate-y-1`}>
                  <div className={`absolute top-0 left-8 right-8 h-px bg-gradient-to-r ${sys.gradient} opacity-40`} />

                  <div className="relative w-fit">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br ${sys.gradient} shadow-2xl`}
                      style={{ boxShadow: `0 8px 32px ${sys.glowColor}` }}>
                      {sys.icon}
                    </div>
                    <div
                      className="absolute -inset-1 rounded-[18px] opacity-0 group-hover:opacity-40 transition-opacity duration-500 blur-md -z-10"
                      style={{ background: `linear-gradient(135deg, ${sys.glowColor}, transparent)` }}
                    />
                  </div>

                  <div>
                    <p className="text-white font-bold text-xl tracking-tight">{sys.label}</p>
                    <p className="text-slate-400 text-sm mt-1 leading-relaxed">{sys.sub}</p>
                  </div>

                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                    <span className={`text-xs font-semibold uppercase tracking-widest bg-gradient-to-r ${sys.gradient} bg-clip-text text-transparent`}>
                      เข้าใช้งาน
                    </span>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br ${sys.gradient} opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-300`}
                      style={{ boxShadow: `0 4px 12px ${sys.glowColor}` }}>
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <p className="mt-16 text-slate-700 text-xs tracking-widest uppercase">
          © 2026 KHOTSUB SYSTEM 78 CO., LTD.
        </p>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
      `}} />
    </div>
  );
}
