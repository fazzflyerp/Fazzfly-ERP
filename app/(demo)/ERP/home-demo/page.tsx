"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import QuickNavDemo, { QuickNavDemoTrigger } from "@/app/components/QuickNavDemo";

interface Module {
  moduleId: string;
  moduleName: string;
  spreadsheetId: string;
  sheetName: string;
  configName: string;
  notes?: string;
}

interface Action {
  label: string;
  href: string;
  primary?: boolean;
}

interface ModuleCard {
  key: string;
  group: string;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  gradient: string;
  shadowColor: string;
  actions: Action[];
}

function buildCards(modules: Module[]): ModuleCard[] {
  const cards: ModuleCard[] = [];

  for (const m of modules) {
    const name   = (m.moduleName  || "").toUpperCase();
    const config = (m.configName  || "").toUpperCase();
    const notes  = (m.notes       || "").trim();

    // ── Payroll ──────────────────────────────────────────────────────
    if (config === "PAYROLL_CONFIG" || name.includes("PAYROLL")) {
      cards.push({
        key:        m.moduleId,
        group:      "HR & Payroll",
        label:      "คำนวณเงินเดือน",
        sublabel:   notes || m.sheetName || undefined,
        gradient:   "from-blue-500 to-cyan-400",
        shadowColor:"rgba(59,130,246,0.35)",
        icon: (
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        ),
        actions: [
          { label: "คำนวณเงินเดือน", href: `/ERP/payroll-branch?spreadsheetId=${m.spreadsheetId}`, primary: true },
        ],
      });
      continue;
    }

    // ── INV Central ──────────────────────────────────────────────────
    if (name === "INV_CENTRAL" || config === "INV_CENTRAL") {
      cards.push({
        key:        m.moduleId,
        group:      "ระบบสต๊อค",
        label:      "คลังกลาง",
        sublabel:   undefined,
        gradient:   "from-emerald-500 to-teal-400",
        shadowColor:"rgba(16,185,129,0.35)",
        icon: (
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
          </svg>
        ),
        actions: [
          { label: "คลังกลาง",     href: "/ERP/inv/central",  primary: true },
          { label: "สั่งซื้อ",      href: "/ERP/inv/purchase" },
          { label: "จัดการสินค้า", href: "/ERP/master-data-demo?spreadsheetId=1XbHnhzkkLREggF7WTlRoND-dPPBBtGwM6St7l2nMP8A&sheetName=Product&configName=Product_config&moduleName=Product&tab=edit" },
        ],
      });
      continue;
    }

    // ── INV Branch — รวมทุกสาขาเป็น card เดียว, switch ข้างใน ────────
    if (name === "INV_BRANCH") {
      if (!cards.some((c) => c.key === "__inv_branch__")) {
        cards.push({
          key:        "__inv_branch__",
          group:      "ระบบสต๊อค",
          label:      "สต๊อคสาขา",
          sublabel:   "เลือกสาขาได้ภายในหน้า",
          gradient:   "from-violet-500 to-purple-400",
          shadowColor:"rgba(139,92,246,0.35)",
          icon: (
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          ),
          actions: [
            { label: "สต๊อคสาขา", href: "/ERP/inv/branch-stock", primary: true },
          ],
        });
      }
      continue;
    }

    // ── Finance / P&L ────────────────────────────────────────────────
    const sheet = (m.sheetName || "").toUpperCase();
    if (config.includes("FINANCE") || name.startsWith("FINANC") || sheet.startsWith("FINANC") || config.includes("FINANCE_DASHBOARD")) {
      // card 1 — P&L Dashboard
      cards.push({
        key:        m.moduleId,
        group:      "การเงิน",
        label:      m.moduleName || "Financial Dashboard",
        sublabel:   notes || "P&L รายงวด · Sync อัตโนมัติ",
        gradient:   "from-emerald-500 to-teal-400",
        shadowColor:"rgba(16,185,129,0.35)",
        icon: (
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
        actions: [
          {
            label: "ดู P&L Dashboard",
            href:  `/ERP/finance?spreadsheetId=${m.spreadsheetId}&sheetName=${encodeURIComponent(m.sheetName)}&moduleName=${encodeURIComponent(m.moduleName || "Financial Dashboard")}`,
            primary: true,
          },
        ],
      });
      // card 2 — Accounting (AR / AP) ออกอัตโนมัติจาก Finance module
      cards.push({
        key:        `${m.moduleId}__accounting`,
        group:      "การเงิน",
        label:      "บัญชี",
        sublabel:   "ลูกหนี้ · เจ้าหนี้ · Dashboard",
        gradient:   "from-blue-500 to-violet-500",
        shadowColor:"rgba(99,102,241,0.35)",
        icon: (
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        ),
        actions: [
          {
            label: "ดูบัญชี AR · AP",
            href:  `/ERP/accounting-demo?spreadsheetId=${m.spreadsheetId}`,
            primary: true,
          },
        ],
      });
      continue;
    }

    // ── Expense ──────────────────────────────────────────────────────
    if (name.includes("EXPENSE") || config.includes("EXPENSE")) {
      cards.push({
        key:        m.moduleId,
        group:      "การเงิน",
        label:      m.moduleName || "ค่าใช้จ่าย",
        sublabel:   notes || "บันทึกค่าใช้จ่ายสาขา",
        gradient:   "from-orange-500 to-amber-400",
        shadowColor:"rgba(249,115,22,0.35)",
        icon: (
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        ),
        actions: [
          {
            label: "บันทึกค่าใช้จ่าย",
            href:  `/ERP/expense?spreadsheetId=${m.spreadsheetId}&configName=${encodeURIComponent(m.configName)}&sheetName=${encodeURIComponent(m.sheetName)}&title=${encodeURIComponent(m.moduleName || "ค่าใช้จ่าย")}`,
            primary: true,
          },
        ],
      });
      continue;
    }

    // ── Sales ────────────────────────────────────────────────────────
    if (config.includes("SALES") || name.includes("SALES")) {
      cards.push({
        key:        m.moduleId,
        group:      "การขาย",
        label:      m.moduleName || "บันทึกการขาย",
        sublabel:   notes || "ฟอร์มบันทึกและแก้ไขการขาย",
        gradient:   "from-pink-500 to-rose-400",
        shadowColor:"rgba(236,72,153,0.35)",
        icon: (
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        ),
        actions: [
          {
            label: "บันทึกการขาย",
            href:  `/ERP/form-demo?moduleId=${m.moduleId}&spreadsheetId=${m.spreadsheetId}&configName=${encodeURIComponent(m.configName)}&sheetName=${encodeURIComponent(m.sheetName)}`,
            primary: true,
          },
          {
            label: "แก้ไขการขาย",
            href:  `/ERP/sales-branch/edit?spreadsheetId=${m.spreadsheetId}&configName=${encodeURIComponent(m.configName)}&sheetName=${encodeURIComponent(m.sheetName)}&moduleName=${encodeURIComponent(m.moduleName || "แก้ไขการขาย")}`,
          },
          {
            label: "Sales Dashboard",
            href:  `/ERP/sales-dashboard-demo?spreadsheetId=${m.spreadsheetId}&configName=${encodeURIComponent(m.configName)}&sheetName=${encodeURIComponent(m.sheetName)}&moduleName=${encodeURIComponent(m.moduleName || "Sales")}`,
          },
        ],
      });
      continue;
    }

    // ── CRM ──────────────────────────────────────────────────────────
    if (name.includes("CRM") || config.includes("CRM") || name === "APPOINTMENTS" || name === "CUSTOMERS") {
      cards.push({
        key:        m.moduleId,
        group:      "CRM",
        label:      m.moduleName || "CRM",
        sublabel:   notes || "นัดหมาย · ลูกค้า · ติดตาม",
        gradient:   "from-rose-500 to-pink-400",
        shadowColor:"rgba(244,63,94,0.35)",
        icon: (
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        ),
        actions: [
          {
            label: "เปิด CRM",
            href:  `/ERP/crm?spreadsheetId=${m.spreadsheetId}&aptSheet=${encodeURIComponent(m.sheetName || "appointments")}&title=${encodeURIComponent(m.moduleName || "CRM")}`,
            primary: true,
          },
        ],
      });
      continue;
    }

    // ── Generic fallback ─────────────────────────────────────────────
    cards.push({
      key:        m.moduleId,
      group:      "อื่นๆ",
      label:      m.moduleName,
      sublabel:   notes || undefined,
      gradient:   "from-slate-500 to-slate-400",
      shadowColor:"rgba(100,116,139,0.25)",
      icon: (
        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3zm0 5h16" />
        </svg>
      ),
      actions: [
        {
          label: "จัดการข้อมูล",
          href:  `/ERP/master-data-demo?spreadsheetId=${m.spreadsheetId}&sheetName=${encodeURIComponent(m.sheetName)}&configName=${encodeURIComponent(m.configName)}&moduleName=${encodeURIComponent(m.moduleName)}`,
          primary: true,
        },
        ...(m.configName ? [{
          label: "เพิ่มข้อมูล",
          href:  `/ERP/form-demo?moduleId=${m.moduleId}&spreadsheetId=${m.spreadsheetId}&configName=${encodeURIComponent(m.configName)}&sheetName=${encodeURIComponent(m.sheetName)}`,
        }] : []),
      ],
    });
  }

  return cards;
}

const GROUP_ORDER = ["HR & Payroll", "การขาย", "ระบบสต๊อค", "การเงิน", "อื่นๆ"];

const GROUP_ICONS: Record<string, React.ReactNode> = {
  "HR & Payroll": (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  "การขาย": (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  "ระบบสต๊อค": (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  "การเงิน": (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  "อื่นๆ": (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  ),
};

export default function HomeDemoPage() {
  const { data: session, status } = useSession();
  const router  = useRouter();

  const [activeTab, setActiveTab]         = useState<"modules" | "masterdata">("modules");
  const [cards, setCards]                 = useState<ModuleCard[]>([]);
  const [mods, setMods]                   = useState<Module[]>([]);
  const [databases, setDatabases]         = useState<any[]>([]);
  const [loadingDb, setLoadingDb]         = useState(false);
  const [clientName, setClientName]       = useState("");
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [mounted, setMounted]             = useState(false);
  const [navOpen, setNavOpen]             = useState(false);
  const [isSA, setIsSA]                   = useState(false);
  const [liabilities, setLiabilities]     = useState<{ liability_id: string; po_id: string; supplier_name: string; installment_no: string; due_date: string; amount: string; status: string }[]>([]);


  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!session) return;
    Promise.all([
      fetch("/api/user/modules-demo").then((r) => r.json()),
      fetch("/api/auth/branch-check").then((r) => r.json()),
    ])
      .then(([modulesData, authData]) => {
        if (modulesData.error) throw new Error(modulesData.error);
        setClientName(modulesData.clientName || "");

        const role     = (authData.role     || "STAFF").toUpperCase();
        const branchId = (authData.branchId || "").toString().trim();
        setIsSA(role === "SUPER_ADMIN");
        if (role === "SUPER_ADMIN") {
          fetch("/api/inv/liabilities?status=PENDING")
            .then((r) => r.ok ? r.json() : { liabilities: [] })
            .then((d) => setLiabilities(d.liabilities || []))
            .catch(() => {});
        }

        let mods: Module[] = (modulesData.modules || []).filter((m: Module) => {
          if (m.configName) return true;
          // Allow known module types through even without configName
          const n = (m.moduleName || "").toUpperCase();
          const s = (m.sheetName  || "").toUpperCase();
          return n.startsWith("FINANC") || s.startsWith("FINANC") || n === "INV_BRANCH" || n === "INV_CENTRAL";
        });

        if (role !== "SUPER_ADMIN") {
          mods = mods.filter((m: Module) => {
            const name   = (m.moduleName  || "").toUpperCase();
            const config = (m.configName  || "").toUpperCase();
            // ซ่อน INV_CENTRAL จาก branch users
            if (name === "INV_CENTRAL" || config === "INV_CENTRAL") return false;
            // ซ่อน INV_BRANCH ของสาขาอื่น
            if (name === "INV_BRANCH") {
              return m.configName.toLowerCase() === branchId.toLowerCase();
            }
            return true;
          });
        }

        setMods(mods);
        setCards(buildCards(mods));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [session]);

  const fetchDatabases = async () => {
    setLoadingDb(true);
    try {
      const res = await fetch("/api/master/databases");
      if (res.ok) {
        const d = await res.json();
        setDatabases(d.databases || []);
      }
    } catch { /* non-blocking */ } finally {
      setLoadingDb(false);
    }
  };

  const handleTabChange = (tab: "modules" | "masterdata") => {
    setActiveTab(tab);
    if (tab === "masterdata" && databases.length === 0) fetchDatabases();
  };

  // Group cards
  const groups = GROUP_ORDER.reduce<Record<string, ModuleCard[]>>((acc, g) => {
    const items = cards.filter((c) => c.group === g);
    if (items.length > 0) acc[g] = items;
    return acc;
  }, {});

  // ── Loading ───────────────────────────────────────────────────────
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

  // ── Error ─────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e]">
        <div className="text-center">
          <p className="text-white font-semibold mb-2">โหลดข้อมูลไม่ได้</p>
          <p className="text-slate-400 text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors"
          >
            ลองใหม่
          </button>
        </div>
      </div>
    );
  }

  // ── Main ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0f1e] relative overflow-hidden">

      {/* Ambient bg */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full bg-cyan-600/8 blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Quick Nav Demo */}
      <QuickNavDemo isOpen={navOpen} onClose={() => setNavOpen(false)} />

      {/* Topbar */}
      <header className="relative z-20 flex items-center justify-between px-6 py-4 border-b border-white/5 backdrop-blur-xl bg-white/[0.02]">
        <div className="flex items-center gap-4">
          <QuickNavDemoTrigger onClick={() => setNavOpen(true)} />
          <button
            onClick={() => router.push("/select-system-demo")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-slate-400 hover:text-white text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">กลับ</span>
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl overflow-hidden">
              <Image src="/logo2.png" alt="Fazzfly" width={32} height={32} className="object-contain" />
            </div>
            <div>
              <span className="text-white font-bold text-base tracking-tight">Fazzfly ERP</span>
              {clientName && <span className="text-slate-500 text-xs ml-2">· {clientName}</span>}
            </div>
          </div>
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

      {/* Tab Nav */}
      <div className="relative z-20 border-b border-white/5 bg-white/[0.02] backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 flex gap-1">
          {([["modules", "โมดูล"], ...(isSA ? [["masterdata", "ฐานข้อมูล"]] : [])] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => handleTabChange(key as "modules" | "masterdata")}
              className={`px-5 py-3.5 text-sm font-semibold transition-all border-b-2 ${
                activeTab === key
                  ? "border-blue-500 text-white"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              {label}
              {key === "masterdata" && databases.length > 0 && (
                <span className="ml-2 text-[10px] bg-white/10 text-slate-400 px-1.5 py-0.5 rounded-full">{databases.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="relative z-10 px-6 py-8 max-w-6xl mx-auto">

        {/* ── Tab: Modules ── */}
        {activeTab === "modules" && (
        <div className={`transition-all duration-500 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>

          {/* Page header */}
          <div className="mb-6">
            <h1 className="text-xl font-bold text-white">โมดูลระบบ</h1>
            <p className="text-slate-500 text-sm mt-0.5">{cards.length} โมดูลที่ใช้งานได้ · {clientName || "—"}</p>
          </div>

          {cards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-slate-400 font-medium">ไม่พบโมดูลที่ใช้งานได้</p>
            </div>
          ) : (
            <div className="space-y-6">
              {GROUP_ORDER.filter((g) => groups[g]).map((groupName) => {
                const groupCards = groups[groupName];
                const accentColors: Record<string, string> = {
                  "from-blue-500 to-cyan-400":    "#3b82f6",
                  "from-emerald-500 to-teal-400": "#10b981",
                  "from-violet-500 to-purple-400":"#8b5cf6",
                  "from-pink-500 to-rose-400":    "#ec4899",
                  "from-orange-500 to-amber-400": "#f97316",
                  "from-slate-500 to-slate-400":  "#64748b",
                };
                return (
                  <section key={groupName}>
                    {/* Section header */}
                    <div className="flex items-center gap-2.5 mb-3">
                      <span className="text-slate-500">{GROUP_ICONS[groupName]}</span>
                      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{groupName}</h2>
                      <div className="flex-1 h-px bg-white/5" />
                    </div>

                    {/* Row list */}
                    <div className="space-y-2">
                      {groupCards.flatMap((card) =>
                        card.actions.map((action) => {
                          const accent = accentColors[card.gradient] ?? "#64748b";
                          return (
                            <div
                              key={action.href}
                              onClick={() => router.push(action.href)}
                              className="group flex items-center gap-4 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] hover:border-white/[0.14] rounded-xl px-4 py-3.5 transition-all duration-200 cursor-pointer"
                            >
                              <div className="w-0.5 h-10 rounded-full flex-shrink-0" style={{ background: accent }} />
                              <div
                                className={`w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center bg-gradient-to-br ${card.gradient}`}
                                style={{ boxShadow: `0 4px 12px ${accent}40` }}
                              >
                                <span className="scale-90">{card.icon}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-white font-semibold text-sm leading-tight">{action.label}</p>
                                {card.sublabel && (
                                  <p className="text-slate-500 text-xs mt-0.5 truncate">{card.sublabel}</p>
                                )}
                              </div>
                              <svg className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          );
                        })
                      )}

                      {/* Liabilities widget — การเงิน group, SA only */}
                      {groupName === "การเงิน" && isSA && (() => {
                        const isOverdue = (due: string) => {
                          const p = due.split("/");
                          if (p.length !== 3) return false;
                          return new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0])) < new Date();
                        };
                        const totalAmt  = liabilities.reduce((s, l) => s + Number(l.amount || 0), 0);
                        const overdueList = liabilities.filter((l) => isOverdue(l.due_date));
                        return (
                          <div
                            onClick={() => router.push("/ERP/inv/liabilities")}
                            className="group flex items-center gap-4 bg-violet-500/[0.06] hover:bg-violet-500/[0.10] border border-violet-500/20 hover:border-violet-500/35 rounded-xl px-4 py-3.5 transition-all duration-200 cursor-pointer"
                          >
                            <div className="w-0.5 h-10 rounded-full flex-shrink-0 bg-violet-400" />
                            <div className="w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center bg-gradient-to-br from-violet-500 to-indigo-400"
                              style={{ boxShadow: "0 4px 12px rgba(139,92,246,0.35)" }}>
                              <svg className="w-5 h-5 text-white scale-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-white font-semibold text-sm leading-tight">หนี้สินค้างชำระ</p>
                                {overdueList.length > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-red-500/20 border border-red-500/30 text-red-400 font-medium">
                                    เกินกำหนด {overdueList.length} งวด
                                  </span>
                                )}
                              </div>
                              {liabilities.length === 0 ? (
                                <p className="text-slate-500 text-xs mt-0.5">ไม่มีหนี้สินค้างชำระ</p>
                              ) : (
                                <p className="text-violet-400 text-xs mt-0.5 font-medium">
                                  ฿{totalAmt.toLocaleString()} · {liabilities.length} งวดที่ยังไม่ชำระ
                                </p>
                              )}
                            </div>
                            <svg className="w-4 h-4 text-violet-600 group-hover:text-violet-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        );
                      })()}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
        )} {/* end tab: modules */}

        {/* ── Tab: ฐานข้อมูล ── */}
        {activeTab === "masterdata" && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-white">ฐานข้อมูล</h1>
                <p className="text-slate-500 text-sm mt-0.5">{databases.length} ฐานข้อมูล · เพิ่มและแก้ไขข้อมูลหลัก</p>
              </div>
              <button onClick={fetchDatabases} disabled={loadingDb}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 text-xs transition-all disabled:opacity-50">
                <svg className={`w-3.5 h-3.5 ${loadingDb ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                รีเฟรช
              </button>
            </div>

            {/* Loading */}
            {loadingDb && (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-14 bg-white/[0.03] border border-white/[0.07] rounded-xl animate-pulse" />
                ))}
              </div>
            )}

            {/* Empty */}
            {!loadingDb && databases.length === 0 && (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                  </svg>
                </div>
                <p className="text-slate-400 font-medium">ไม่พบฐานข้อมูล</p>
                <p className="text-slate-600 text-sm mt-1">ตรวจสอบว่ามีข้อมูลใน sheet client_db</p>
              </div>
            )}

            {/* List */}
            {!loadingDb && databases.length > 0 && (
              <div className="space-y-2">
                {databases.map((db) => {
                  const base = `/ERP/master-data-demo?spreadsheetId=${db.spreadsheetId}&sheetName=${encodeURIComponent(db.sheetName)}&configName=${encodeURIComponent(db.configName)}&moduleName=${encodeURIComponent(db.sheetName)}`;
                  return (
                    <div key={db.databaseId}
                      className="group flex items-center gap-4 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] hover:border-white/[0.14] rounded-xl px-4 py-3.5 transition-all duration-200">
                      {/* Accent bar */}
                      <div className="w-0.5 h-10 rounded-full flex-shrink-0 bg-violet-500" />
                      {/* Icon */}
                      <div className="w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center bg-violet-500/20 border border-violet-500/30">
                        <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                        </svg>
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm">{db.sheetName}</p>
                        <p className="text-slate-500 text-xs truncate">{db.databaseId}{db.configName ? ` · ${db.configName}` : ""}</p>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Link href={`${base}&tab=edit`}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-xs font-semibold hover:opacity-85 transition-all"
                          style={{ background: "linear-gradient(135deg, #8b5cf6dd, #7c3aed99)", boxShadow: "0 2px 8px #8b5cf640" }}>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                          แก้ไขข้อมูล
                        </Link>
                        <Link href={`${base}&tab=add`}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-xs font-medium hover:bg-white/10 transition-all whitespace-nowrap">
                          + เพิ่ม
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
