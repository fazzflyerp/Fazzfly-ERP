// Path: app/components/QuickNav.tsx
"use client";

/**
 * QuickNav — Side panel + Bell
 * Usage:
 *   <QuickNav isOpen={open} onClose={() => setOpen(false)} />
 *   <QuickNavBell />        ← ใส่ใน navbar
 *   <QuickNavTrigger onClick={() => setOpen(true)} />  ← ใส่ใน navbar
 */

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

// ─── Types ───────────────────────────────────────────
interface Module {
  moduleId: string;
  moduleName: string;
  spreadsheetId: string;
  sheetName: string;
  configName: string;
}
interface DashboardItem {
  dashboardId: string;
  dashboardName: string;
  spreadsheetId: string;
  sheetName: string;
  dashboardConfigName: string;
}
interface DocumentItem {
  moduleId: string;
  moduleName: string;
  spreadsheetId: string;
  sheetName: string;
  configName: string;
}
interface MasterDbItem {
  databaseId: string;
  sheetName: string;
  spreadsheetId: string;
  configName: string;
}

type TabType = "modules" | "dashboards" | "documents" | "masterdata" | "crm";

// ─── Route helpers ────────────────────────────────────
function getModuleFormRoute(mod: Module): string {
  return `/ERP/form?moduleId=${mod.moduleId}&spreadsheetId=${mod.spreadsheetId}&configName=${mod.configName}&sheetName=${mod.sheetName}`;
}
function getDashboardRoute(item: DashboardItem): string {
  return `/ERP/home?tab=dashboard&dashboardId=${item.dashboardId}`;
}
function getDocumentRoute(doc: DocumentItem): string {
  const n = doc.moduleName.toLowerCase();
  const c = (doc.configName || "").toLowerCase();
  if (n.includes("payroll") || n.includes("payslip") || n.includes("เงินเดือน") || n.includes("สลิป"))
    return `/ERP/payroll-slip?moduleId=${doc.moduleId}&spreadsheetId=${doc.spreadsheetId}`;
  if (n.includes("receipt") || n.includes("ใบเสร็จ"))
    return `/ERP/receipt-simple?moduleId=${doc.moduleId}&spreadsheetId=${doc.spreadsheetId}`;
  if (n.includes("หัก") || n.includes("withholding") || c.includes("หัก_ณ") || c.includes("withholding"))
    return `/ERP/withholding-tax?moduleId=${doc.moduleId}&spreadsheetId=${doc.spreadsheetId}&configName=${encodeURIComponent(doc.configName)}&sheetName=${encodeURIComponent(doc.sheetName)}`;
  return `/ERP/home?tab=documents`;
}
function getMasterDataRoute(db: MasterDbItem): string {
  return `/ERP/master-data/edit?spreadsheetId=${db.spreadsheetId}&sheetName=${encodeURIComponent(db.sheetName)}&configName=${encodeURIComponent(db.configName)}&title=${encodeURIComponent(db.sheetName)}`;
}

// ─── Color map ────────────────────────────────────────
interface Accent { bg: string; text: string }

function getModuleAccent(name: string): Accent {
  const n = name.toLowerCase();
  if (n.includes("sales")     || n.includes("ขาย"))         return { bg: "bg-emerald-500", text: "text-emerald-700" };
  if (n.includes("purchase")  || n.includes("จัดซื้อ"))     return { bg: "bg-violet-500",  text: "text-violet-700"  };
  if (n.includes("expense")   || n.includes("ค่าใช้จ่าย"))  return { bg: "bg-rose-500",    text: "text-rose-700"    };
  if (n.includes("inventory") || n.includes("สต") || n.includes("คลัง")) return { bg: "bg-amber-500", text: "text-amber-700" };
  if (n.includes("payroll")   || n.includes("เงินเดือน"))   return { bg: "bg-teal-500",    text: "text-teal-700"    };
  if (n.includes("financial") || n.includes("การเงิน"))     return { bg: "bg-cyan-600",    text: "text-cyan-700"    };
  if (n.includes("usage")     || n.includes("การใช้"))       return { bg: "bg-pink-500",    text: "text-pink-700"    };
  return { bg: "bg-blue-500", text: "text-blue-700" };
}

