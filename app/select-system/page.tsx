"use client";

/**
 * System Selector Page - Sidebar Layout
 * ✅ Left sidebar สำหรับเลือกระบบ
 * ✅ Overview Dashboard สำหรับ Admin (main area)
 * ✅ White/Light theme
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { useUserRole } from "@/app/context/UserRoleContext";
import OverviewDashboard from "@/app/components/dashboards/overview/OverviewDashboard";

const ROUTES = {
  ERP_HOME: "/ERP/home",
  CRM_HOME: "/CRM/home",
  TASKS: "/tasks",
  SUPPORT: "/support",
};

function getDocumentRoute(doc: any): string {
  const n = (doc.moduleName || "").toLowerCase();
  const c = (doc.configName || "").toLowerCase();
  if (n.includes("payroll") || n.includes("payslip") || n.includes("เงินเดือน") || n.includes("สลิป"))
    return `/ERP/payroll-slip?moduleId=${doc.moduleId}&spreadsheetId=${doc.spreadsheetId}`;
  if (n.includes("receipt") || n.includes("ใบเสร็จ"))
    return `/ERP/receipt-simple?moduleId=${doc.moduleId}&spreadsheetId=${doc.spreadsheetId}`;
  if (n.includes("หัก") || n.includes("withholding") || c.includes("หัก_ณ") || c.includes("withholding"))
    return `/ERP/withholding-tax?moduleId=${doc.moduleId}&spreadsheetId=${doc.spreadsheetId}&configName=${encodeURIComponent(doc.configName)}&sheetName=${encodeURIComponent(doc.sheetName)}`;
  return `/ERP/home?tab=documents`;
}

function getMasterDataRoute(db: any): string {
  return `/ERP/master-data/edit?spreadsheetId=${db.spreadsheetId}&sheetName=${encodeURIComponent(db.sheetName)}&configName=${encodeURIComponent(db.configName)}&title=${encodeURIComponent(db.sheetName)}`;
}

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.ceil(value / 30);
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(start);
    }, 30);
    return () => clearInterval(timer);
  }, [value]);
  return <>{display}{suffix}</>;
}

const SYSTEMS = [
  {
    key: "erp",
    label: "Fazzfly ERP",
    sub: "ระบบบริหารจัดการองค์กร",
    route: "/ERP/home",
    gradient: "from-blue-500 to-cyan-500",
    glow: "shadow-blue-500/30",
    border: "border-blue-200",
    bg: "bg-blue-50",
    textGrad: "from-blue-600 to-cyan-500",
    dot: "bg-blue-500",
    icon: (
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    features: ["📊 Sales & Financial", "📦 Inventory", "💸 Expense", "👥 Payroll"],
    condition: (d: any) => d.hasERP,
  },
  {
    key: "crm",
    label: "Fazzfly CRM",
    sub: "ระบบบริหารลูกค้าสัมพันธ์",
    route: "/CRM/home",
    gradient: "from-purple-500 to-pink-500",
    glow: "shadow-purple-500/30",
    border: "border-purple-200",
    bg: "bg-purple-50",
    textGrad: "from-purple-600 to-pink-500",
    dot: "bg-purple-500",
    icon: (
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    features: ["👥 Contacts", "🎯 Lead Tracking", "💼 Pipeline", "📈 Analytics"],
    condition: (d: any) => d.hasCRM,
  },
  {
    key: "tasks",
    label: "Fazzfly Task Manager",
    sub: "ระบบมอบหมายและติดตามงาน",
    route: "/tasks",
    gradient: "from-violet-500 to-fuchsia-500",
    glow: "shadow-violet-500/30",
    border: "border-violet-200",
    bg: "bg-violet-50",
    textGrad: "from-violet-600 to-fuchsia-500",
    dot: "bg-violet-500",
    icon: (
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    features: ["📋 มอบหมายงาน", "🔔 แจ้งเตือน", "✅ ติดตามสถานะ", "📅 Due Date"],
    condition: () => true,
  },
];

export default function SystemSelectorPage() {
  const { data: session, status } = useSession();
  const { role, isAdmin, loading: roleLoading } = useUserRole();
  const router = useRouter();

  const [userData, setUserData] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [dashboardItems, setDashboardItems] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [masterDbs, setMasterDbs] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [inboxTasks, setInboxTasks] = useState<any[]>([]);
  const [sentTasks, setSentTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!session) return;
    setLoadingTasks(true);
    Promise.all([
      fetch("/api/tasks?mode=inbox").then((r) => r.json()).catch(() => ({})),
      fetch("/api/tasks?mode=sent").then((r) => r.json()).catch(() => ({})),
    ]).then(([inbox, sent]) => {
      setInboxTasks(inbox.tasks || []);
      setSentTasks(sent.tasks || []);
    }).finally(() => setLoadingTasks(false));
  }, [session]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/user/modules")
      .then((r) => r.json())
      .then((data) => {
        const hasERP = (data.modules?.length || 0) > 0;
        const hasCRM = data.hasCRM || false;
        const daysLeft = data.expiresAt
          ? (() => {
              const [m, d, y] = data.expiresAt.split("/").map(Number);
              return Math.ceil((new Date(y, m - 1, d).getTime() - Date.now()) / 86400000);
            })()
          : 0;
        setUserData({
          clientName: data.clientName || "Guest",
          clientId: data.clientId || "N/A",
          package: data.planType || "Basic",
          daysRemaining: Math.max(0, daysLeft),
          hasERP,
          hasCRM,
        });
        setModules(data.modules || []);
        setDashboardItems(data.dashboardItems || []);

        // fetch documents + master databases ต่อ
        const clientId = data.clientId;
        const docsPromise = clientId
          ? fetch(`/api/user/documents?clientId=${clientId}`)
              .then((r) => r.ok ? r.json() : {})
              .then((d) => setDocuments(d.documents || []))
              .catch(() => {})
          : Promise.resolve();
        const masterPromise = fetch("/api/master/databases")
          .then((r) => r.ok ? r.json() : {})
          .then((d) => setMasterDbs(d.databases || []))
          .catch(() => {});

        Promise.all([docsPromise, masterPromise]).then(() => {
          setTimeout(() => setLoaded(true), 100);
        });
      })
      .catch(() => setLoaded(true));
  }, [session]);

  if (status === "loading" || !userData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  const isExpiringSoon = userData.daysRemaining <= 5;
  const availableSystems = SYSTEMS.filter((s) => s.condition(userData));

  // Today in DD/MM/YYYY (Thai timezone)
  const todayStr = new Date().toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok", day: "2-digit", month: "2-digit", year: "numeric",
  }).replace(/\//g, "/");
  const todayNum = new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Bangkok" }); // DD/MM/YYYY

  const todayTasks = inboxTasks.filter((t) => t.status === "pending" && t.dueDate === todayNum);
  const allPendingTasks = inboxTasks.filter((t) => t.status === "pending");
  const displayTasks = todayTasks.length > 0 ? todayTasks : allPendingTasks.slice(0, 5);

  const sentPending = sentTasks.filter((t) => t.status === "pending").length;
  const sentDone = sentTasks.filter((t) => t.status === "done").length;

  return (
    <div
      className="h-screen flex flex-col overflow-hidden bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50"
      style={{ fontFamily: "var(--font-noto-sans-thai), sans-serif" }}
    >
      {/* Animated Background Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />
        <div className="absolute top-1/2 left-1/3 w-96 h-96 bg-sky-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
      </div>

      {/* Top Header */}
      <div className="relative z-20 flex-shrink-0 px-6 py-4 bg-white/80 backdrop-blur-xl border-b border-blue-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo2.png" alt="Fazzfly Logo" width={40} height={40} className="object-contain" />
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent leading-none">
                Fazzfly Platform
              </h1>
              <p className="text-[10px] text-slate-400 tracking-widest uppercase mt-0.5">Enterprise Solutions</p>
            </div>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-2 pl-2 pr-4 py-1.5 rounded-full border border-slate-200 bg-white/80 hover:border-red-200 hover:bg-red-50 transition-all duration-200 group"
          >
            {session?.user?.image ? (
              <img src={session.user.image} alt="Profile" width={28} height={28} className="rounded-full" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white text-xs font-semibold">
                {session?.user?.name?.charAt(0) || "U"}
              </div>
            )}
            <div className="hidden md:block text-left">
              <p className="text-xs font-semibold text-slate-700 group-hover:text-red-700 leading-none">{session?.user?.name}</p>
              <p className="text-[10px] text-slate-400 group-hover:text-red-400 leading-none mt-0.5">ออกจากระบบ</p>
            </div>
            <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body: Sidebar + Main */}
      <div className="relative z-10 flex flex-1 overflow-hidden">

        {/* ── Sidebar ─────────────────────────────────────────── */}
        <aside className={`flex-shrink-0 w-72 bg-white/80 backdrop-blur-xl border-r border-blue-100 flex flex-col transition-all duration-700 ${loaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"}`}>

          {/* System Nav — Accordion */}
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold px-2 mb-3">ระบบที่ใช้งานได้</p>
            {availableSystems.map((sys) => {
              const isOpen = expandedKey === sys.key;

              // build sub-items per system
              const subItems: { label: string; sub?: string; color: string; onClick: () => void; section?: boolean }[] = [];

              if (sys.key === "erp") {
                subItems.push({ label: "หน้าหลัก ERP", color: "bg-blue-500", onClick: () => router.push("/ERP/home") });

                if (modules.length > 0) {
                  subItems.push({ label: "── โมดูล ──", color: "bg-slate-300", onClick: () => {}, section: true });
                  modules.forEach((m: any) => subItems.push({
                    label: m.moduleName, sub: "บันทึกข้อมูล", color: "bg-emerald-500",
                    onClick: () => router.push(`/ERP/form?moduleId=${m.moduleId}&spreadsheetId=${m.spreadsheetId}&configName=${m.configName}&sheetName=${m.sheetName}`),
                  }));
                }

                if (dashboardItems.length > 0) {
                  subItems.push({ label: "── Dashboard ──", color: "bg-slate-300", onClick: () => {}, section: true });
                  dashboardItems.forEach((d: any) => subItems.push({
                    label: d.dashboardName, sub: "Dashboard", color: "bg-violet-500",
                    onClick: () => router.push(`/ERP/home?tab=dashboard&dashboardId=${d.dashboardId}`),
                  }));
                }

                if (documents.length > 0) {
                  subItems.push({ label: "── เอกสาร ──", color: "bg-slate-300", onClick: () => {}, section: true });
                  documents.forEach((doc: any) => subItems.push({
                    label: doc.moduleName, sub: "สร้างเอกสาร", color: "bg-teal-500",
                    onClick: () => router.push(getDocumentRoute(doc)),
                  }));
                }

                if (masterDbs.length > 0) {
                  subItems.push({ label: "── ข้อมูลหลัก ──", color: "bg-slate-300", onClick: () => {}, section: true });
                  masterDbs.forEach((db: any) => subItems.push({
                    label: db.sheetName, sub: "Master Data", color: "bg-amber-500",
                    onClick: () => router.push(getMasterDataRoute(db)),
                  }));
                }

                subItems.push({ label: "── อื่นๆ ──", color: "bg-slate-300", onClick: () => {}, section: true });
                subItems.push({ label: "Activity Log", sub: "ประวัติการทำงาน", color: "bg-rose-500", onClick: () => router.push("/ERP/home?tab=logs") });
              }

              if (sys.key === "crm") {
                subItems.push({ label: "หน้าหลัก CRM", color: "bg-purple-500", onClick: () => router.push("/CRM/home") });
              }

              if (sys.key === "tasks") {
                subItems.push({ label: "งานที่ได้รับ (Inbox)", color: "bg-violet-500", onClick: () => router.push("/tasks?tab=inbox") });
                subItems.push({ label: "งานที่มอบหมาย (Sent)", color: "bg-fuchsia-500", onClick: () => router.push("/tasks?tab=sent") });
              }

              return (
                <div key={sys.key}>
                  {/* System header button */}
                  <button
                    onClick={() => setExpandedKey(isOpen ? null : sys.key)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left transition-all duration-200 group
                      ${isOpen ? "bg-slate-100" : "hover:bg-slate-50"}`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${sys.gradient} shadow-md ${sys.glow}`}>
                      {sys.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate text-slate-800">{sys.label}</p>
                      <p className="text-[11px] truncate text-slate-400">{sys.sub}</p>
                    </div>
                    <svg
                      className={`w-4 h-4 flex-shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {/* Sub-items */}
                  {isOpen && (
                    <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-slate-100 pl-3">
                      {subItems.map((item, i) =>
                        item.section ? (
                          <p key={i} className="text-[9px] text-slate-400 uppercase tracking-widest font-bold px-2 pt-2 pb-0.5">
                            {item.label.replace(/──\s?|\s?──/g, "").trim()}
                          </p>
                        ) : (
                          <button
                            key={i}
                            onClick={item.onClick}
                            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-left hover:bg-slate-50 transition-colors group"
                          >
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.color}`} />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-slate-700 truncate group-hover:text-slate-900">{item.label}</p>
                              {item.sub && <p className="text-[10px] text-slate-400">{item.sub}</p>}
                            </div>
                            <svg className="w-3 h-3 text-slate-300 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-slate-100">
            <p className="text-[10px] text-slate-400 text-center">
              <Link href={ROUTES.SUPPORT} className="hover:text-blue-600 transition-colors">ติดต่อฝ่ายสนับสนุน</Link>
              {" · "}© 2025 Fazzfly
            </p>
          </div>
        </aside>

        {/* ── Main Content ────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto px-8 py-8">
          <div className={`transition-all duration-700 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>

            {/* User Info — center */}
            <div className="mb-10 text-center">
              {/* Role badge */}
              {!roleLoading && role && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-4
                  bg-gradient-to-r from-blue-100 to-cyan-100 border border-blue-200">
                  <span className={`w-2 h-2 rounded-full animate-pulse ${
                    role === "SUPER_ADMIN" ? "bg-rose-500" :
                    role === "ADMIN" ? "bg-blue-500" : "bg-green-500"
                  }`} />
                  <span className={`text-xs font-bold tracking-wide ${
                    role === "SUPER_ADMIN" ? "text-rose-600" :
                    role === "ADMIN" ? "text-blue-600" : "text-green-600"
                  }`}>
                    {role === "SUPER_ADMIN" ? "Super Admin" :
                     role === "ADMIN" ? "Admin" : "Staff"}
                  </span>
                </div>
              )}

              <h2 className="text-5xl font-bold text-slate-800 mb-2 leading-tight">
                ยินดีต้อนรับ,{" "}
                <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                  {userData.clientName}
                </span>
              </h2>
              <p className="text-slate-400 mb-8">เลือกระบบจากแถบซ้ายเพื่อเริ่มใช้งาน</p>

              <div className="inline-flex items-stretch gap-4 flex-wrap justify-center">
                <div className="bg-white/90 backdrop-blur-xl rounded-2xl px-8 py-5 border border-blue-100 shadow-lg text-center min-w-[120px]">
                  <p className="text-xs text-slate-400 font-medium mb-1.5">แพ็คเกจ</p>
                  <p className="text-xl font-bold text-slate-800">{userData.package}</p>
                </div>
                <div className={`bg-white/90 backdrop-blur-xl rounded-2xl px-8 py-5 border shadow-lg text-center min-w-[120px] ${isExpiringSoon ? "border-amber-200" : "border-green-200"}`}>
                  <p className="text-xs text-slate-400 font-medium mb-1.5">คงเหลือ</p>
                  <p className={`text-xl font-bold ${isExpiringSoon ? "text-amber-600" : "text-green-600"}`}>
                    <AnimatedNumber value={userData.daysRemaining} /> วัน
                  </p>
                </div>
                <div className="bg-white/90 backdrop-blur-xl rounded-2xl px-8 py-5 border border-blue-100 shadow-lg text-center min-w-[120px]">
                  <p className="text-xs text-slate-400 font-medium mb-1.5">Client ID</p>
                  <p className="text-xl font-bold text-blue-600">{userData.clientId}</p>
                </div>
              </div>
            </div>

            {!roleLoading && (
              <>
                {/* ── Admin: Overview Dashboard + Task Summary ── */}
                {isAdmin() && (
                  <div className="space-y-6">
                    {/* Task Summary */}
                    <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-violet-100 shadow-lg p-6">
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-md">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                          </div>
                          <span className="font-bold text-slate-800">สรุปงานที่มอบหมาย</span>
                        </div>
                        <button onClick={() => router.push("/tasks")} className="text-xs text-violet-600 hover:text-violet-800 font-medium">
                          ดูทั้งหมด →
                        </button>
                      </div>
                      {loadingTasks ? (
                        <div className="flex justify-center py-4">
                          <div className="w-5 h-5 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-slate-50 rounded-2xl p-4 text-center">
                            <p className="text-2xl font-bold text-slate-800">{sentTasks.length}</p>
                            <p className="text-xs text-slate-400 mt-1">ทั้งหมด</p>
                          </div>
                          <div className="bg-amber-50 rounded-2xl p-4 text-center border border-amber-100">
                            <p className="text-2xl font-bold text-amber-600">{sentPending}</p>
                            <p className="text-xs text-amber-500 mt-1">ยังไม่เสร็จ</p>
                          </div>
                          <div className="bg-green-50 rounded-2xl p-4 text-center border border-green-100">
                            <p className="text-2xl font-bold text-green-600">{sentDone}</p>
                            <p className="text-xs text-green-500 mt-1">เสร็จแล้ว</p>
                          </div>
                        </div>
                      )}
                      {/* Recent pending tasks */}
                      {!loadingTasks && sentPending > 0 && (
                        <div className="mt-4 space-y-2">
                          <p className="text-xs text-slate-400 font-medium">งานที่ยังค้างอยู่</p>
                          {sentTasks.filter((t) => t.status === "pending").slice(0, 3).map((t) => (
                            <div key={t.taskId} className="flex items-center gap-3 px-3 py-2 bg-amber-50/50 rounded-xl border border-amber-100">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                              <p className="text-sm text-slate-700 truncate flex-1">{t.title}</p>
                              <p className="text-[11px] text-slate-400 flex-shrink-0">{t.assigneeEmail.split("@")[0]}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Overview Dashboard */}
                    {dashboardItems.length > 0 && (
                      <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-blue-100 shadow-lg shadow-blue-100/30 p-6">
                        <OverviewDashboard dashboardItems={dashboardItems} />
                      </div>
                    )}
                  </div>
                )}

                {/* ── Staff: Today's Tasks ── */}
                {!isAdmin() && (
                  <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-violet-100 shadow-lg p-6">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-md">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                          </svg>
                        </div>
                        <div>
                          <span className="font-bold text-slate-800">งานของฉันวันนี้</span>
                          {todayTasks.length === 0 && allPendingTasks.length > 0 && (
                            <span className="ml-2 text-xs text-slate-400">(แสดงงานที่รอดำเนินการ)</span>
                          )}
                        </div>
                      </div>
                      <button onClick={() => router.push("/tasks")} className="text-xs text-violet-600 hover:text-violet-800 font-medium">
                        ดูทั้งหมด →
                      </button>
                    </div>

                    {loadingTasks ? (
                      <div className="flex justify-center py-8">
                        <div className="w-5 h-5 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
                      </div>
                    ) : displayTasks.length === 0 ? (
                      <div className="py-10 text-center">
                        <p className="text-3xl mb-2">✅</p>
                        <p className="text-slate-400 text-sm">ไม่มีงานที่ค้างอยู่ สบายใจได้เลย!</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {displayTasks.map((t) => {
                          const isToday = t.dueDate === todayNum;
                          const isDue = t.dueDate && t.dueDate < todayNum;
                          return (
                            <div key={t.taskId} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors
                              ${isDue ? "bg-red-50 border-red-100" : isToday ? "bg-amber-50 border-amber-100" : "bg-slate-50 border-slate-100"}`}>
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isDue ? "bg-red-400" : isToday ? "bg-amber-400" : "bg-violet-400"}`} />
                              <p className="text-sm text-slate-700 flex-1 truncate">{t.title}</p>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {t.dueDate && (
                                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full
                                    ${isDue ? "bg-red-100 text-red-600" : isToday ? "bg-amber-100 text-amber-700" : "text-slate-400"}`}>
                                    {isDue ? "🔴 เกินกำหนด" : isToday ? "⚠️ วันนี้" : t.dueDate}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {allPendingTasks.length > 5 && (
                          <p className="text-center text-xs text-slate-400 pt-1">และอีก {allPendingTasks.length - 5} งาน</p>
                        )}
                      </div>
                    )}

                    {/* Stats */}
                    {!loadingTasks && (
                      <div className="grid grid-cols-2 gap-3 mt-5 pt-5 border-t border-slate-100">
                        <div className="bg-amber-50 rounded-2xl p-3 text-center border border-amber-100">
                          <p className="text-xl font-bold text-amber-600">{allPendingTasks.length}</p>
                          <p className="text-xs text-amber-500 mt-0.5">ยังไม่เสร็จ</p>
                        </div>
                        <div className="bg-green-50 rounded-2xl p-3 text-center border border-green-100">
                          <p className="text-xl font-bold text-green-600">{inboxTasks.filter((t) => t.status === "done").length}</p>
                          <p className="text-xs text-green-500 mt-0.5">เสร็จแล้ว</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
      `}} />
    </div>
  );
}
