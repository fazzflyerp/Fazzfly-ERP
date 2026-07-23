"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUserRole } from "@/app/context/UserRoleContext";
import SalesDashboard from "@/app/components/dashboards/sales/SalesDashboard";
import UsageDashboard from "@/app/components/dashboards/usage/UsageDashboard";
import PurchaseDashboard from "@/app/components/dashboards/purchase/PurchaseDashboard";
import ExpenseDashboard from "@/app/components/dashboards/expense/ExpenseDashboard";
import InventoryDashboard from "@/app/components/dashboards/inventory/InventoryDashboard";
import PayrollDashboard from "@/app/components/dashboards/payroll/PayrollDashboard";
import FinancialDashboard from "@/app/components/dashboards/financial/FinancialDashboard";
import QuickNav, { QuickNavTrigger } from "@/app/components/QuickNav";
import TaskBell from "@/app/components/TaskBell";

interface Module {
  moduleId: string;
  moduleName: string;
  spreadsheetId: string;
  sheetName: string;
  configName: string;
  notes?: string;
}

interface DashboardItem {
  dashboardId: string;
  dashboardName: string;
  spreadsheetId: string;
  sheetName: string;
  dashboardConfigName: string;
}

interface UserData {
  clientId: string;
  clientName: string;
  planType: string;
  expiresAt: string;
  modules: Module[];
  dashboardItems: DashboardItem[];
}

const MASTER_CONFIG_ID = process.env.NEXT_PUBLIC_MASTER_CONFIG_ID || "";

function isRentalModule(m: Module) {
  const n = m.moduleName;
  return n.includes("สต๊อค") || n.toLowerCase().includes("rental") || n.toLowerCase().includes("stock");
}