function getDocumentAccent(name: string): Accent {
  const n = name.toLowerCase();
  if (n.includes("payroll") || n.includes("payslip") || n.includes("เงินเดือน") || n.includes("สลิป"))
    return { bg: "bg-teal-500",    text: "text-teal-700"    };
  if (n.includes("receipt") || n.includes("ใบเสร็จ"))
    return { bg: "bg-emerald-500", text: "text-emerald-700" };
  if (n.includes("invoice") || n.includes("ใบแจ้งหนี้"))
    return { bg: "bg-blue-500",    text: "text-blue-700"    };
  if (n.includes("quotation") || n.includes("ใบเสนอราคา"))
    return { bg: "bg-orange-500",  text: "text-orange-700"  };
  return { bg: "bg-emerald-500", text: "text-emerald-700" };
}

// ─── SVG Icons ────────────────────────────────────────
const IconGrid = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);
const IconChart = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);
const IconDoc = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);
const IconDb = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
  </svg>
);
const IconHome = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);
const IconArrow = ({ dir = "right" }: { dir?: "left" | "right" }) => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
    style={{ transform: dir === "left" ? "rotate(180deg)" : undefined }}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);
const IconClose = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const IconCRM = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const IconSpinner = () => (
  <svg className="w-4 h-4 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
  </svg>
);


function ModuleIcon({ name }: { name: string }) {
  const n = name.toLowerCase();
  if (n.includes("sales") || n.includes("ขาย"))
    return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
  if (n.includes("purchase") || n.includes("จัดซื้อ"))
    return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1.5 6M17 13l1.5 6M9 19a1 1 0 11-2 0 1 1 0 012 0zm10 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>;
  if (n.includes("expense") || n.includes("ค่าใช้จ่าย"))
    return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
  if (n.includes("inventory") || n.includes("สต") || n.includes("คลัง"))
    return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
  if (n.includes("payroll") || n.includes("เงินเดือน"))
    return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
  if (n.includes("financial") || n.includes("การเงิน"))
    return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>;
  if (n.includes("usage") || n.includes("การใช้"))
    return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
  return <IconGrid />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 pt-3 pb-1.5">
      {children}
    </p>
  );
}

