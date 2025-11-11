"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
// ✅ Import new dashboard components
import SalesDashboard from "@/app/components/dashboards/sales/SalesDashboard";
import PayrollDashboard from "@/app/components/dashboards/PayrollDashboard";

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
  notes?: string;
}

interface UserData {
  clientId: string;
  clientName: string;
  planType: string;
  expiresAt: string;
  expiryWarning?: string;
  modules: Module[];
  dashboardItems: DashboardItem[];
}

// ✅ Interface for module config from API
interface ModuleConfig {
  moduleName: string;
  spreadsheetId: string;
  sheetName: string;
  configName: string;
  archiveFolderId: string;
  enabled: boolean;
}

// ✅ Master Config Spreadsheet ID (from environment)
// TODO: ตรวจสอบว่า .env.local ตั้งค่าถูกต้อง
const MASTER_CONFIG_ID = process.env.NEXT_PUBLIC_MASTER_CONFIG_ID || "1j7LguHaX8pIvvQ1PqqenuguOsPT1QthJqXJyMYW2xo8";

if (typeof window !== 'undefined') {
  console.log("🔍 [Debug] MASTER_CONFIG_ID:", MASTER_CONFIG_ID ? `${MASTER_CONFIG_ID.substring(0, 20)}...` : "❌ NOT SET");
  console.log("🔍 [Debug] From env?", !!process.env.NEXT_PUBLIC_MASTER_CONFIG_ID);
  console.log("🔍 [Debug] All NEXT_PUBLIC vars:", Object.keys(process.env).filter(k => k.startsWith('NEXT_PUBLIC')));
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"modules" | "dashboard">("modules");
  const [selectedDashboard, setSelectedDashboard] = useState<DashboardItem | null>(null);
  
  // ✅ State for dynamic module configs
  const [moduleConfigs, setModuleConfigs] = useState<Record<string, ModuleConfig>>({});
  const [loadingModuleConfigs, setLoadingModuleConfigs] = useState(false);

  useEffect(() => {
    console.log("📋 useSession status:", status);
    console.log("🔑 Session data:", {
      email: (session as any)?.user?.email,
      hasAccessToken: !!(session as any)?.accessToken,
    });

    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      if ((session as any)?.error === "RefreshAccessTokenError") {
        console.error("❌ Session error: Token refresh failed");
        signOut({ callbackUrl: "/login" });
        return;
      }
      
      if (!(session as any)?.accessToken) {
        console.warn("⚠️ No accessToken in session, waiting for update...");
        const timer = setTimeout(() => {
          fetchUserModules();
        }, 1000);
        return () => clearTimeout(timer);
      }

      fetchUserModules();
    }
  }, [status, session, router]);

  const fetchUserModules = async () => {
    try {
      setLoading(true);
      setError(null);

      const accessToken = (session as any)?.accessToken;

      console.log("🔍 fetchUserModules - accessToken:", accessToken ? "✅ yes" : "❌ no");

      if (!accessToken) {
        throw new Error("ไม่มี access token ใน session");
      }

      console.log("📡 Fetching user modules with token...");

      const response = await fetch("/api/user/modules", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.error(`❌ API Error: ${response.status} ${response.statusText}`);

        if (response.status === 401) {
          console.log("🔐 Unauthorized - signing out");
          await signOut({ callbackUrl: "/login" });
          return;
        }

        if (response.status === 403) {
          console.log("⏰ Forbidden - token may be expired");
          await signOut({ callbackUrl: "/login" });
          return;
        }

        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: UserData = await response.json();
      console.log("✅ Modules loaded:", data);
      setUserData(data);
    } catch (err: any) {
      console.error("❌ Error fetching modules:", err);
      setError(err.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  /**
   * ✅ Fetch module config dynamically from Master Config
   */
  const fetchModuleConfig = async (moduleName: string): Promise<ModuleConfig | null> => {
    try {
      console.log("━".repeat(60));
      console.log(`📦 [fetchModuleConfig] Fetching config for: ${moduleName}`);
      console.log("━".repeat(60));

      if (!MASTER_CONFIG_ID) {
        console.error("❌ MASTER_CONFIG_ID not set in environment");
        return null;
      }

      const accessToken = (session as any)?.accessToken;
      if (!accessToken) {
        console.error("❌ No access token");
        return null;
      }

      const params = new URLSearchParams({
        masterConfigId: MASTER_CONFIG_ID,
        moduleName: moduleName,
      });

      const url = `/api/dashboard/module-config?${params}`;
      console.log("🌐 API URL:", url);

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      console.log("📡 Response status:", res.status);

      if (!res.ok) {
        const errorText = await res.text();
        console.error("❌ API Error:", errorText);
        return null;
      }

      const data = await res.json();

      console.log("✅ [fetchModuleConfig] Success:");
      console.log("   Config:", data.config);
      console.log("━".repeat(60));

      return data.config as ModuleConfig;
    } catch (err: any) {
      console.error("━".repeat(60));
      console.error(`❌ [fetchModuleConfig] Error for ${moduleName}:`, err.message);
      console.error("━".repeat(60));
      return null;
    }
  };

  /**
   * ✅ Load module config when dashboard is selected
   */
  useEffect(() => {
    if (selectedDashboard) {
      const dashboardName = selectedDashboard.dashboardName.toLowerCase();
      
      // Determine module name from dashboard name
      let moduleName = "";
      if (dashboardName.includes("sales")) moduleName = "Sales";
      else if (dashboardName.includes("purchase")) moduleName = "Purchase";
      else if (dashboardName.includes("payroll")) moduleName = "Payroll";
      else if (dashboardName.includes("expense")) moduleName = "Expense";
      
      if (moduleName && !moduleConfigs[moduleName]) {
        console.log(`🔄 Loading config for module: ${moduleName}`);
        setLoadingModuleConfigs(true);
        
        fetchModuleConfig(moduleName).then((config) => {
          if (config) {
            setModuleConfigs(prev => ({
              ...prev,
              [moduleName]: config,
            }));
          }
          setLoadingModuleConfigs(false);
        });
      }
    }
  }, [selectedDashboard]);

  const getDaysUntilExpiry = (expiresAt: string): number => {
    try {
      const [month, day, year] = expiresAt.split("/").map(Number);
      const expireDate = new Date(year, month - 1, day);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return Math.ceil((expireDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    } catch {
      return -1;
    }
  };

  const validModules = userData?.modules.filter(m => m.configName) || [];
  const validDashboards = userData?.dashboardItems.filter(d => d.dashboardConfigName) || [];

  if (status === "loading" || loading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50"
        style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

if (error && !userData) {
  // ✅ Redirect after 3s
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/login");
    }, 3000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div 
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50"
      style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
    >
      <div className="text-center bg-white rounded-3xl p-8 shadow-lg max-w-md">
        <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-red-600 font-semibold text-lg mb-2">{error}</p>
        <p className="text-slate-600 text-sm mb-6">กำลังพาไปยังหน้า login ใน 3 วินาที...</p>
        <button
          onClick={() => {
            setError(null);
            fetchUserModules();
          }}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          ลองใหม่อีกครั้ง
        </button>
      </div>
    </div>
  );
}


  const daysLeft = userData ? getDaysUntilExpiry(userData.expiresAt) : -1;
  const isExpiringSoon = daysLeft >= 0 && daysLeft <= 5;

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50"
      style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
    >
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan-200 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      {/* Top Navigation */}
      <nav className="relative z-20 bg-white/80 backdrop-blur-xl border-b border-blue-100 sticky top-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 bg-clip-text text-transparent">
              Fazzfly ERP
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-slate-600">สวัสดี</p>
              <p className="font-semibold text-slate-800">{(session as any)?.user?.name}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        {/* Welcome Section */}
        <div className="mb-10">
          <h1 className="text-5xl font-bold text-slate-800 mb-3">
            ยินดีต้อนรับกลับ, <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">{userData?.clientName}</span>
          </h1>
          <p className="text-lg text-slate-600">
            จัดการข้อมูล ติดตามสถิติ และใช้งานโมดูลต่างๆ ได้ที่นี่
          </p>
        </div>

        {/* Account Status Card */}
        {userData && (
          <div className={`rounded-3xl p-8 mb-10 border backdrop-blur-md transition-all duration-300 ${
            isExpiringSoon 
              ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300 shadow-lg shadow-yellow-100' 
              : 'bg-gradient-to-r from-blue-50 via-sky-50 to-cyan-50 border-blue-200 shadow-lg shadow-blue-100/50'
          }`}>
            <div className="grid md:grid-cols-4 gap-6">
              <div className="p-4 rounded-2xl bg-white/60 backdrop-blur-sm border border-blue-100">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">แพ็คเจจ</p>
                <p className="text-2xl font-bold text-slate-800">{userData.planType}</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/60 backdrop-blur-sm border border-blue-100">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">ลูกค้า ID</p>
                <p className="text-2xl font-bold text-blue-600">{userData.clientId}</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/60 backdrop-blur-sm border border-blue-100">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">โมดูล</p>
                <p className="text-2xl font-bold text-cyan-600">{validModules.length}</p>
              </div>
              <div className={`p-4 rounded-2xl backdrop-blur-sm border ${
                isExpiringSoon 
                  ? 'bg-yellow-100/50 border-yellow-300' 
                  : 'bg-green-100/50 border-green-300'
              }`}>
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">คงเหลือ</p>
                <p className={`text-2xl font-bold ${isExpiringSoon ? 'text-yellow-700' : 'text-green-700'}`}>
                  {daysLeft >= 0 ? daysLeft : 0} วัน
                </p>
              </div>
            </div>
            {userData.expiryWarning && (
              <div className="mt-6 pt-6 border-t border-yellow-200">
                <p className="text-sm text-yellow-800 font-medium">
                  ⚠️ {userData.expiryWarning}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8 border-b border-blue-200 bg-white/50 backdrop-blur-md rounded-2xl p-2">
          <button
            onClick={() => setActiveTab("modules")}
            className={`px-6 py-3 font-semibold transition-all relative ${
              activeTab === "modules"
                ? "text-blue-600"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              โมดูล
            </span>
            {activeTab === "modules" && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-6 py-3 font-semibold transition-all relative ${
              activeTab === "dashboard"
                ? "text-blue-600"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Dashboard
            </span>
            {activeTab === "dashboard" && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full"></div>
            )}
          </button>
        </div>

        {/* Tab Content - Modules */}
        {activeTab === "modules" && validModules.length > 0 && (
          <div className="animate-fadeIn">
            <h2 className="text-3xl font-bold text-slate-800 mb-8">
              โมดูลที่สามารถใช้งาน <span className="text-blue-600">({validModules.length})</span>
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {validModules.map((module) => (
                <Link
                  key={module.moduleId}
                  href={`/form?moduleId=${module.moduleId}&spreadsheetId=${module.spreadsheetId}&configName=${module.configName}&sheetName=${module.sheetName}`}
                >
                  <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-lg shadow-blue-100/50 p-7 border border-blue-100/50 hover:shadow-2xl hover:shadow-blue-200 hover:-translate-y-2 transition-all duration-300 cursor-pointer group h-full">
                    <div className="flex items-center justify-between mb-5">
                      <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500 via-sky-500 to-cyan-500 text-white group-hover:scale-110 transition-transform">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <svg className="w-6 h-6 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-2 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-blue-600 transition-colors">{module.moduleName}</h3>
                    {module.notes && (
                      <p className="text-sm text-slate-600 mb-5 line-clamp-2">{module.notes}</p>
                    )}
                    <div className="pt-5 border-t border-slate-100">
                      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">รายละเอียด</p>
                      <p className="text-sm text-slate-700 mt-2">Sheet: <span className="font-semibold">{module.sheetName}</span></p>
                      <p className="text-sm text-slate-700">Config: <span className="font-semibold">{module.configName}</span></p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Tab Content - Dashboard */}
        {activeTab === "dashboard" && (
          <div className="animate-fadeIn">
            <h2 className="text-3xl font-bold text-slate-800 mb-8">
              Dashboard <span className="text-purple-600">({validDashboards.length})</span>
            </h2>
            {validDashboards.length > 0 ? (
              <>
                {/* Grid ของ Dashboard Cards - เลือกได้ */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {validDashboards.map((dashboard) => (
                    <div
                      key={dashboard.dashboardId}
                      onClick={() => setSelectedDashboard(dashboard)}
                      className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-lg shadow-purple-100/50 p-7 border border-purple-100/50 hover:shadow-2xl hover:shadow-purple-200 hover:-translate-y-2 transition-all duration-300 cursor-pointer group h-full"
                    >
                      <div className="flex items-center justify-between mb-5">
                        <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-300 via-purple-400 to-purple-500 text-white group-hover:scale-110 transition-transform">
                          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <svg className="w-6 h-6 text-slate-300 group-hover:text-purple-600 group-hover:translate-x-2 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-purple-600 transition-colors">{dashboard.dashboardName}</h3>
                      {dashboard.notes && (
                        <p className="text-sm text-slate-600 mb-5 line-clamp-2">{dashboard.notes}</p>
                      )}
                      <div className="pt-5 border-t border-slate-100">
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">รายละเอียด</p>
                        <p className="text-sm text-slate-700 mt-2">Sheet: <span className="font-semibold">{dashboard.sheetName}</span></p>
                        <p className="text-sm text-slate-700">Config: <span className="font-semibold">{dashboard.dashboardConfigName}</span></p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ✅ Dashboard Viewer - Render ตามชื่อ Dashboard */}
                {selectedDashboard && (
                  <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-lg p-8 border border-purple-100/50">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-2xl font-bold text-slate-800">
                        {selectedDashboard.dashboardName}
                      </h3>
                      <button
                        onClick={() => setSelectedDashboard(null)}
                        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                      >
                        ✕ ปิด
                      </button>
                    </div>
                    
                    {/* Loading Module Config */}
                    {loadingModuleConfigs && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 flex items-center gap-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                        <p className="text-blue-700 font-medium">กำลังโหลด Module Config...</p>
                      </div>
                    )}
                    
                    {/* ✅ Sales Dashboard */}
                    {selectedDashboard.dashboardName.toLowerCase().includes("sales") && (
                      <>
                        {!moduleConfigs["Sales"] && !loadingModuleConfigs ? (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                            <p className="text-yellow-700 font-semibold">⚠️ กำลังโหลด config...</p>
                          </div>
                        ) : moduleConfigs["Sales"] ? (
                          <SalesDashboard
                            spreadsheetId={selectedDashboard.spreadsheetId}
                            configSheetName={selectedDashboard.dashboardConfigName}
                            dataSheetName={selectedDashboard.sheetName}
                            accessToken={(session as any)?.accessToken}
                            archiveFolderId={
                              moduleConfigs["Sales"].archiveFolderId || 
                              "1lslQ4gWp9ORT67r5JjaGUuPA7489CvBX"  // ✅ Fallback
                            }
                            moduleName="Sales"
                          />
                        ) : null}
                      </>
                    )}
                    
                    {/* ✅ Payroll Dashboard */}
                    {selectedDashboard.dashboardName.toLowerCase().includes("payroll") && (
                      <PayrollDashboard
                        spreadsheetId={selectedDashboard.spreadsheetId}
                        configSheetName={selectedDashboard.dashboardConfigName}
                        dataSheetName={selectedDashboard.sheetName}
                        accessToken={(session as any)?.accessToken}
                      />
                    )}
                    
                    {/* 🚀 More dashboards coming soon... */}
                    {!selectedDashboard.dashboardName.toLowerCase().includes("sales") &&
                      !selectedDashboard.dashboardName.toLowerCase().includes("payroll") && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                        <p className="text-yellow-700 font-semibold">🚀 Dashboard นี้ยังไม่พร้อม</p>
                        <p className="text-yellow-600 text-sm mt-2">กำลังพัฒนา {selectedDashboard.dashboardName} Dashboard</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="bg-purple-50 border border-purple-200 rounded-3xl p-12 text-center">
                <svg className="w-16 h-16 text-purple-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-purple-700 text-lg font-semibold">ยังไม่มี Dashboard ที่สามารถใช้งาน</p>
                <p className="text-purple-600 text-sm mt-2">กรุณาติดต่อผู้ดูแลระบบเพื่อเพิ่ม Dashboard</p>
              </div>
            )}
          </div>
        )}

        {/* Empty State - Modules */}
        {activeTab === "modules" && validModules.length === 0 && !error && (
          <div className="bg-blue-50 border border-blue-200 rounded-3xl p-12 text-center">
            <svg className="w-16 h-16 text-blue-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-blue-700 text-lg font-semibold">ยังไม่มีโมดูลที่สามารถใช้งาน</p>
            <p className="text-blue-600 text-sm mt-2">กรุณาติดต่อผู้ดูแลระบบเพื่อเพิ่มโมดูล</p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}