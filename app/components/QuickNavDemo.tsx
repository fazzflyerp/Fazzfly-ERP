// Path: app/components/QuickNavDemo.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { useSession } from "next-auth/react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface DemoModule {
  moduleId: string;
  moduleName: string;
  spreadsheetId: string;
  sheetName: string;
  configName: string;
  notes?: string;
}

interface NavItem {
  label: string;
  sublabel?: string;
  href: string;
  iconBg: string;
  icon: React.ReactNode;
}

// ─── Route logic (mirrors buildCards in home-demo) ───────────────────────────
function toNavItem(m: DemoModule): NavItem[] {
  const name   = (m.moduleName || "").toUpperCase();
  const config = (m.configName || "").toUpperCase();
  const sheet  = (m.sheetName  || "").toUpperCase();
  const label  = m.moduleName || m.sheetName;
  const sub    = m.notes || m.sheetName;

  const payrollIcon = <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>;
  const cartIcon    = <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>;
  const boxIcon     = <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>;
  const chartIcon   = <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>;
  const cashIcon    = <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>;
  const gridIcon    = <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3zm0 5h16"/></svg>;

  const acctIcon = <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>;

  if (config === "PAYROLL_CONFIG" || name.includes("PAYROLL"))
    return [{ label: "คำนวณเงินเดือน", sublabel: sub, iconBg: "bg-blue-500",
      href: `/ERP/payroll-branch?spreadsheetId=${m.spreadsheetId}`, icon: payrollIcon }];

  if (name === "INV_CENTRAL" || config === "INV_CENTRAL")
    return [{ label: "คลังกลาง", sublabel: "จัดการสต๊อคและอนุมัติ", iconBg: "bg-emerald-500",
      href: "/ERP/inv/central", icon: boxIcon }];

  if (name === "INV_BRANCH")
    return [{ label: "สต๊อคสาขา", sublabel: m.notes || m.sheetName, iconBg: "bg-violet-500",
      href: "/ERP/inv/branch-stock", icon: boxIcon }];

  if (config.includes("FINANCE") || name.startsWith("FINANC") || sheet.startsWith("FINANC"))
    return [
      { label: label, sublabel: "P&L Dashboard", iconBg: "bg-emerald-600",
        href: `/ERP/finance?spreadsheetId=${m.spreadsheetId}&sheetName=${encodeURIComponent(m.sheetName)}&moduleName=${encodeURIComponent(m.moduleName || "Financial Dashboard")}`,
        icon: chartIcon },
      { label: "บัญชี", sublabel: "AR · AP", iconBg: "bg-violet-600",
        href: `/ERP/accounting-demo?spreadsheetId=${m.spreadsheetId}`,
        icon: acctIcon },
    ];

  if (name.includes("EXPENSE") || config.includes("EXPENSE"))
    return [{ label: label, sublabel: sub, iconBg: "bg-orange-500",
      href: `/ERP/expense?spreadsheetId=${m.spreadsheetId}&configName=${encodeURIComponent(m.configName)}&sheetName=${encodeURIComponent(m.sheetName)}&title=${encodeURIComponent(m.moduleName || "ค่าใช้จ่าย")}`,
      icon: cashIcon }];

  if (config.includes("SALES") || name.includes("SALES"))
    return [{ label: label, sublabel: sub, iconBg: "bg-pink-500",
      href: `/ERP/form-demo?moduleId=${m.moduleId}&spreadsheetId=${m.spreadsheetId}&configName=${encodeURIComponent(m.configName)}&sheetName=${encodeURIComponent(m.sheetName)}`,
      icon: cartIcon }];

  return [{ label: label, sublabel: sub, iconBg: "bg-slate-500",
    href: `/ERP/master-data-demo?spreadsheetId=${m.spreadsheetId}&sheetName=${encodeURIComponent(m.sheetName)}&configName=${encodeURIComponent(m.configName)}&moduleName=${encodeURIComponent(m.moduleName)}`,
    icon: gridIcon }];
}

// ─── Icons ───────────────────────────────────────────────────────────────────
const I = {
  close:  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>,
  arrow:  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>,
  chevD:  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>,
  grid:   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>,
  chart:  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>,
  select: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>,
  spin:   <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>,
  lock:   <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>,
};