function NavItem({ iconBg, iconNode, label, sublabel, isActive, activeTextClass, onClick }: {
  iconBg: string;
  iconNode: React.ReactNode;
  label: string;
  sublabel?: string;
  isActive: boolean;
  activeTextClass: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left
        border transition-all duration-150 group
        ${isActive ? "bg-slate-50 border-slate-200" : "border-transparent hover:bg-slate-50 hover:border-slate-100"}
      `}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-none text-white shadow-sm transition-transform duration-150 group-hover:scale-105 ${iconBg}`}>
        {iconNode}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold leading-tight truncate ${isActive ? activeTextClass : "text-slate-700"}`}>
          {label}
        </p>
        {sublabel && <p className="text-[10px] text-slate-400 mt-0.5 truncate">{sublabel}</p>}
      </div>
      <span className={`flex-none transition-all ${isActive ? activeTextClass : "text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5"}`}>
        <IconArrow />
      </span>
    </button>
  );
}

const TABS: { id: TabType; label: string; icon: React.ReactNode }[] = [
  { id: "modules",    label: "โมดูล",  icon: <IconGrid />  },
  { id: "dashboards", label: "Dash",   icon: <IconChart /> },
  { id: "documents",  label: "เอกสาร", icon: <IconDoc />   },
  { id: "masterdata", label: "Master", icon: <IconDb />    },
  { id: "crm",        label: "CRM",    icon: <IconCRM />   },
];

// ─── Hamburger Trigger — ใส่ใน navbar ────────────────
export function QuickNavTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Quick Navigation"
      className="w-9 h-9 flex flex-col items-center justify-center gap-[5px] bg-blue-600 rounded-xl shadow-sm hover:bg-blue-700 transition-all duration-200 active:scale-95 flex-shrink-0"
    >
      <span className="w-4 h-[2px] bg-white rounded-full" />
      <span className="w-4 h-[2px] bg-white rounded-full" />
      <span className="w-4 h-[2px] bg-white rounded-full" />
    </button>
  );
}

// ─── Bell Button — ใส่ใน navbar ──────────────────────
export interface LowStockBellItem { name: string; status: string; }

export function QuickNavBell({
  items = [],
  loading = false,
  onBellClick,
}: {
  items?: LowStockBellItem[];
  loading?: boolean;
  onBellClick?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  useEffect(() => { setOpen(false); }, [pathname]);

  const handleItemClick = () => { setOpen(false); onBellClick?.(); };

  const count = items.length;

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Low Stock Notifications"
        className="relative w-9 h-9 flex items-center justify-center bg-blue-600 rounded-xl shadow-sm hover:bg-blue-700 transition-all duration-200 active:scale-95"
      >
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-72 bg-white rounded-2xl shadow-2xl shadow-slate-200 border border-slate-100 overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="font-bold text-slate-800 text-sm">แจ้งเตือนสินค้า</p>
            {count > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">
                {count} รายการ
              </span>
            )}
          </div>

          {/* List */}
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8">
                <svg className="w-4 h-4 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span className="text-sm text-slate-400">กำลังโหลด...</span>
              </div>
            ) : count === 0 ? (
              <div className="px-4 py-8 text-center text-slate-400 text-sm">ไม่มีสินค้าใกล้หมด 🎉</div>
            ) : (
              items.map((item, i) => {
                const isOut = item.status === "หมดแล้ว";
                return (
                  <button
                    key={i}
                    onClick={handleItemClick}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-700 truncate flex-1">{item.name}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${isOut ? "bg-red-100 text-red-500" : "bg-amber-100 text-amber-600"}`}>
                        {item.status}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-slate-100">
            <button
              onClick={handleItemClick}
              className="w-full text-xs font-semibold text-blue-500 hover:text-blue-700 transition-colors text-center"
            >
              ดู INV Dashboard →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Panel Component ─────────────────────────────