export default function HomeType2Page() {
  const { data: session, status } = useSession();
  const { canEdit, isAdmin } = useUserRole();
  const router = useRouter();

  const [userData, setUserData]         = useState<UserData | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [activeTab, setActiveTab]       = useState<"modules" | "dashboard" | "documents">("modules");
  const [navOpen, setNavOpen]           = useState(false);
  const [selectedDashboard, setSelectedDashboard] = useState<DashboardItem | null>(null);
  const [userDocuments, setUserDocuments] = useState<Module[]>([]);
  const [loadingDocs, setLoadingDocs]   = useState(false);
  const [loadingModuleConfigs, setLoadingModuleConfigs] = useState(false);
  const [moduleConfigs, setModuleConfigs] = useState<Record<string, any>>({});
  const [archiveFolderId, setArchiveFolderId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status === "authenticated") {
      if ((session as any)?.error === "RefreshAccessTokenError") { signOut({ callbackUrl: "/login" }); return; }
      if (!(session as any)?.accessToken) { setTimeout(fetchUserModules, 500); return; }
      fetchUserModules();
    }
  }, [status, session]);

  const fetchUserModules = async () => {
    try {
      setLoading(true);
      const token = (session as any)?.accessToken;
      if (!token) throw new Error("ไม่มี access token");
      const res = await fetch("/api/user/modules", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) { await signOut({ callbackUrl: "/login" }); return; }
        throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      }
      const data: UserData = await res.json();
      setUserData(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userData) return;
    fetchDocuments();
  }, [userData]);

  const fetchDocuments = async () => {
    if (!userData?.clientId) return;
    setLoadingDocs(true);
    try {
      const token = (session as any)?.accessToken;
      const res = await fetch(`/api/user/documents?clientId=${userData.clientId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setUserDocuments([]); return; }
      const data = await res.json();
      setUserDocuments((data.documents || []).map((d: any) => ({
        moduleId: d.moduleId, moduleName: d.moduleName, spreadsheetId: d.spreadsheetId,
        sheetName: d.sheetName, configName: d.configName || "", notes: d.notes,
      })));
    } catch { setUserDocuments([]); }
    finally { setLoadingDocs(false); }
  };

  const fetchModuleConfig = async (name: string) => {
    try {
      if (!MASTER_CONFIG_ID) return null;
      const token = (session as any)?.accessToken;
      const res = await fetch(`/api/dashboard/module-config?masterConfigId=${MASTER_CONFIG_ID}&moduleName=${name}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return (await res.json()).config ?? null;
    } catch { return null; }
  };

  useEffect(() => {
    if (!selectedDashboard || !userData) return;
    const n = selectedDashboard.dashboardName.toLowerCase();
    const name = n.includes("sales") ? "Sales" : n.includes("purchase") ? "Purchase"
      : n.includes("payroll") ? "Payroll" : n.includes("expense") ? "Expense"
      : n.includes("inventory") ? "Inventory" : n.includes("financial") ? "Financial"
      : n.includes("usage") ? "Usage" : "";
    if (!name) return;
    setLoadingModuleConfigs(true);
    setArchiveFolderId(null);
    fetchModuleConfig(name).then(cfg => {
      if (cfg) setModuleConfigs(p => ({ ...p, [name]: cfg }));
      if (cfg?.archiveFolderId) setArchiveFolderId(cfg.archiveFolderId);
      setLoadingModuleConfigs(false);
    });
  }, [selectedDashboard, userData]);

  const validModules   = (userData?.modules || []).filter(m => m.configName && !isRentalModule(m));
  const rentalModules  = (userData?.modules || []).filter(m => m.configName && isRentalModule(m));
  const validDashboards = (userData?.dashboardItems || []).filter(d => d.dashboardConfigName);

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center bg-white rounded-3xl p-8 shadow-lg max-w-md">
        <p className="text-red-600 font-semibold text-lg mb-4">{error}</p>
        <button onClick={fetchUserModules} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium">ลองใหม่</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50 pb-20 lg:pb-0"
      style={{ fontFamily: "var(--font-noto-sans-thai), sans-serif" }}>
      <QuickNav isOpen={navOpen} onClose={() => setNavOpen(false)} />

      {/* Animated BG */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan-200 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-2000" />
      </div>

      {/* Navbar */}
      <nav className="relative z-20 bg-white/80 backdrop-blur-xl border-b border-blue-100 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-3 lg:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 lg:gap-4">
            <QuickNavTrigger onClick={() => setNavOpen(true)} />
            <Link href="/select-system"
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl transition-all group shadow-sm">
              <svg className="w-5 h-5 text-slate-600 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm font-semibold text-slate-700 group-hover:text-blue-600 hidden sm:inline">ย้อนกลับ</span>
            </Link>
            <div className="w-8 lg:w-10 h-8 lg:h-10 flex-shrink-0">
              <Image src="/logo2.png" alt="Logo" width={40} height={40} className="object-contain" />
            </div>
            <div className="hidden md:block">
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 bg-clip-text text-transparent">Fazzfly ERP</span>
              <p className="text-xs text-slate-500">ระบบบริหารจัดการ</p>
            </div>
          </div>
          <div className="flex items-center gap-2 lg:gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-slate-600">สวัสดี</p>
              <p className="font-semibold text-slate-800 text-sm">{(session as any)?.user?.name}</p>
            </div>
            <TaskBell />
            <button onClick={() => signOut({ callbackUrl: "/" })}
              className="px-3 lg:px-4 py-2 text-xs lg:text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 border border-red-200 font-medium">
              <span className="hidden sm:inline">ออกจากระบบ</span>
              <span className="sm:hidden">ออก</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 lg:px-6 py-6 lg:py-12">
        <div className="mb-6 lg:mb-10">
          <h1 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-slate-800 mb-2">
            ยินดีต้อนรับกลับ,{" "}
            {userData
              ? <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">{userData.clientName}</span>
              : <span className="inline-block w-36 h-9 bg-slate-200 animate-pulse rounded-xl align-middle" />}
          </h1>
          <p className="text-base lg:text-lg text-slate-600">จัดการข้อมูล ติดตามสถิติ และใช้งานโมดูลต่างๆ</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 lg:mb-8 overflow-x-auto scrollbar-hide bg-white/50 backdrop-blur-md rounded-xl lg:rounded-2xl p-2 border border-blue-100/50">
          {(["modules", "dashboard", "documents"] as const).map(tab => {
            const labels: Record<string, string> = { modules: "โมดูล", dashboard: "Dashboard", documents: "เอกสาร" };
            const colors: Record<string, string> = { modules: "blue", dashboard: "purple", documents: "emerald" };
            const c = colors[tab];
            return (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 lg:px-6 py-2.5 font-semibold transition-all relative whitespace-nowrap text-sm lg:text-base ${activeTab === tab ? `text-${c}-600` : "text-slate-600 hover:text-slate-800"}`}>
                {labels[tab]}
                {activeTab === tab && <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-${c}-600 to-${c}-400 rounded-full`} />}
              </button>
            );
          })}
        </div>

        {/* ── Modules tab ── */}
        {activeTab === "modules" && (
          <div className="animate-fadeIn space-y-10">

            {/* Rental Stock */}
            {(loading || rentalModules.length > 0) && (
              <div>
                <h2 className="text-xl lg:text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <span className="text-2xl">👗</span> สต๊อคชุด / Rental Stock
                </h2>
                {loading
                  ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(2)].map((_, i) => (
                      <div key={i} className="bg-white/90 rounded-2xl shadow-lg p-6 animate-pulse border border-purple-100">
                        <div className="w-12 h-12 bg-slate-200 rounded-2xl mb-4" />
                        <div className="h-5 bg-slate-200 rounded mb-2 w-3/4" />
                        <div className="h-9 bg-slate-200 rounded-lg mt-6" />
                      </div>
                    ))}
                  </div>
                  : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {rentalModules.map(m => (
                      <div key={m.moduleId}
                        className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg p-6 border border-purple-100/50 hover:shadow-2xl hover:shadow-purple-200 hover:-translate-y-2 transition-all duration-300 group">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 text-white w-fit mb-4 group-hover:scale-110 transition-transform">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-1">{m.moduleName}</h3>
                        {m.notes && <p className="text-sm text-slate-500 mb-4 line-clamp-2">{m.notes}</p>}
                        <div className="pt-4 border-t border-slate-100 mb-4 text-xs text-slate-500">
                          Sheet: <span className="font-semibold text-slate-700">{m.sheetName}</span>
                        </div>
                        <div className="flex gap-2">
                          <Link href={`/ERP/rental-stock?spreadsheetId=${m.spreadsheetId}&sheetName=${encodeURIComponent(m.sheetName)}&configName=${encodeURIComponent(m.configName)}&moduleId=${m.moduleId}`}
                            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                            </svg>
                            ดูสต๊อค
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                }
              </div>
            )}

            {/* Regular Modules */}
            <div>
              <h2 className="text-xl lg:text-2xl font-bold text-slate-800 mb-4">
                โมดูล <span className="text-blue-600">({validModules.length})</span>
              </h2>
              {loading
                ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-white/90 rounded-2xl shadow-lg p-6 animate-pulse border border-blue-100">
                      <div className="w-12 h-12 bg-slate-200 rounded-2xl mb-4" />
                      <div className="h-5 bg-slate-200 rounded mb-2 w-3/4" />
                      <div className="h-9 bg-slate-200 rounded-lg mt-6" />
                    </div>
                  ))}
                </div>
                : validModules.length > 0
                  ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                    {validModules.map(m => (
                      <div key={m.moduleId}
                        className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg p-6 border border-blue-100/50 hover:shadow-2xl hover:shadow-blue-200 hover:-translate-y-2 transition-all duration-300 group">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 via-sky-500 to-cyan-500 text-white w-fit mb-4 group-hover:scale-110 transition-transform">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-1">{m.moduleName}</h3>
                        {m.notes && <p className="text-sm text-slate-500 mb-4 line-clamp-2">{m.notes}</p>}
                        <div className="pt-4 border-t border-slate-100 mb-4">
                          <p className="text-xs text-slate-500">Sheet: <span className="font-semibold text-slate-700">{m.sheetName}</span></p>
                          <p className="text-xs text-slate-500">Config: <span className="font-semibold text-slate-700">{m.configName}</span></p>
                        </div>
                        <div className="flex gap-2">
                          <Link href={`/ERP/form?moduleId=${m.moduleId}&spreadsheetId=${m.spreadsheetId}&configName=${m.configName}&sheetName=${m.sheetName}`}
                            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-lg font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            เพิ่มข้อมูล
                          </Link>
                          {canEdit() && (
                            <Link href={`/ERP/transaction/edit?moduleId=${m.moduleId}&spreadsheetId=${m.spreadsheetId}&sheetName=${m.sheetName}&configName=${m.configName}&moduleName=${encodeURIComponent(m.moduleName)}`}
                              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              แก้ไข/ลบ
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  : !loading && (
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-10 text-center">
                      <p className="text-blue-700 font-semibold">ยังไม่มีโมดูลที่ใช้งาน</p>
                    </div>
                  )
              }
            </div>
          </div>
        )}

        {/* ── Dashboard tab ── */}
        {activeTab === "dashboard" && (
          <div className="animate-fadeIn">
            <h2 className="text-2xl lg:text-3xl font-bold text-slate-800 mb-6">
              Dashboard <span className="text-purple-600">({validDashboards.length})</span>
            </h2>
            {validDashboards.length > 0 ? (
              <>
                <div className="bg-white/90 rounded-xl shadow-lg p-3 border border-purple-100/50 mb-6 overflow-x-auto">
                  <div className="flex gap-2 min-w-min">
                    {validDashboards.map(d => (
                      <button key={d.dashboardId} onClick={() => setSelectedDashboard(d)}
                        className={`px-5 py-2 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${selectedDashboard?.dashboardId === d.dashboardId
                          ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                        {d.dashboardName}
                      </button>
                    ))}
                  </div>
                </div>
                {selectedDashboard && (
                  <div className="bg-slate-50/90 rounded-3xl shadow-lg p-6 lg:p-8 border border-slate-200">
                    {loadingModuleConfigs && (
                      <div className="flex items-center gap-3 text-slate-600 mb-4">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-600" />
                        กำลังโหลด Config...
                      </div>
                    )}
                    {(() => {
                      const n = selectedDashboard.dashboardName.toLowerCase();
                      const props = { spreadsheetId: selectedDashboard.spreadsheetId, configSheetName: selectedDashboard.dashboardConfigName, dataSheetName: selectedDashboard.sheetName, accessToken: (session as any)?.accessToken, archiveFolderId: archiveFolderId || undefined };
                      if (n.includes("sales"))     return <SalesDashboard     {...props} moduleName="Sales" />;
                      if (n.includes("purchase"))  return <PurchaseDashboard  {...props} moduleName="Purchase" />;
                      if (n.includes("payroll"))   return <PayrollDashboard   {...props} moduleName="Payroll" />;
                      if (n.includes("expense"))   return <ExpenseDashboard   {...props} moduleName="Expense" />;
                      if (n.includes("inventory")) return <InventoryDashboard {...props} moduleName="Inventory" />;
                      if (n.includes("financial")) return <FinancialDashboard {...props} moduleName="Financial" />;
                      if (n.includes("usage"))     return <UsageDashboard     {...props} moduleName="Usage" />;
                      return <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center text-yellow-700 font-semibold">Dashboard นี้ยังไม่พร้อม</div>;
                    })()}
                  </div>
                )}
                {!selectedDashboard && (
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-10 text-center">
                    <p className="text-blue-700 font-semibold">เลือก Dashboard จากด้านบน</p>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-purple-50 border border-purple-200 rounded-3xl p-12 text-center">
                <p className="text-purple-700 font-semibold text-lg">ยังไม่มี Dashboard</p>
              </div>
            )}
          </div>
        )}

        {/* ── Documents tab ── */}
        {activeTab === "documents" && (
          <div className="animate-fadeIn">
            <h2 className="text-2xl lg:text-3xl font-bold text-slate-800 mb-6">
              เอกสาร <span className="text-emerald-600">({userDocuments.length})</span>
            </h2>
            {loadingDocs ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="bg-white/90 rounded-2xl shadow-lg p-6 animate-pulse border border-emerald-100">
                    <div className="w-12 h-12 bg-slate-200 rounded-2xl mb-4" />
                    <div className="h-5 bg-slate-200 rounded mb-2 w-3/4" />
                  </div>
                ))}
              </div>
            ) : userDocuments.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {userDocuments.map(doc => {
                  const n = doc.moduleName.toLowerCase();
                  const c = (doc.configName || "").toLowerCase();
                  let href = "";
                  if (n.includes("payroll") || n.includes("สลิป") || n.includes("payslip"))
                    href = `/ERP/payroll-slip?moduleId=${doc.moduleId}&spreadsheetId=${doc.spreadsheetId}`;
                  else if (n.includes("receipt") || n.includes("ใบเสร็จ"))
                    href = `/ERP/receipt-simple?moduleId=${doc.moduleId}&spreadsheetId=${doc.spreadsheetId}`;
                  else if (n.includes("หัก") || n.includes("withholding") || c.includes("withholding"))
                    href = `/ERP/withholding-tax?moduleId=${doc.moduleId}&spreadsheetId=${doc.spreadsheetId}&configName=${encodeURIComponent(doc.configName)}&sheetName=${encodeURIComponent(doc.sheetName)}`;
                  return (
                    <Link key={doc.moduleId} href={href || "#"}
                      className="bg-white/90 rounded-2xl shadow-lg p-6 border border-emerald-100/50 hover:border-emerald-300 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 group block">
                      <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white w-fit mb-4 group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-bold text-slate-800 group-hover:text-emerald-600 mb-1 transition-colors">{doc.moduleName}</h3>
                      {doc.notes && <p className="text-sm text-slate-500 line-clamp-2">{doc.notes}</p>}
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-12 text-center">
                <p className="text-emerald-700 font-semibold text-lg">ยังไม่มีเอกสาร</p>
                <p className="text-emerald-600 text-sm mt-2">ติดต่อผู้ดูแลระบบเพื่อเพิ่มโมดูลเอกสาร</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