// ─── Section collapsible ──────────────────────────────────────────────────────
function Section({ label, icon, iconBg, count, open, onToggle, children }: {
  label: string; icon: React.ReactNode; iconBg: string; count?: number;
  open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border border-white/[0.07] rounded-2xl overflow-hidden mb-2">
      <button onClick={onToggle}
        className={`w-full flex items-center gap-3 px-3 py-3 transition-colors ${open ? "bg-white/[0.05]" : "bg-transparent hover:bg-white/[0.04]"}`}
      >
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-none text-white shadow-sm ${iconBg}`}>{icon}</div>
        <span className="flex-1 text-left text-sm font-semibold text-slate-300">{label}</span>
        {count !== undefined && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.07] text-slate-500 mr-1">{count}</span>
        )}
        <span className={`text-slate-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>{I.chevD}</span>
      </button>
      {open && (
        <div className="border-t border-white/[0.06] bg-white/[0.02] px-2 py-2 flex flex-col gap-0.5">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Nav Row ─────────────────────────────────────────────────────────────────
function NavRow({ icon, bg, label, sublabel, locked, onClick }: {
  icon: React.ReactNode; bg: string; label: string; sublabel?: string;
  locked?: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} disabled={locked}
      className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-xl border border-transparent transition-all group text-left
        ${locked ? "opacity-40 cursor-not-allowed" : "hover:bg-white/[0.05] hover:border-white/[0.07]"}`}
    >
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-none text-white shadow-sm ${bg} ${!locked ? "group-hover:scale-105 transition-transform" : ""}`}>
        {locked ? I.lock : icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-300 truncate leading-tight">{label}</p>
        {sublabel && <p className="text-[10px] text-slate-500 truncate mt-0.5">{sublabel}</p>}
      </div>
      {!locked && <span className="text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all flex-none">{I.arrow}</span>}
      {locked && <span className="text-[9px] font-bold text-slate-500 px-1.5 py-0.5 rounded-full bg-white/5 flex-none">เร็วๆนี้</span>}
    </button>
  );
}

// ─── Home Card ───────────────────────────────────────────────────────────────
function HomeCard({ icon, label, sub, grad, onClick }: {
  icon: React.ReactNode; label: string; sub: string; grad: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl text-white shadow-md active:scale-95 transition-all hover:brightness-110 ${grad}`}
    >
      <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">{icon}</div>
      <span className="text-xs font-bold leading-none">{label}</span>
      <span className="text-[9px] opacity-70 leading-none">{sub}</span>
    </button>
  );
}

// ─── Trigger ─────────────────────────────────────────────────────────────────
export function QuickNavDemoTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Quick Navigation"
      className="w-8 h-8 flex flex-col items-center justify-center gap-[4px] bg-white/10 hover:bg-white/15 border border-white/[0.08] rounded-xl transition-all active:scale-95 flex-shrink-0"
    >
      <span className="w-3.5 h-[1.5px] bg-white/80 rounded-full" />
      <span className="w-3.5 h-[1.5px] bg-white/80 rounded-full" />
      <span className="w-3.5 h-[1.5px] bg-white/80 rounded-full" />
    </button>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────────────────
export default function QuickNavDemo({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { data: session } = useSession();
  const router   = useRouter();
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);

  const [navItems,  setNavItems]  = useState<NavItem[]>([]);
  const [isSA,      setIsSA]      = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [fetched,   setFetched]   = useState(false);

  const [open, setOpen] = useState({ erp: false, dash: false });
  const toggle = (k: keyof typeof open) => setOpen(s => ({ ...s, [k]: !s[k] }));

  // fetch once on first open
  useEffect(() => {
    if (!isOpen || fetched || !session) return;
    setLoading(true);
    Promise.all([
      fetch("/api/user/modules-demo").then(r => r.json()),
      fetch("/api/auth/branch-check").then(r => r.json()),
    ])
      .then(([d, auth]) => {
        const role    = (auth.role || "STAFF").toUpperCase();
        const superAdmin = role === "SUPER_ADMIN";
        setIsSA(superAdmin);

        let mods: DemoModule[] = d.modules || [];

        // filter เหมือน home-demo: branch ADMIN ไม่เห็น INV_CENTRAL
        if (!superAdmin) {
          mods = mods.filter(m => {
            const name   = (m.moduleName || "").toUpperCase();
            const config = (m.configName || "").toUpperCase();
            if (name === "INV_CENTRAL" || config === "INV_CENTRAL") return false;
            return true;
          });
        }

        // deduplicate INV_BRANCH + filter generic (master-data) สำหรับ non-SA
        const seen = new Set<string>();
        const items: NavItem[] = [];
        for (const m of mods) {
          const name   = (m.moduleName || "").toUpperCase();
          const config = (m.configName || "").toUpperCase();
          const sheet  = (m.sheetName  || "").toUpperCase();

          if (name === "INV_BRANCH") {
            if (seen.has("__inv_branch__")) continue;
            seen.add("__inv_branch__");
          }

          // generic fallback → master-data-demo: ซ่อนจาก branch ADMIN
          const isGeneric =
            !config.includes("PAYROLL") && config !== "PAYROLL_CONFIG" &&
            name !== "INV_CENTRAL" && name !== "INV_BRANCH" &&
            !config.includes("FINANCE") && !name.startsWith("FINANC") && !sheet.startsWith("FINANC") &&
            !name.includes("EXPENSE") && !config.includes("EXPENSE") &&
            !config.includes("SALES") && !name.includes("SALES");

          if (isGeneric && !superAdmin) continue;

          items.push(...toNavItem(m));
        }
        setNavItems(items);
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setFetched(true); });
  }, [isOpen, fetched, session]);

  // close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    if (isOpen) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [isOpen, onClose]);

  useEffect(() => { onClose(); }, [pathname]);

  const go = (href: string) => { router.push(href); onClose(); };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div ref={panelRef}
        className={`fixed left-0 top-0 h-full z-50 w-[min(272px,85vw)] flex flex-col border-r border-white/[0.07] shadow-2xl transition-transform duration-300 ease-out ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ background: "linear-gradient(180deg, #0d1527 0%, #080e1c 100%)" }}
      >
        {/* ── Header ── */}
        <div className="flex-none px-4 pt-5 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl overflow-hidden">
                <Image src="/logo2.png" alt="Fazzfly" width={32} height={32} className="object-contain" />
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-none">Quick Nav</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Fazzfly Demo</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 text-[9px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />DEMO
              </span>
              <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors">
                {I.close}
              </button>
            </div>
          </div>

          {/* Home shortcuts */}
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">หน้าหลัก</p>
          <div className="grid grid-cols-2 gap-2">
            <HomeCard icon={I.select} label="เลือกระบบ" sub="System Select"
              grad="bg-gradient-to-br from-slate-600 to-slate-700"
              onClick={() => go("/select-system-demo")}
            />
            <HomeCard icon={I.grid} label="ERP Demo" sub="หน้าหลัก"
              grad="bg-gradient-to-br from-blue-600 to-cyan-500"
              onClick={() => go("/ERP/home-demo")}
            />
          </div>
        </div>

        {/* ── Scrollable sections ── */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
              {I.spin}<span className="text-sm">กำลังโหลด...</span>
            </div>
          ) : (
            <>
              {/* โมดูล ERP — dynamic */}
              {navItems.length > 0 && (
                <Section label="โมดูล ERP" icon={I.grid} count={navItems.length}
                  iconBg="bg-gradient-to-br from-blue-500 to-blue-700"
                  open={open.erp} onToggle={() => toggle("erp")}
                >
                  {navItems.map((item, i) => (
                    <NavRow key={i}
                      icon={item.icon} bg={item.iconBg}
                      label={item.label} sublabel={item.sublabel}
                      onClick={() => go(item.href)}
                    />
                  ))}
                </Section>
              )}

              {/* Dashboard */}
              <Section label="Dashboard" icon={I.chart}
                iconBg="bg-gradient-to-br from-indigo-500 to-violet-600"
                open={open.dash} onToggle={() => toggle("dash")}
              >
                <NavRow icon={I.chart} bg="bg-indigo-500"
                  label="Sales Dashboard" sublabel="ยอดขายรายสาขา"
                  onClick={() => go("/ERP/sales-dashboard-demo")}
                />
                <NavRow icon={I.chart} bg="bg-violet-500"
                  label="HR Dashboard" sublabel="ข้อมูลพนักงาน" locked onClick={() => {}}
                />
                <NavRow icon={I.chart} bg="bg-pink-500"
                  label="Finance Dashboard" sublabel="บัญชี & การเงิน" locked onClick={() => {}}
                />
              </Section>

              {/* ขอใช้งานจริง */}
              <div
                className="mt-2 rounded-2xl p-4 border border-amber-500/20 cursor-pointer hover:border-amber-500/40 transition-all"
                style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(251,191,36,0.04) 100%)" }}
                onClick={() => { window.location.href = "/#register"; onClose(); }}
              >
                <p className="text-xs font-bold text-amber-400 mb-0.5">สนใจใช้งานจริงมั้ย?</p>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Demo นี้แสดงเพียงส่วนหนึ่ง<br />ระบบจริงมีฟีเจอร์ครบกว่านี้มาก
                </p>
                <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-amber-400">
                  ขอทดลองใช้ฟรี {I.arrow}
                </span>
              </div>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex-none px-4 py-3 border-t border-white/[0.06]">
          <p className="text-[10px] text-slate-600 text-center">Fazzfly Demo · Quick Navigation</p>
        </div>
      </div>
    </>
  );
}