export default function QuickNav({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { data: session } = useSession();
  const router   = useRouter();
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);

  const [tab,        setTab]        = useState<TabType>("modules");
  const [modules,    setModules]    = useState<Module[]>([]);
  const [dashboards, setDashboards] = useState<DashboardItem[]>([]);
  const [documents,  setDocuments]  = useState<DocumentItem[]>([]);
  const [masterDbs,  setMasterDbs]  = useState<MasterDbItem[]>([]);
  const [hasCRM,     setHasCRM]     = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [fetched,    setFetched]    = useState(false);

  // Fetch once on first open
  useEffect(() => {
    if (!isOpen || fetched || !session) return;
    const load = async () => {
      setLoading(true);
      try {
        const [r1, r3] = await Promise.all([
          fetch("/api/user/modules"),
          fetch("/api/master/databases"),
        ]);
        if (r1.ok) {
          const d = await r1.json();
          const mods = d.modules || [];
          const dash = d.dashboardItems || [];
          setModules(mods);
          setDashboards(dash);
          setHasCRM(!!d.hasCRM);
          if (d.clientId) {
            const r2 = await fetch(`/api/user/documents?clientId=${d.clientId}`);
            if (r2.ok) { const d2 = await r2.json(); setDocuments(d2.documents || []); }
          }
          // เปิด tab แรกที่มีข้อมูลอัตโนมัติ
          if (mods.length > 0) setTab("modules");
          else if (dash.length > 0) setTab("dashboards");
          else if (d.hasCRM) setTab("crm");
        }
        if (r3.ok) { const d = await r3.json(); setMasterDbs(d.databases || []); }
      } catch (e) {
        console.error("QuickNav fetch error:", e);
      } finally {
        setLoading(false);
        setFetched(true);
      }
    };
    load();
  }, [isOpen, fetched, session]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    if (isOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose]);

  // Close on route change
  useEffect(() => { onClose(); }, [pathname]);

  const navigate = (href: string) => { router.push(href); onClose(); };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[1px] transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      {/* Side Panel */}
      <div
        ref={panelRef}
        className={`
          fixed left-0 top-0 h-full z-50 w-72 flex flex-col
          bg-white border-r border-slate-100 shadow-2xl shadow-slate-300/50
          transition-transform duration-300 ease-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Header */}
        <div className="flex-none px-4 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-sm">
                <IconGrid />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 leading-none">Quick Nav</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Fazzfly ERP</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <IconClose />
            </button>
          </div>

          {/* ERP Home shortcut */}
          <button
            onClick={() => navigate("/ERP/home")}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100 hover:border-blue-200 hover:shadow-sm transition-all group"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
              <IconHome />
            </div>
            <span className="flex-1 text-sm font-semibold text-blue-700 text-left">ERP Home</span>
            <IconArrow />
          </button>

          {/* CRM Home shortcut — ซ่อนถ้าไม่มีสิทธิ์ CRM */}
          {hasCRM && <button
            onClick={() => navigate("/CRM/home")}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100 hover:border-violet-200 hover:shadow-sm transition-all group mt-2"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
              <IconCRM />
            </div>
            <span className="flex-1 text-sm font-semibold text-violet-700 text-left">CRM Home</span>
            <IconArrow />
          </button>}
        </div>

        {/* Tab Switcher — ซ่อน tab ที่ไม่มีข้อมูล */}
        {(() => {
          const visibleTabs = TABS.filter((t) => {
            if (t.id === "modules")    return modules.length > 0;
            if (t.id === "dashboards") return dashboards.length > 0;
            if (t.id === "documents")  return documents.length > 0;
            if (t.id === "masterdata") return masterDbs.length > 0;
            if (t.id === "crm")        return hasCRM;
            return true;
          });
          if (visibleTabs.length === 0) return null;
          return (
            <div className="flex-none px-3 pt-3 pb-2">
              <div className={`grid gap-1 p-1 bg-slate-100 rounded-xl`} style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))` }}>
                {visibleTabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`
                      flex flex-col items-center gap-0.5 py-2 rounded-lg
                      text-[10px] font-semibold transition-all duration-150
                      ${tab === t.id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}
                    `}
                  >
                    {t.icon}
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2">
              <IconSpinner />
              <span className="text-sm text-slate-400">กำลังโหลด...</span>
            </div>
          ) : (
            <>
              {tab === "modules" && (
                <>
                  <SectionLabel>โมดูลทั้งหมด ({modules.length})</SectionLabel>
                  {modules.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-8">ไม่พบโมดูล</p>
                  ) : modules.map((mod, i) => {
                    const accent = getModuleAccent(mod.moduleName);
                    return (
                      <NavItem key={`mod-${mod.moduleId}-${i}`} iconBg={accent.bg} iconNode={<ModuleIcon name={mod.moduleName} />}
                        label={mod.moduleName} sublabel={`เพิ่มข้อมูล · ${mod.sheetName}`}
                        isActive={false} activeTextClass={accent.text}
                        onClick={() => navigate(getModuleFormRoute(mod))} />
                    );
                  })}
                </>
              )}

              {tab === "dashboards" && (
                <>
                  <SectionLabel>Dashboard ({dashboards.length})</SectionLabel>
                  {dashboards.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-8">ไม่พบ Dashboard</p>
                  ) : dashboards.map((dash, i) => {
                    const isActive = pathname.includes(dash.dashboardConfigName);
                    return (
                      <NavItem key={`dash-${dash.dashboardId}-${i}`} iconBg={isActive ? "bg-violet-600" : "bg-violet-500"}
                        iconNode={<IconChart />} label={dash.dashboardName} sublabel={dash.sheetName}
                        isActive={isActive} activeTextClass="text-violet-700"
                        onClick={() => navigate(getDashboardRoute(dash))} />
                    );
                  })}
                </>
              )}

              {tab === "documents" && (
                <>
                  <SectionLabel>เอกสาร ({documents.length})</SectionLabel>
                  {documents.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-xs text-slate-400 mb-3">ไม่พบโมดูลเอกสาร</p>
                      <button onClick={() => navigate("/ERP/home?tab=documents")} className="text-xs text-emerald-600 hover:underline">ดูใน ERP Home →</button>
                    </div>
                  ) : documents.map((doc, i) => {
                    const accent = getDocumentAccent(doc.moduleName);
                    const href   = getDocumentRoute(doc);
                    return (
                      <NavItem key={`doc-${doc.moduleId}-${i}`} iconBg={accent.bg} iconNode={<IconDoc />}
                        label={doc.moduleName} sublabel={doc.sheetName}
                        isActive={pathname === href.split("?")[0]} activeTextClass={accent.text}
                        onClick={() => navigate(href)} />
                    );
                  })}
                </>
              )}

              {tab === "masterdata" && (
                <>
                  <SectionLabel>Master Data ({masterDbs.length})</SectionLabel>
                  {masterDbs.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-xs text-slate-400 mb-3">ไม่พบ Master Database</p>
                      <button onClick={() => navigate("/ERP/home?tab=masterdata")} className="text-xs text-indigo-600 hover:underline">ดูใน ERP Home →</button>
                    </div>
                  ) : masterDbs.map((db, i) => {
                    const href = getMasterDataRoute(db);
                    const isActive = pathname.includes("master-data") && decodeURIComponent(pathname).includes(db.sheetName);
                    return (
                      <NavItem key={`db-${db.databaseId}-${i}`} iconBg={isActive ? "bg-indigo-600" : "bg-indigo-500"}
                        iconNode={<IconDb />} label={db.sheetName} sublabel={db.configName}
                        isActive={isActive} activeTextClass="text-indigo-700"
                        onClick={() => navigate(href)} />
                    );
                  })}
                </>
              )}

              {tab === "crm" && (
                <>
                  <SectionLabel>CRM — ลูกค้าสัมพันธ์</SectionLabel>
                  {[
                    { label: "ปฏิทิน & นัดหมาย", sublabel: "Appointments Calendar", href: "/CRM/home", bg: "bg-violet-500", text: "text-violet-700" },
                    { label: "ลูกค้า",             sublabel: "Customers",             href: "/CRM/home", bg: "bg-emerald-500", text: "text-emerald-700" },
                    { label: "การติดตาม",           sublabel: "Follow-ups",            href: "/CRM/home", bg: "bg-amber-500",   text: "text-amber-700"   },
                    { label: "คอร์ส / สินค้า",     sublabel: "Courses & Products",    href: "/CRM/home", bg: "bg-pink-500",    text: "text-pink-700"    },
                  ].map((item) => (
                    <NavItem key={item.label}
                      iconBg={pathname.startsWith("/CRM") ? item.bg.replace("500","600") : item.bg}
                      iconNode={<IconCRM />} label={item.label} sublabel={item.sublabel}
                      isActive={pathname.startsWith("/CRM")} activeTextClass={item.text}
                      onClick={() => navigate(item.href)} />
                  ))}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex-none px-4 py-3 border-t border-slate-100">
          <p className="text-[10px] text-slate-400 text-center">Fazzfly Platform · Quick Navigation</p>
        </div>
      </div>
    </>
  );
}
