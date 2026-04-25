// Path: app/components/QuickNav.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { LangToggle } from "@/app/components/GoogleTranslate";

// ─── Types ──────────────────────────────────────────────────────────────────
interface Module      { moduleId: string; moduleName: string; spreadsheetId: string; sheetName: string; configName: string }
interface DashItem    { dashboardId: string; dashboardName: string; spreadsheetId: string; sheetName: string; dashboardConfigName: string }
interface DocumentItem{ moduleId: string; moduleName: string; spreadsheetId: string; sheetName: string; configName: string }
interface MasterDbItem{ databaseId: string; sheetName: string; spreadsheetId: string; configName: string }

// ─── Route helpers ───────────────────────────────────────────────────────────
const modRoute    = (m: Module)       => `/ERP/form?moduleId=${m.moduleId}&spreadsheetId=${m.spreadsheetId}&configName=${m.configName}&sheetName=${m.sheetName}`;
const dashRoute   = (d: DashItem)    => `/ERP/home?tab=dashboard&dashboardId=${d.dashboardId}`;
const masterRoute = (db: MasterDbItem) => `/ERP/master-data/edit?spreadsheetId=${db.spreadsheetId}&sheetName=${encodeURIComponent(db.sheetName)}&configName=${encodeURIComponent(db.configName)}&title=${encodeURIComponent(db.sheetName)}`;
function docRoute(doc: DocumentItem) {
  const n = doc.moduleName.toLowerCase(), c = (doc.configName || "").toLowerCase();
  if (n.includes("payroll") || n.includes("สลิป") || n.includes("เงินเดือน")) return `/ERP/payroll-slip?moduleId=${doc.moduleId}&spreadsheetId=${doc.spreadsheetId}`;
  if (n.includes("receipt") || n.includes("ใบเสร็จ")) return `/ERP/receipt-simple?moduleId=${doc.moduleId}&spreadsheetId=${doc.spreadsheetId}`;
  if (n.includes("หัก") || n.includes("withholding") || c.includes("หัก_ณ")) return `/ERP/withholding-tax?moduleId=${doc.moduleId}&spreadsheetId=${doc.spreadsheetId}&configName=${encodeURIComponent(doc.configName)}&sheetName=${encodeURIComponent(doc.sheetName)}`;
  return `/ERP/home?tab=documents`;
}

// ─── Icons ───────────────────────────────────────────────────────────────────
const I = {
  close:  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>,
  arrow:  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>,
  chevD:  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>,
  home:   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>,
  grid:   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>,
  chart:  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>,
  doc:    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
  db:     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"/></svg>,
  cal:    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>,
  people: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
  bell:   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>,
  course: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>,
  task:   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>,
  spin:   <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>,
  log:    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M5 12h14M5 16h6"/></svg>,
  erp:    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>,
  crm:    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>,
};

// ─── Section with collapsible content ────────────────────────────────────────
function Section({
  label, icon, iconBg, count, open, onToggle, children,
}: {
  label: string;
  icon: React.ReactNode;
  iconBg: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-slate-100 rounded-2xl overflow-hidden mb-2">
      {/* header row */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-3 py-3 transition-colors ${open ? "bg-slate-50" : "bg-white hover:bg-slate-50"}`}
      >
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-none text-white shadow-sm ${iconBg}`}>
          {icon}
        </div>
        <span className="flex-1 text-left text-sm font-semibold text-slate-700">{label}</span>
        {count !== undefined && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 mr-1">{count}</span>
        )}
        <span className={`text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          {I.chevD}
        </span>
      </button>

      {/* collapsible body */}
      {open && (
        <div className="border-t border-slate-100 bg-white px-2 py-2 flex flex-col gap-0.5">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── CRM tile (2-col grid inside CRM section) ────────────────────────────────
function CRMTile({ icon, label, sublabel, color, onClick }: {
  icon: React.ReactNode; label: string; sublabel: string; color: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-slate-200 hover:shadow-sm transition-all active:scale-95 group">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm ${color} group-hover:scale-105 transition-transform`}>
        {icon}
      </div>
      <span className="text-[11px] font-bold text-slate-600 leading-tight text-center">{label}</span>
      <span className="text-[9px] text-slate-400 leading-tight text-center">{sublabel}</span>
    </button>
  );
}

// ─── Generic row inside a section ─────────────────────────────────────────────
function NavRow({ icon, bg, label, sublabel, onClick }: {
  icon: React.ReactNode; bg: string; label: string; sublabel?: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all group text-left">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-none text-white shadow-sm ${bg} group-hover:scale-105 transition-transform`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-700 truncate leading-tight">{label}</p>
        {sublabel && <p className="text-[10px] text-slate-400 truncate mt-0.5">{sublabel}</p>}
      </div>
      <span className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all flex-none">{I.arrow}</span>
    </button>
  );
}

// ─── Top home shortcut (big pill) ─────────────────────────────────────────────
function HomeCard({ icon, label, sub, grad, onClick }: {
  icon: React.ReactNode; label: string; sub: string; grad: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl text-white shadow-sm active:scale-95 transition-all hover:brightness-110 ${grad}`}>
      <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">{icon}</div>
      <span className="text-xs font-bold leading-none">{label}</span>
      <span className="text-[9px] opacity-70 leading-none">{sub}</span>
    </button>
  );
}

// ─── Trigger (hamburger) ──────────────────────────────────────────────────────
export function QuickNavTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Quick Navigation"
      className="w-9 h-9 flex flex-col items-center justify-center gap-[5px] bg-blue-600 rounded-xl shadow-sm hover:bg-blue-700 transition-all active:scale-95 flex-shrink-0">
      <span className="w-4 h-[2px] bg-white rounded-full"/>
      <span className="w-4 h-[2px] bg-white rounded-full"/>
      <span className="w-4 h-[2px] bg-white rounded-full"/>
    </button>
  );
}

// ─── Bell ─────────────────────────────────────────────────────────────────────
export interface LowStockBellItem { name: string; status: string }
export function QuickNavBell({ items = [], loading = false, onBellClick }: { items?: LowStockBellItem[]; loading?: boolean; onBellClick?: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    if (open) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  useEffect(() => { setOpen(false); }, [pathname]);
  const count = items.length;
  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button onClick={() => setOpen(o => !o)} aria-label="Notifications"
        className="relative w-9 h-9 flex items-center justify-center bg-blue-600 rounded-xl shadow-sm hover:bg-blue-700 transition-all active:scale-95">
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>
        {count > 0 && <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{count > 99 ? "99+" : count}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-11 w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="font-bold text-slate-800 text-sm">แจ้งเตือนสินค้า</p>
            {count > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">{count} รายการ</span>}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {loading
              ? <div className="flex items-center justify-center gap-2 py-8 text-slate-400">{I.spin}<span className="text-sm">กำลังโหลด...</span></div>
              : count === 0
                ? <div className="px-4 py-8 text-center text-slate-400 text-sm">ไม่มีสินค้าใกล้หมด</div>
                : items.map((item, i) => (
                    <button key={i} onClick={() => { setOpen(false); onBellClick?.(); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-50 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-700 truncate flex-1">{item.name}</p>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${item.status === "หมดแล้ว" ? "bg-red-100 text-red-500" : "bg-amber-100 text-amber-600"}`}>{item.status}</span>
                      </div>
                    </button>
                  ))}
          </div>
          <div className="px-4 py-2.5 border-t border-slate-100">
            <button onClick={() => { setOpen(false); onBellClick?.(); }} className="w-full text-xs font-semibold text-blue-500 hover:text-blue-700 text-center">ดู INV Dashboard →</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export default function QuickNav({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { data: session } = useSession();
  const router   = useRouter();
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);

  const [modules,    setModules]    = useState<Module[]>([]);
  const [dashboards, setDashboards] = useState<DashItem[]>([]);
  const [documents,  setDocuments]  = useState<DocumentItem[]>([]);
  const [masterDbs,  setMasterDbs]  = useState<MasterDbItem[]>([]);
  const [hasCRM,     setHasCRM]     = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [fetched,    setFetched]    = useState(false);

  // all sections collapsed by default — user clicks to open
  const [open, setOpen] = useState({
    crm:      false,
    tasks:    false,
    modules:  false,
    dash:     false,
    docs:     false,
    master:   false,
    actlog:   false,
  });
  const toggle = (k: keyof typeof open) => setOpen(s => ({ ...s, [k]: !s[k] }));

  // fetch once on first open
  useEffect(() => {
    if (!isOpen || fetched || !session) return;
    setLoading(true);
    (async () => {
      try {
        const [r1, r3] = await Promise.all([fetch("/api/user/modules"), fetch("/api/master/databases")]);
        if (r1.ok) {
          const d = await r1.json();
          setModules(d.modules || []);
          setDashboards(d.dashboardItems || []);
          setHasCRM(!!d.hasCRM);
          if (d.clientId) {
            const r2 = await fetch(`/api/user/documents?clientId=${d.clientId}`);
            if (r2.ok) { const d2 = await r2.json(); setDocuments(d2.documents || []); }
          }
        }
        if (r3.ok) { const d = await r3.json(); setMasterDbs(d.databases || []); }
      } catch { } finally { setLoading(false); setFetched(true); }
    })();
  }, [isOpen, fetched, session]);

  // close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose(); };
    if (isOpen) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [isOpen, onClose]);

  useEffect(() => { onClose(); }, [pathname]);

  const go = (href: string) => { router.push(href); onClose(); };

  const crmItems = [
    { icon: I.cal,    label: "ปฏิทิน",  sublabel: "Calendar",   color: "bg-violet-500", tab: "cal"     },
    { icon: I.people, label: "ลูกค้า",  sublabel: "Customers",  color: "bg-rose-500",   tab: "custs"   },
    { icon: I.bell,   label: "ติดตาม",  sublabel: "Follow-ups", color: "bg-amber-500",  tab: "follows" },
    { icon: I.course, label: "คอร์ส",   sublabel: "Courses",    color: "bg-emerald-500",tab: "courses"  },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[1px] transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div ref={panelRef}
        className={`fixed left-0 top-0 h-full z-50 w-[min(288px,85vw)] flex flex-col bg-slate-50 border-r border-slate-200 shadow-2xl transition-transform duration-300 ease-out ${isOpen ? "translate-x-0" : "-translate-x-full"}`}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex-none px-4 pt-5 pb-4 bg-white border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-sm">
                {I.grid}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 leading-none">Quick Nav</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Fazzfly Platform</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LangToggle />
              <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                {I.close}
              </button>
            </div>
          </div>

          {/* ── หน้าหลัก shortcuts (always visible) ── */}
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">หน้าหลัก</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <HomeCard
              icon={I.home} label="เลือกระบบ" sub="System Select"
              grad="bg-gradient-to-br from-slate-600 to-slate-700"
              onClick={() => go("/select-system")}
            />
            <HomeCard
              icon={I.erp} label="ERP" sub="หน้าหลัก"
              grad="bg-gradient-to-br from-blue-600 to-cyan-500"
              onClick={() => go("/ERP/home")}
            />
            {hasCRM && (
              <HomeCard
                icon={I.crm} label="CRM" sub="หน้าหลัก"
                grad="bg-gradient-to-br from-violet-600 to-purple-500"
                onClick={() => go("/CRM/home")}
              />
            )}
            <HomeCard
              icon={I.task} label="Tasks" sub="งานทั้งหมด"
              grad="bg-gradient-to-br from-emerald-600 to-teal-500"
              onClick={() => go("/tasks")}
            />
          </div>
        </div>

        {/* ── Scrollable sections ────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
              {I.spin}<span className="text-sm">กำลังโหลด...</span>
            </div>
          ) : (
            <>
              {/* CRM */}
              {hasCRM && (
                <Section label="CRM" icon={I.crm} iconBg="bg-gradient-to-br from-violet-500 to-purple-600"
                  open={open.crm} onToggle={() => toggle("crm")}>
                  <div className="grid grid-cols-2 gap-2 p-1">
                    {crmItems.map(item => (
                      <CRMTile key={item.tab} icon={item.icon} label={item.label} sublabel={item.sublabel}
                        color={item.color} onClick={() => go(`/CRM/home?tab=${item.tab}`)}/>
                    ))}
                  </div>
                </Section>
              )}

              {/* Task Manager */}
              <Section label="Task Manager" icon={I.task} iconBg="bg-gradient-to-br from-emerald-500 to-teal-600"
                open={open.tasks} onToggle={() => toggle("tasks")}>
                <NavRow icon={I.task} bg="bg-emerald-500" label="งานทั้งหมด" sublabel="Task Manager"
                  onClick={() => go("/tasks")}/>
              </Section>

              {/* โมดูล ERP */}
              {modules.length > 0 && (
                <Section label="โมดูล ERP" icon={I.grid} iconBg="bg-gradient-to-br from-blue-500 to-blue-700"
                  count={modules.length} open={open.modules} onToggle={() => toggle("modules")}>
                  {modules.map((m, i) => (
                    <NavRow key={`m-${i}`} icon={I.grid} bg="bg-blue-500" label={m.moduleName} sublabel={m.sheetName}
                      onClick={() => go(modRoute(m))}/>
                  ))}
                </Section>
              )}

              {/* Dashboard */}
              {dashboards.length > 0 && (
                <Section label="Dashboard" icon={I.chart} iconBg="bg-gradient-to-br from-indigo-500 to-violet-600"
                  count={dashboards.length} open={open.dash} onToggle={() => toggle("dash")}>
                  {dashboards.map((d, i) => (
                    <NavRow key={`d-${i}`} icon={I.chart} bg="bg-indigo-500" label={d.dashboardName} sublabel={d.sheetName}
                      onClick={() => go(dashRoute(d))}/>
                  ))}
                </Section>
              )}

              {/* เอกสาร */}
              {documents.length > 0 && (
                <Section label="เอกสาร" icon={I.doc} iconBg="bg-gradient-to-br from-teal-500 to-cyan-600"
                  count={documents.length} open={open.docs} onToggle={() => toggle("docs")}>
                  {documents.map((doc, i) => (
                    <NavRow key={`doc-${i}`} icon={I.doc} bg="bg-teal-500" label={doc.moduleName} sublabel={doc.sheetName}
                      onClick={() => go(docRoute(doc))}/>
                  ))}
                </Section>
              )}

              {/* Master Data */}
              {masterDbs.length > 0 && (
                <Section label="Master Data" icon={I.db} iconBg="bg-gradient-to-br from-slate-500 to-slate-700"
                  count={masterDbs.length} open={open.master} onToggle={() => toggle("master")}>
                  {masterDbs.map((db, i) => (
                    <NavRow key={`db-${i}`} icon={I.db} bg="bg-slate-500" label={db.sheetName} sublabel={db.configName}
                      onClick={() => go(masterRoute(db))}/>
                  ))}
                </Section>
              )}

              {/* Activity Log */}
              <Section label="Activity Log" icon={I.log} iconBg="bg-gradient-to-br from-orange-500 to-rose-600"
                open={open.actlog} onToggle={() => toggle("actlog")}>
                <NavRow icon={I.log} bg="bg-orange-500" label="ประวัติกิจกรรม" sublabel="Activity Log"
                  onClick={() => go("/ERP/home?tab=logs")}/>
              </Section>
            </>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="flex-none px-4 py-3 border-t border-slate-100 bg-white">
          <p className="text-[10px] text-slate-400 text-center">Fazzfly Platform · Quick Navigation</p>
        </div>
      </div>
    </>
  );
}
