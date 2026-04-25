//FILE: app/ERP/home/page.tsx
"use client";
import Image from 'next/image';
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useUserRole } from "@/app/context/UserRoleContext";
// ✅ Import new dashboard components
import SalesDashboard from "@/app/components/dashboards/sales/SalesDashboard";
import UsageDashboard from "@/app/components/dashboards/usage/UsageDashboard";
import PurchaseDashboard from "@/app/components/dashboards/purchase/PurchaseDashboard";
import ExpenseDashboard from "@/app/components/dashboards/expense/ExpenseDashboard";
import InventoryDashboard from "@/app/components/dashboards/inventory/InventoryDashboard";
import PayrollDashboard from "@/app/components/dashboards/payroll/PayrollDashboard";
import FinancialDashboard from "@/app/components/dashboards/financial/FinancialDashboard";
import QuickNav, { QuickNavTrigger, QuickNavBell, type LowStockBellItem } from "@/app/components/QuickNav";
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
  notes?: string;
}

interface ClientDocument {
  moduleId: string;
  clientId: string;
  moduleName: string;
  spreadsheetId: string;
  sheetName: string;
  configName: string;
  isActive: boolean;
  notes?: string;
}

interface DocumentModule {
  moduleId: string;
  clientId: string;
  moduleName: string;
  spreadsheetId: string;
  sheetName: string;
  configName: string;
  isActive: boolean;
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

interface ModuleConfig {
  moduleName: string;
  spreadsheetId: string;
  sheetName: string;
  configName: string;
  archiveFolderId: string;
  enabled: boolean;
}

const MASTER_CONFIG_ID = process.env.NEXT_PUBLIC_MASTER_CONFIG_ID || "1j7LguHaX8pIvvQ1PqqenuguOsPT1QthJqXJyMYW2xo8";


export default function HomePage() {
  const { data: session, status } = useSession();
  const { canEdit, isAdmin, loading: roleLoading } = useUserRole();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"modules" | "dashboard" | "documents" | "masterdata" | "logs">("modules");
  // ✅ เพิ่มโค้ดนี้
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam) {
      setActiveTab(tabParam as any);
    }
  }, [searchParams, roleLoading]);

  // ✅ Auto-select dashboard จาก URL param dashboardId
  useEffect(() => {
    const dashboardId = searchParams.get("dashboardId");
    if (!dashboardId || !userData?.dashboardItems) return;
    const found = userData.dashboardItems.find(d => d.dashboardId === dashboardId);
    if (found) setSelectedDashboard(found);
  }, [searchParams, userData]);
  const [navOpen, setNavOpen] = useState(false);
  const [selectedDashboard, setSelectedDashboard] = useState<DashboardItem | null>(null);
  const [masterDatabases, setMasterDatabases] = useState<any[]>([]);
  const [loadingMasterData, setLoadingMasterData] = useState(false);
  const [hasMasterDataAccess, setHasMasterDataAccess] = useState(false);
  const [moduleConfigs, setModuleConfigs] = useState<Record<string, ModuleConfig>>({});
  const [loadingModuleConfigs, setLoadingModuleConfigs] = useState(false);
  const [archiveFolderId, setArchiveFolderId] = useState<string | null>(null);
  const [loadingArchiveFolderId, setLoadingArchiveFolderId] = useState(false);

  // ✅ NEW: Low Stock Alert states
  const [lowStockCount, setLowStockCount] = useState<number | null>(null);
  const [lowStockItems, setLowStockItems] = useState<LowStockBellItem[]>([]);
  const [loadingLowStock, setLoadingLowStock] = useState(false);
  const [hasInventoryDashboard, setHasInventoryDashboard] = useState(false);

  // ✅ NEW: User Documents states
  const [userDocuments, setUserDocuments] = useState<Module[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);

  // ✅ Activity Log states
  const [logs, setLogs] = useState<any[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logFilterEmail, setLogFilterEmail] = useState("");
  const [logFilterAction, setLogFilterAction] = useState("");

  // ✅ Redirect to login when there's a fatal error and no userData
  useEffect(() => {
    if (error && !userData) {
      const timer = setTimeout(() => {
        router.push("/login");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error, userData, router]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      if ((session as any)?.error === "RefreshAccessTokenError") {
        signOut({ callbackUrl: "/login" });
        return;
      }
      if (!(session as any)?.accessToken) {
        const timer = setTimeout(() => fetchUserModules(), 500);
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
      if (!accessToken) {
        throw new Error("ไม่มี access token ใน session");
      }

      const response = await fetch("/api/user/modules", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          await signOut({ callbackUrl: "/login" });
          return;
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: UserData = await response.json();
      setUserData(data);
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  const fetchModuleConfig = async (moduleName: string): Promise<ModuleConfig | null> => {
    try {
      if (!MASTER_CONFIG_ID) return null;
      const accessToken = (session as any)?.accessToken;
      if (!accessToken) return null;

      const params = new URLSearchParams({ masterConfigId: MASTER_CONFIG_ID, moduleName });
      const res = await fetch(`/api/dashboard/module-config?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      });

      if (!res.ok) return null;
      const data = await res.json();
      return data.config as ModuleConfig;
    } catch {
      return null;
    }
  };

  const fetchArchiveFolderIdFromAPI = async (clientId: string, moduleName: string) => {
    try {

      setLoadingArchiveFolderId(true);

      const params = new URLSearchParams({
        clientId,
        moduleName,
      });

      const res = await fetch(`/api/dashboard/archive-folder-id?${params}`, {
        headers: {
          Authorization: `Bearer ${(session as any)?.accessToken}`,
          "Content-Type": "application/json",
        },
      });


      if (res.status === 404) {
        setArchiveFolderId(null);
        return null;
      }

      if (!res.ok) {
        setArchiveFolderId(null);
        return null;
      }

      const data = await res.json();

      if (!data.archiveFolderId) {
        setArchiveFolderId(null);
        return null;
      }

      setArchiveFolderId(data.archiveFolderId);
      return data.archiveFolderId;
    } catch (error: any) {
      setArchiveFolderId(null);
      return null;
    } finally {
      setLoadingArchiveFolderId(false);
    }
  };

  // ✅ NEW: Fetch low stock count from Inventory module
  const fetchLowStockCount = async () => {
    try {
      setLoadingLowStock(true);

      // Check if user has Inventory dashboard
      const inventoryDash = userData?.dashboardItems.find(d =>
        d.dashboardName.toLowerCase().includes("inventory")
      );

      if (!inventoryDash) {
        setHasInventoryDashboard(false);
        setLowStockCount(0);
        return;
      }

      setHasInventoryDashboard(true);

      // Fetch data from Inventory sheet (API ใช้ SA + NextAuth JWT cookie)
      const params = new URLSearchParams({
        spreadsheetId: inventoryDash.spreadsheetId,
        configSheetName: inventoryDash.dashboardConfigName,
        dataSheetName: inventoryDash.sheetName,
      });

      const response = await fetch(`/api/dashboard/data?${params}`);

      if (!response.ok) {
        setLowStockCount(0);
        return;
      }

      const data = await response.json();

      // Find status field from config
      const statusField = data.config.find((f: any) =>
        f.fieldName === "status" ||
        f.label?.toLowerCase().includes("สถานะ")
      );

      if (!statusField) {
        setLowStockCount(0);
        return;
      }

      // Find name field
      const nameField = data.config.find((f: any) =>
        ["productName", "name", "itemName", "product", "สินค้า", "ชื่อ"].some(k =>
          (f.fieldName || "").toLowerCase().includes(k.toLowerCase()) ||
          (f.label || "").toLowerCase().includes(k.toLowerCase())
        )
      ) ?? data.config[0];

      // Filter low stock items
      const lowStockStatuses = ["สต๊อกต่ำ", "ใกล้หมด", "หมดแล้ว"];
      const filtered = data.data.filter((row: any) => {
        const status = String(row[statusField.fieldName] || "").trim();
        return lowStockStatuses.includes(status);
      });

      const items: LowStockBellItem[] = filtered.map((row: any) => ({
        name: String(row[nameField?.fieldName] || "สินค้า").trim(),
        status: String(row[statusField.fieldName] || "").trim(),
      }));

      setLowStockItems(items);
      setLowStockCount(items.length);

    } catch (error) {
      setLowStockCount(0);
    } finally {
      setLoadingLowStock(false);
    }
  };

  // ✅ NEW: Fetch user documents from API
  const fetchUserDocuments = async () => {
    try {
      setLoadingDocuments(true);

      const accessToken = (session as any)?.accessToken;
      if (!accessToken) {
        setUserDocuments([]);
        return;
      }

      // ✅ Get clientId from userData
      if (!userData?.clientId) {
        setUserDocuments([]);
        return;
      }


      // ✅ Pass clientId as query parameter
      const response = await fetch(`/api/user/documents?clientId=${userData.clientId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });


      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setUserDocuments([]);
        return;
      }

      const data = await response.json();

      // Transform API response to Module format
      const documents: Module[] = data.documents.map((doc: any) => ({
        moduleId: doc.moduleId,
        moduleName: doc.moduleName,
        spreadsheetId: doc.spreadsheetId,
        sheetName: doc.sheetName,
        configName: doc.configName || "",
        notes: doc.notes,
      }));

      setUserDocuments(documents);

    } catch (error: any) {
      setUserDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  };

  // ✅ NEW: Fetch master databases
  const fetchMasterDatabases = async (forceRefresh = false) => {
    try {
      setLoadingMasterData(true);

      const accessToken = (session as any)?.accessToken;
      if (!accessToken) {
        setMasterDatabases([]);
        setHasMasterDataAccess(false);
        return;
      }

      const url = forceRefresh ? "/api/master/databases?refresh=true" : "/api/master/databases";
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });


      if (!response.ok) {
        setMasterDatabases([]);
        setHasMasterDataAccess(false);
        return;
      }

      const data = await response.json();

      if (data.totalDatabases > 0) {
        setMasterDatabases(data.databases || []);
        setHasMasterDataAccess(true);
      } else {
        setMasterDatabases([]);
        setHasMasterDataAccess(false);
      }

    } catch (error: any) {
      setMasterDatabases([]);
      setHasMasterDataAccess(false);
    } finally {
      setLoadingMasterData(false);
    }
  };

  // ✅ NEW: Navigate to Inventory Dashboard
  const goToInventoryDashboard = () => {
    const inventoryDash = userData?.dashboardItems.find(d =>
      d.dashboardName.toLowerCase().includes("inventory")
    );

    if (inventoryDash) {
      setActiveTab("dashboard");
      setSelectedDashboard(inventoryDash);

      // Scroll to top smoothly
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // ✅ useEffect: Fetch low stock when userData is loaded
  useEffect(() => {
    if (userData && activeTab === "modules") {
      fetchLowStockCount();
    }
  }, [userData, activeTab]);

  // Prefetch documents immediately when userData loads (no tab dependency)
  useEffect(() => {
    if (userData && userDocuments.length === 0 && !loadingDocuments) {
      fetchUserDocuments();
    }
  }, [userData]);

  // Prefetch master databases immediately when userData loads (no tab dependency)
  useEffect(() => {
    if (userData && masterDatabases.length === 0 && !loadingMasterData) {
      fetchMasterDatabases();
    }
  }, [userData]);

  // ✅ Activity Log fetch
  const fetchActivityLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch("/api/admin/logs?limit=300");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setLogs(data.logs || []);
      setLogsTotal(data.total || 0);
    } catch (err: any) {
    } finally {
      setLoadingLogs(false);
    }
  };

  // Prefetch activity logs for admin immediately after userData+role ready
  useEffect(() => {
    if (userData && !roleLoading && isAdmin() && logs.length === 0 && !loadingLogs) {
      fetchActivityLogs();
    }
  }, [userData, roleLoading]);

  useEffect(() => {
    if (selectedDashboard && userData) {
      const dashboardName = selectedDashboard.dashboardName.toLowerCase();

      let moduleName = "";
      if (dashboardName.includes("sales")) moduleName = "Sales";
      else if (dashboardName.includes("purchase")) moduleName = "Purchase";
      else if (dashboardName.includes("payroll")) moduleName = "Payroll";
      else if (dashboardName.includes("expense")) moduleName = "Expense";
      else if (dashboardName.includes("inventory")) moduleName = "Inventory";
      else if (dashboardName.includes("financial")) moduleName = "Financial";
      else if (dashboardName.includes("usage")) moduleName = "Usage";

      if (moduleName) {
        setLoadingModuleConfigs(true);
        setArchiveFolderId(null);

        fetchModuleConfig(moduleName).then((config) => {
          if (config) {
            setModuleConfigs(prev => ({
              ...prev,
              [moduleName]: config,
            }));

            if (config.archiveFolderId) {
              setArchiveFolderId(config.archiveFolderId);
              setLoadingModuleConfigs(false);
            } else {
              fetchArchiveFolderIdFromAPI(userData.clientId, moduleName).then((folderId) => {
                if (!folderId) {
                }
                setLoadingModuleConfigs(false);
              });
            }
          } else {
            setLoadingModuleConfigs(false);
          }
        });
      }
    }
  }, [selectedDashboard, userData]);

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

  // ✅ CHANGED: ใช้ userDocuments จาก API แทน filter จาก modules
  // const documentModules จะมาจาก userDocuments ที่ดึงผ่าน API /api/user/documents
  const documentModules = userDocuments;

  if (error && !userData) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50 p-4"
        style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
      >
        <div className="text-center bg-white rounded-3xl p-6 lg:p-8 shadow-lg max-w-md w-full">
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
            className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            ลองใหม่อีกครั้ง
          </button>
        </div>
      </div>
    );
  }

  const daysLeft = userData ? getDaysUntilExpiry(userData.expiresAt) : 0;
  const isExpiringSoon = userData ? (daysLeft >= 0 && daysLeft <= 5) : false;

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50 pb-20 lg:pb-0"
      style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
    >
      <QuickNav isOpen={navOpen} onClose={() => setNavOpen(false)} />
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 lg:w-96 h-80 lg:h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 lg:w-96 h-80 lg:h-96 bg-cyan-200 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 lg:w-96 h-80 lg:h-96 bg-sky-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      {/* Top Navigation - Mobile Optimized with CLEAR Back Button */}
      <nav className="relative z-20 bg-white/80 backdrop-blur-xl border-b border-blue-100 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-3 lg:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 lg:gap-4 min-w-0">
            {/* Hamburger */}
            <QuickNavTrigger onClick={() => setNavOpen(true)} />

            {/* ✅ ENHANCED Back to System Selector Button - มองเห็นชัดเจน */}
            <Link
              href="/select-system"
              className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-slate-100 to-slate-50 hover:from-blue-50 hover:to-cyan-50 border border-slate-200 hover:border-blue-300 rounded-xl transition-all duration-300 group shadow-sm hover:shadow-md flex-shrink-0"
            >
              <svg
                className="w-5 h-5 text-slate-600 group-hover:text-blue-600 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm font-semibold text-slate-700 group-hover:text-blue-600 transition-colors hidden sm:inline">
                ย้อนกลับ
              </span>
            </Link>

            {/* Logo */}
            <div className="w-8 lg:w-10 h-8 lg:h-10 flex items-center justify-center flex-shrink-0">
              <Image
                src="/logo2.png"
                alt="Fazzfly Logo"
                width={40}
                height={40}
                className="object-contain"
              />
            </div>

            {/* Title */}
            <div className="hidden md:block">
              <span className="text-lg lg:text-xl font-bold bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 bg-clip-text text-transparent">
                Fazzfly ERP
              </span>
              <p className="text-xs text-slate-500">ระบบบริหารจัดการ</p>
            </div>

            {/* Mobile Title */}
            <span className="text-base font-bold bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 bg-clip-text text-transparent md:hidden">
              Fazzfly ERP
            </span>
          </div>

          <div className="flex items-center gap-2 lg:gap-4 ml-auto">
            {/* User Info */}
            <div className="text-right hidden sm:block">
              <p className="text-xs text-slate-600">สวัสดี</p>
              <p className="font-semibold text-slate-800 text-sm truncate max-w-[120px] lg:max-w-none">
                {(session as any)?.user?.name}
              </p>
            </div>

            {/* User Avatar - Mobile */}
            <div className="sm:hidden w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
              {(session as any)?.user?.name?.charAt(0) || "U"}
            </div>

            {/* Task Bell */}
            <TaskBell />

            {/* Inventory Bell */}
            <QuickNavBell items={lowStockItems} loading={loadingLowStock} onBellClick={goToInventoryDashboard} />

            {/* Sign Out Button */}
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="px-3 lg:px-4 py-2 text-xs lg:text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium whitespace-nowrap flex-shrink-0 border border-red-200 hover:border-red-300"
            >
              <span className="hidden sm:inline">ออกจากระบบ</span>
              <span className="sm:hidden">ออก</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content - Mobile Optimized */}
      <div className="relative z-10 max-w-10xl mx-auto px-4 lg:px-6 py-6 lg:py-12">
        {/* Welcome Section */}
        <div className="mb-6 lg:mb-10">
          <h1 className="text-3xl lg:text-5xl font-bold text-slate-800 mb-2 lg:mb-3 break-words">
            ยินดีต้อนรับกลับ,{' '}
            {userData ? (
              <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                {userData.clientName}
              </span>
            ) : (
              <span className="inline-block w-36 h-9 bg-slate-200 animate-pulse rounded-xl align-middle" />
            )}
          </h1>
          <p className="text-base lg:text-lg text-slate-600">
            จัดการข้อมูล ติดตามสถิติ และใช้งานโมดูลต่างๆ
          </p>
        </div>

        {/* Tab Navigation - Mobile Optimized */}
        <div className="flex gap-2 mb-6 lg:mb-8 overflow-x-auto scrollbar-hide bg-white/50 backdrop-blur-md rounded-xl lg:rounded-2xl p-2 border border-blue-100/50 min-h-[52px]">
          <button
            onClick={() => setActiveTab("modules")}
            className={`px-4 lg:px-6 py-2.5 lg:py-3 font-semibold transition-all relative whitespace-nowrap text-sm lg:text-base ${activeTab === "modules"
              ? "text-blue-600"
              : "text-slate-600 hover:text-slate-800"
              }`}
          >
            <span className="flex items-center gap-1 lg:gap-2">
              <svg className="w-4 lg:w-5 h-4 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              โมดูล
            </span>
            {activeTab === "modules" && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full"></div>
            )}
          </button>
          {(userData?.dashboardItems?.length ?? 0) > 0 && isAdmin() && (
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`px-4 lg:px-6 py-2.5 lg:py-3 font-semibold transition-all relative whitespace-nowrap text-sm lg:text-base ${activeTab === "dashboard"
                ? "text-blue-600"
                : "text-slate-600 hover:text-slate-800"
                }`}
            >
              <span className="flex items-center gap-1 lg:gap-2">
                <svg className="w-4 lg:w-5 h-4 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Dashboard
              </span>
              {activeTab === "dashboard" && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full"></div>
              )}
            </button>
          )}

          {/* ✅ NEW: Tab เอกสาร */}
          <button
            onClick={() => setActiveTab("documents")}
            className={`px-4 lg:px-6 py-2.5 lg:py-3 font-semibold transition-all relative whitespace-nowrap text-sm lg:text-base ${activeTab === "documents"
              ? "text-emerald-600"
              : "text-slate-600 hover:text-slate-800"
              }`}
          >
            <span className="flex items-center gap-1 lg:gap-2">
              <svg className="w-4 lg:w-5 h-4 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              เอกสาร
              {documentModules.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full font-bold">
                  {documentModules.length}
                </span>
              )}
            </span>
            {activeTab === "documents" && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-600 to-teal-500 rounded-full"></div>
            )}
          </button>


          {/* ✅ Tab ข้อมูลหลัก */}
          <button
              onClick={() => setActiveTab("masterdata")}
              className={`px-4 lg:px-6 py-2.5 lg:py-3 font-semibold transition-all relative whitespace-nowrap text-sm lg:text-base ${activeTab === "masterdata"
                ? "text-indigo-600"
                : "text-slate-600 hover:text-slate-800"
                }`}
            >
              <span className="flex items-center gap-1 lg:gap-2">
                <svg className="w-4 lg:w-5 h-4 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
                ข้อมูลหลัก
                {masterDatabases.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full font-bold">
                    {masterDatabases.length}
                  </span>
                )}
              </span>
              {activeTab === "masterdata" && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-600 to-purple-500 rounded-full"></div>
              )}
            </button>

          {/* ✅ Tab Activity Log — Admin only */}
          {isAdmin() && (
            <button
              onClick={() => setActiveTab("logs")}
              className={`px-4 lg:px-6 py-2.5 lg:py-3 font-semibold transition-all relative whitespace-nowrap text-sm lg:text-base ${activeTab === "logs"
                ? "text-rose-600"
                : "text-slate-600 hover:text-slate-800"
                }`}
            >
              <span className="flex items-center gap-1 lg:gap-2">
                <svg className="w-4 lg:w-5 h-4 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Activity Log
              </span>
              {activeTab === "logs" && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-pink-500 rounded-full"></div>
              )}
            </button>
          )}

        </div>

        {/* Tab Content - Modules */}
        {activeTab === "modules" && loading && (
          <div className="animate-fadeIn">
            <div className="h-8 w-64 bg-slate-200 animate-pulse rounded-lg mb-6 lg:mb-8" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white/90 rounded-2xl lg:rounded-3xl shadow-lg p-5 lg:p-7 border border-blue-100/50 animate-pulse">
                  <div className="w-12 h-12 bg-slate-200 rounded-2xl mb-4" />
                  <div className="h-5 bg-slate-200 rounded mb-2 w-3/4" />
                  <div className="h-4 bg-slate-100 rounded mb-1 w-full" />
                  <div className="h-4 bg-slate-100 rounded w-2/3 mb-5" />
                  <div className="pt-4 border-t border-slate-100 flex gap-2">
                    <div className="h-9 flex-1 bg-slate-200 rounded-lg" />
                    <div className="h-9 flex-1 bg-slate-200 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {activeTab === "modules" && !loading && validModules.length > 0 && (
          <div className="animate-fadeIn">
            <h2 className="text-2xl lg:text-3xl font-bold text-slate-800 mb-4 lg:mb-8">
              โมดูลที่สามารถใช้งาน <span className="text-blue-600">({validModules.length})</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
              {validModules.map((module) => (
                <div
                  key={module.moduleId}
                  className="bg-white/90 backdrop-blur-xl rounded-2xl lg:rounded-3xl shadow-lg shadow-blue-100/50 p-5 lg:p-7 border border-blue-100/50 hover:shadow-2xl hover:shadow-blue-200 hover:-translate-y-2 transition-all duration-300 group h-full"
                >
                  <div className="flex items-center justify-between mb-4 lg:mb-5">
                    <div className="p-3 lg:p-4 rounded-xl lg:rounded-2xl bg-gradient-to-br from-blue-500 via-sky-500 to-cyan-500 text-white group-hover:scale-110 transition-transform">
                      <svg className="w-5 lg:w-7 h-5 lg:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                  </div>

                  <h3 className="text-lg lg:text-xl font-bold text-slate-800 mb-2">{module.moduleName}</h3>

                  {module.notes && (
                    <p className="text-xs lg:text-sm text-slate-600 mb-4 lg:mb-5 line-clamp-2">{module.notes}</p>
                  )}

                  <div className="pt-4 lg:pt-5 border-t border-slate-100 mb-5">
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">รายละเอียด</p>
                    <p className="text-xs lg:text-sm text-slate-700 mt-2">Sheet: <span className="font-semibold">{module.sheetName}</span></p>
                    <p className="text-xs lg:text-sm text-slate-700">Config: <span className="font-semibold">{module.configName}</span></p>
                  </div>

                  {/* ✅ Action Buttons - เพิ่มตรงนี้ */}
                  <div className="flex gap-2">
                    <Link
                      href={`/ERP/form?moduleId=${module.moduleId}&spreadsheetId=${module.spreadsheetId}&configName=${module.configName}&sheetName=${module.sheetName}`}
                      className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-lg font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 group/btn"
                    >
                      <svg className="w-4 h-4 group-hover/btn:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      เพิ่มข้อมูล
                    </Link>

                    {canEdit() && (
                      <Link
                        href={`/ERP/transaction/edit?moduleId=${module.moduleId}&spreadsheetId=${module.spreadsheetId}&sheetName=${module.sheetName}&configName=${module.configName}&moduleName=${encodeURIComponent(module.moduleName)}`}
                        className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 group/btn"
                      >
                        <svg className="w-4 h-4 group-hover/btn:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        แก้ไข/ลบ
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Content - Dashboard — ซ่อนถ้าไม่มี dashboardItems */}
        {activeTab === "dashboard" && (userData?.dashboardItems?.length ?? 0) > 0 && (
          <div className="animate-fadeIn">
            <h2 className="text-2xl lg:text-3xl font-bold text-slate-800 mb-4 lg:mb-8">
              Dashboard <span className="text-purple-600">({validDashboards.length})</span>
            </h2>
            {validDashboards.length > 0 ? (
              <>
                {/* Dashboard Navigation - Horizontal Scroll on Mobile */}
                <div className="bg-white/90 backdrop-blur-xl rounded-xl lg:rounded-2xl shadow-lg shadow-purple-100/50 p-3 lg:p-4 border border-purple-100/50 mb-4 lg:mb-8 overflow-x-auto scrollbar-hide">
                  <div className="flex gap-2 lg:gap-3 min-w-min lg:min-w-0">
                    {validDashboards.map((dashboard) => (
                      <button
                        key={dashboard.dashboardId}
                        onClick={() => setSelectedDashboard(dashboard)}
                        className={`px-4 lg:px-5 py-2 lg:py-2.5 rounded-lg font-semibold transition-all whitespace-nowrap text-sm lg:text-base ${selectedDashboard?.dashboardId === dashboard.dashboardId
                          ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                      >
                        {dashboard.dashboardName}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dashboard Content */}
                {selectedDashboard && (
                  // 🟢 เปลี่ยนจาก bg-white/90 เป็น bg-slate-50/90 (เทาอ่อน)
                  <div className="bg-slate-50/90 backdrop-blur-xl rounded-2xl lg:rounded-3xl shadow-lg p-4 lg:p-8 border border-slate-200 animate-fadeIn">
                    <div className="flex items-center justify-between mb-6 lg:mb-8 ">
                      <h3 className="text-xl lg:text-2xl font-bold text-slate-800">
                        {selectedDashboard.dashboardName}
                      </h3>
                    </div>

                    {/* Loading state - ปรับสีพื้นหลังให้เข้ากัน */}
                    {(loadingModuleConfigs || loadingArchiveFolderId) && (
                      <div className="bg-slate-200/50 border border-slate-300 rounded-lg p-4 lg:p-6 flex items-center gap-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-600 flex-shrink-0"></div>
                        <p className="text-slate-700 font-medium text-sm lg:text-base">
                          {loadingModuleConfigs ? "กำลังโหลด Config..." : "กำลังดึง Archive Folder ID..."}
                        </p>
                      </div>
                    )}

                    {/* Sales Dashboard */}
                    {selectedDashboard.dashboardName.toLowerCase().includes("sales") && (
                      <>
                        {!loadingModuleConfigs && !loadingArchiveFolderId ? (
                          moduleConfigs["Sales"] ? (
                            <SalesDashboard
                              spreadsheetId={selectedDashboard.spreadsheetId}
                              configSheetName={selectedDashboard.dashboardConfigName}
                              dataSheetName={selectedDashboard.sheetName}
                              accessToken={(session as any)?.accessToken}
                              archiveFolderId={archiveFolderId || undefined}
                              moduleName="Sales"
                            />
                          ) : (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 lg:p-6">
                              <p className="text-red-700 font-semibold text-sm lg:text-base">❌ ไม่สามารถโหลด Sales Config</p>
                              <p className="text-red-600 text-xs lg:text-sm mt-2">
                                ตรวจสอบว่า Master Config มีข้อมูล Sales Module หรือ Refresh หน้านี้
                              </p>
                            </div>
                          )
                        ) : null}
                      </>
                    )}

                    {/* Usage Dashboard */}
                    {selectedDashboard.dashboardName.toLowerCase().includes("usage") && (
                      <>
                        {!loadingModuleConfigs && !loadingArchiveFolderId ? (
                          moduleConfigs["Usage"] ? (
                            <UsageDashboard
                              spreadsheetId={selectedDashboard.spreadsheetId}
                              configSheetName={selectedDashboard.dashboardConfigName}
                              dataSheetName={selectedDashboard.sheetName}
                              accessToken={(session as any)?.accessToken}
                              archiveFolderId={archiveFolderId || undefined}
                              moduleName="Usage"
                            />
                          ) : (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 lg:p-6">
                              <p className="text-red-700 font-semibold text-sm lg:text-base">❌ ไม่สามารถโหลด Usage Config</p>
                              <p className="text-red-600 text-xs lg:text-sm mt-2">
                                ตรวจสอบว่า Master Config มีข้อมูล Usage Module หรือ Refresh หน้านี้
                              </p>
                            </div>
                          )
                        ) : null}
                      </>
                    )}

                    {/* Purchase Dashboard */}
                    {selectedDashboard.dashboardName.toLowerCase().includes("purchase") && (
                      <>
                        {!loadingModuleConfigs && !loadingArchiveFolderId ? (
                          moduleConfigs["Purchase"] ? (
                            <PurchaseDashboard
                              spreadsheetId={selectedDashboard.spreadsheetId}
                              configSheetName={selectedDashboard.dashboardConfigName}
                              dataSheetName={selectedDashboard.sheetName}
                              accessToken={(session as any)?.accessToken}
                              archiveFolderId={archiveFolderId || undefined}
                              moduleName="Purchase"
                            />
                          ) : (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 lg:p-6">
                              <p className="text-red-700 font-semibold text-sm lg:text-base">❌ ไม่สามารถโหลด Purchase Config</p>
                              <p className="text-red-600 text-xs lg:text-sm mt-2">
                                ตรวจสอบว่า Master Config มีข้อมูล Purchase Module หรือ Refresh หน้านี้
                              </p>
                            </div>
                          )
                        ) : null}
                      </>
                    )}

                    {/* Expense Dashboard */}
                    {selectedDashboard.dashboardName.toLowerCase().includes("expense") && (
                      <>
                        {!loadingModuleConfigs && !loadingArchiveFolderId ? (
                          moduleConfigs["Expense"] ? (
                            <ExpenseDashboard
                              spreadsheetId={selectedDashboard.spreadsheetId}
                              configSheetName={selectedDashboard.dashboardConfigName}
                              dataSheetName={selectedDashboard.sheetName}
                              accessToken={(session as any)?.accessToken}
                              archiveFolderId={archiveFolderId || undefined}
                              moduleName="Expense"
                            />
                          ) : (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 lg:p-6">
                              <p className="text-red-700 font-semibold text-sm lg:text-base">❌ ไม่สามารถโหลด Expense Config</p>
                              <p className="text-red-600 text-xs lg:text-sm mt-2">
                                ตรวจสอบว่า Master Config มีข้อมูล Expense Module หรือ Refresh หน้านี้
                              </p>
                            </div>
                          )
                        ) : null}
                      </>
                    )}

                    {/* Inventory Dashboard */}
                    {selectedDashboard.dashboardName.toLowerCase().includes("inventory") && (
                      <>
                        {!loadingModuleConfigs && !loadingArchiveFolderId ? (
                          moduleConfigs["Inventory"] ? (
                            <InventoryDashboard
                              spreadsheetId={selectedDashboard.spreadsheetId}
                              configSheetName={selectedDashboard.dashboardConfigName}
                              dataSheetName={selectedDashboard.sheetName}
                              accessToken={(session as any)?.accessToken}
                              archiveFolderId={archiveFolderId || undefined}
                              moduleName="Inventory"
                            />
                          ) : (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 lg:p-6">
                              <p className="text-red-700 font-semibold text-sm lg:text-base">❌ ไม่สามารถโหลด Inventory Config</p>
                              <p className="text-red-600 text-xs lg:text-sm mt-2">
                                ตรวจสอบว่า Master Config มีข้อมูล Inventory Module หรือ Refresh หน้านี้
                              </p>
                            </div>
                          )
                        ) : null}
                      </>
                    )}

                    {/* Financial Dashboard */}
                    {selectedDashboard.dashboardName.toLowerCase().includes("financial") && (
                      <>
                        {!loadingModuleConfigs && !loadingArchiveFolderId ? (
                          moduleConfigs["Financial"] ? (
                            <FinancialDashboard
                              spreadsheetId={selectedDashboard.spreadsheetId}
                              configSheetName={selectedDashboard.dashboardConfigName}
                              dataSheetName={selectedDashboard.sheetName}
                              accessToken={(session as any)?.accessToken}
                              archiveFolderId={archiveFolderId || undefined}
                              moduleName="Financial"
                            />
                          ) : (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 lg:p-6">
                              <p className="text-red-700 font-semibold text-sm lg:text-base">❌ ไม่สามารถโหลด Financial Config</p>
                              <p className="text-red-600 text-xs lg:text-sm mt-2">
                                ตรวจสอบว่า Master Config มีข้อมูล Financial Module หรือ Refresh หน้านี้
                              </p>
                            </div>
                          )
                        ) : null}
                      </>
                    )}

                    {/* Payroll Dashboard */}
                    {selectedDashboard.dashboardName.toLowerCase().includes("payroll") && (
                      <>
                        {!loadingModuleConfigs && !loadingArchiveFolderId ? (
                          moduleConfigs["Payroll"] ? (
                            <PayrollDashboard
                              spreadsheetId={selectedDashboard.spreadsheetId}
                              configSheetName={selectedDashboard.dashboardConfigName}
                              dataSheetName={selectedDashboard.sheetName}
                              accessToken={(session as any)?.accessToken}
                              archiveFolderId={archiveFolderId || undefined}
                              moduleName="Payroll"
                            />
                          ) : (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 lg:p-6">
                              <p className="text-red-700 font-semibold text-sm lg:text-base">❌ ไม่สามารถโหลด Payroll Config</p>
                              <p className="text-red-600 text-xs lg:text-sm mt-2">
                                ตรวจสอบว่า Master Config มีข้อมูล Payroll Module หรือ Refresh หน้านี้
                              </p>
                            </div>
                          )
                        ) : null}
                      </>
                    )}

                    {/* More dashboards coming soon... */}
                    {!selectedDashboard.dashboardName.toLowerCase().includes("sales") &&
                      !selectedDashboard.dashboardName.toLowerCase().includes("expense") &&
                      !selectedDashboard.dashboardName.toLowerCase().includes("purchase") &&
                      !selectedDashboard.dashboardName.toLowerCase().includes("payroll") &&
                      !selectedDashboard.dashboardName.toLowerCase().includes("financial") &&
                      !selectedDashboard.dashboardName.toLowerCase().includes("inventory") &&
                      !selectedDashboard.dashboardName.toLowerCase().includes("usage") && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 lg:p-6 text-center">
                          <p className="text-yellow-700 font-semibold text-sm lg:text-base">🚀 Dashboard นี้ยังไม่พร้อม</p>
                          <p className="text-yellow-600 text-xs lg:text-sm mt-2">กำลังพัฒนา {selectedDashboard.dashboardName} Dashboard</p>
                        </div>
                      )}
                  </div>
                )}

                {/* Show hint if no dashboard selected */}
                {!selectedDashboard && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl lg:rounded-2xl p-6 lg:p-8 text-center">
                    <svg className="w-12 lg:w-16 h-12 lg:h-16 text-blue-300 mx-auto mb-3 lg:mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-blue-700 font-semibold text-base lg:text-lg">เลือก Dashboard จากด้านบน</p>
                    <p className="text-blue-600 text-sm mt-2">คลิกที่ชื่อ Dashboard เพื่อดูข้อมูล</p>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-purple-50 border border-purple-200 rounded-2xl lg:rounded-3xl p-8 lg:p-12 text-center">
                <svg className="w-12 lg:w-16 h-12 lg:h-16 text-purple-300 mx-auto mb-3 lg:mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-purple-700 text-base lg:text-lg font-semibold">ยังไม่มี Dashboard ที่สามารถใช้งาน</p>
                <p className="text-purple-600 text-xs lg:text-sm mt-2">กรุณาติดต่อผู้ดูแลระบบเพื่อเพิ่ม Dashboard</p>
              </div>
            )}
          </div>
        )}

        {/* ✅ NEW: Tab Content - Documents */}
        {activeTab === "documents" && (
          <div className="animate-fadeIn">
            <h2 className="text-2xl lg:text-3xl font-bold text-slate-800 mb-4 lg:mb-8">
              เอกสาร <span className="text-emerald-600">({documentModules.length})</span>
            </h2>

            {/* Skeleton Loading */}
            {loadingDocuments && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white/90 rounded-2xl lg:rounded-3xl shadow-lg p-5 lg:p-7 border border-emerald-100/50 animate-pulse">
                    <div className="flex justify-between mb-4">
                      <div className="w-12 h-12 bg-slate-200 rounded-2xl" />
                      <div className="w-5 h-5 bg-slate-100 rounded" />
                    </div>
                    <div className="h-5 bg-slate-200 rounded mb-2 w-3/4" />
                    <div className="h-4 bg-slate-100 rounded w-full mb-1" />
                    <div className="pt-4 border-t border-slate-100 mt-4">
                      <div className="h-3 bg-slate-100 rounded w-1/2 mb-2" />
                      <div className="h-3 bg-slate-100 rounded w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Content */}
            {!loadingDocuments && documentModules.length > 0 ? (
              <>
                {/* Document Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-8">
                  {documentModules.map((doc) => {
                    // กำหนด URL ตาม moduleName
                    let docUrl = "";
                    const moduleName = doc.moduleName.toLowerCase();

                    const configName = (doc.configName || "").toLowerCase();
                    if (moduleName.includes("payroll") || moduleName.includes("สลิป") || moduleName.includes("payslip") || moduleName.includes("เงินเดือน")) {
                      docUrl = `/ERP/payroll-slip?moduleId=${doc.moduleId}&spreadsheetId=${doc.spreadsheetId}`;
                    } else if (moduleName.includes("receipt") || moduleName.includes("ใบเสร็จ")) {
                      docUrl = `/ERP/receipt-simple?moduleId=${doc.moduleId}&spreadsheetId=${doc.spreadsheetId}`;
                    } else if (moduleName.includes("หัก") || moduleName.includes("withholding") || configName.includes("หัก_ณ") || configName.includes("withholding")) {
                      docUrl = `/ERP/withholding-tax?moduleId=${doc.moduleId}&spreadsheetId=${doc.spreadsheetId}&configName=${encodeURIComponent(doc.configName)}&sheetName=${encodeURIComponent(doc.sheetName)}`;
                    } else if (moduleName.includes("invoice") || moduleName.includes("ใบแจ้งหนี้")) {
                      docUrl = `/ERP/invoice?moduleId=${doc.moduleId}&spreadsheetId=${doc.spreadsheetId}`;
                    } else if (moduleName.includes("quotation") || moduleName.includes("ใบเสนอราคา")) {
                      docUrl = `/ERP/quotation?moduleId=${doc.moduleId}&spreadsheetId=${doc.spreadsheetId}`;
                    }

                    return (
                      <Link
                        key={doc.moduleId}
                        href={docUrl}
                        className="bg-white/90 backdrop-blur-xl rounded-2xl lg:rounded-3xl shadow-lg p-5 lg:p-7 border border-emerald-100/50 hover:border-emerald-300 hover:shadow-2xl hover:shadow-emerald-200 hover:-translate-y-2 transition-all duration-300 group h-full block"
                      >
                        <div className="flex items-center justify-between mb-4 lg:mb-5">
                          <div className="p-3 lg:p-4 rounded-xl lg:rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white group-hover:scale-110 transition-transform">
                            <svg className="w-5 lg:w-7 h-5 lg:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <svg className="w-5 lg:w-6 h-5 lg:h-6 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-2 transition-all flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>

                        <h3 className="text-lg lg:text-xl font-bold text-slate-800 group-hover:text-emerald-600 mb-2 transition-colors">
                          {doc.moduleName}
                        </h3>

                        {doc.notes && (
                          <p className="text-xs lg:text-sm text-slate-600 mb-4 lg:mb-5 line-clamp-2">{doc.notes}</p>
                        )}

                        <div className="pt-4 lg:pt-5 border-t border-slate-100">
                          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">รายละเอียด</p>
                          <p className="text-xs lg:text-sm text-slate-700 mt-2">
                            Sheet: <span className="font-semibold">{doc.sheetName}</span>
                          </p>
                          <p className="text-xs lg:text-sm text-slate-700">
                            Config: <span className="font-semibold">{doc.configName}</span>
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </>
            ) : !loadingDocuments ? (
              /* Empty State - No Documents */
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl lg:rounded-3xl p-8 lg:p-12 text-center">
                <svg className="w-12 lg:w-16 h-12 lg:h-16 text-emerald-300 mx-auto mb-3 lg:mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-emerald-700 text-base lg:text-lg font-semibold">ยังไม่มีโมดูลเอกสารที่สามารถใช้งาน</p>
                <p className="text-emerald-600 text-xs lg:text-sm mt-2">
                  กรุณาติดต่อผู้ดูแลระบบเพื่อเพิ่มโมดูล Receipt, Payslip, Invoice หรือ Quotation
                </p>
                <p className="text-emerald-500 text-xs mt-4">
                  💡 ตรวจสอบว่ามีข้อมูลใน sheet "client_receipt" และ is_active = TRUE
                </p>
              </div>
            ) : null}
          </div>
        )}
        {/* ✅ NEW: Tab Content - Master Data - เพิ่มตรงนี้! */}
        {activeTab === "masterdata" && (
          <div className="animate-fadeIn">
            <div className="flex items-center justify-between mb-4 lg:mb-8">
              <h2 className="text-2xl lg:text-3xl font-bold text-slate-800">
                ข้อมูลหลัก (Master Data) <span className="text-indigo-600">({masterDatabases.length})</span>
              </h2>
              <button
                onClick={() => fetchMasterDatabases(true)}
                disabled={loadingMasterData}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                <svg className={`w-4 h-4 ${loadingMasterData ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                รีเฟรช
              </button>
            </div>

            {/* Skeleton Loading */}
            {loadingMasterData && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white/90 rounded-2xl lg:rounded-3xl shadow-lg p-5 lg:p-7 border border-indigo-100/50 animate-pulse">
                    <div className="w-12 h-12 bg-slate-200 rounded-2xl mb-4" />
                    <div className="h-5 bg-slate-200 rounded mb-2 w-3/4" />
                    <div className="h-4 bg-slate-100 rounded w-full mb-5" />
                    <div className="pt-4 border-t border-slate-100 flex gap-2">
                      <div className="h-9 flex-1 bg-slate-200 rounded-lg" />
                      <div className="h-9 flex-1 bg-slate-200 rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ✅ Master Data Grid - UI เหมือน Modules เป๊ะ */}
            {!loadingMasterData && masterDatabases.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                {masterDatabases.map((db: any) => (
                  <div
                    key={db.databaseId}
                    className="bg-white/90 backdrop-blur-xl rounded-2xl lg:rounded-3xl shadow-lg shadow-indigo-100/50 p-5 lg:p-7 border border-indigo-100/50 hover:shadow-2xl hover:shadow-indigo-200 hover:-translate-y-2 transition-all duration-300 group h-full"
                  >
                    <div className="flex items-center justify-between mb-4 lg:mb-5">
                      <div className="p-3 lg:p-4 rounded-xl lg:rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white group-hover:scale-110 transition-transform">
                        <svg className="w-5 lg:w-7 h-5 lg:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                        </svg>
                      </div>
                    </div>

                    <h3 className="text-lg lg:text-xl font-bold text-slate-800 mb-2">
                      {db.sheetName}
                    </h3>

                    <p className="text-xs lg:text-sm text-slate-600 mb-4 lg:mb-5">
                      จัดการข้อมูลหลักของระบบ
                    </p>

                    <div className="pt-4 lg:pt-5 border-t border-slate-100 mb-5">
                      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">รายละเอียด</p>
                      <p className="text-xs lg:text-sm text-slate-700 mt-2">
                        Config: <span className="font-semibold">{db.configName}</span>
                      </p>
                      <p className="text-xs lg:text-sm text-slate-700">
                        Database: <span className="font-semibold">{db.databaseId}</span>
                      </p>
                    </div>

                    {/* ✅ Action Buttons - เหมือน Modules */}
                    <div className="flex gap-2">
                      <Link
                        href={`/ERP/master-data/form?spreadsheetId=${db.spreadsheetId}&sheetName=${encodeURIComponent(db.sheetName)}&configName=${encodeURIComponent(db.configName)}&title=${encodeURIComponent(db.sheetName)}`}
                        className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-lg font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 group/btn"
                      >
                        <svg className="w-4 h-4 group-hover/btn:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        เพิ่มข้อมูล
                      </Link>

                      {canEdit() && (
                        <Link
                          href={`/ERP/master-data/edit?spreadsheetId=${db.spreadsheetId}&sheetName=${encodeURIComponent(db.sheetName)}&configName=${encodeURIComponent(db.configName)}&title=${encodeURIComponent(db.sheetName)}`}
                          className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 group/btn"
                        >
                          <svg className="w-4 h-4 group-hover/btn:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          แก้ไข/ลบ
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Empty State */}
            {!loadingMasterData && masterDatabases.length === 0 && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl lg:rounded-3xl p-8 lg:p-12 text-center">
                <svg className="w-12 lg:w-16 h-12 lg:h-16 text-indigo-300 mx-auto mb-3 lg:mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
                <p className="text-indigo-700 text-base lg:text-lg font-semibold">ยังไม่มีข้อมูลหลักที่สามารถจัดการได้</p>
                <p className="text-indigo-600 text-xs lg:text-sm mt-2">
                  กรุณาติดต่อผู้ดูแลระบบเพื่อตั้งค่า Master Data
                </p>
                <p className="text-indigo-500 text-xs mt-4">
                  💡 ตรวจสอบว่ามีข้อมูลใน sheet "client_db" และตรง client_id
                </p>
              </div>
            )}
            {/* Info Card */}
            {!loadingMasterData && masterDatabases.length > 0 && (
              <div className="mt-8 bg-indigo-50 border border-indigo-200 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-indigo-800 mb-1">
                      💡 เกี่ยวกับข้อมูลหลัก (Master Data)
                    </p>
                    <p className="text-sm text-indigo-700">
                      ข้อมูลหลักคือข้อมูลพื้นฐานที่ใช้ในการดำเนินธุรกิจ เช่น ข้อมูลสินค้า, ข้อมูลลูกค้า,
                      ข้อมูลพนักงาน, ข้อมูลโปรแกรม ซึ่งจะถูกนำไปใช้ในโมดูลต่างๆ ของระบบ ERP
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {/* Tab Content - Activity Log */}
        {activeTab === "logs" && isAdmin() && (
          <div className="animate-fadeIn">
            <div className="flex items-center justify-between mb-6 gap-3">
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-800">Activity Log</h2>
                <p className="text-slate-500 text-xs sm:text-sm mt-1">ประวัติการทำงานของทีม — ทั้งหมด {logsTotal} รายการ</p>
              </div>
              <button
                onClick={fetchActivityLogs}
                disabled={loadingLogs}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 flex-shrink-0"
              >
                <svg className={`w-4 h-4 ${loadingLogs ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="hidden sm:inline">รีเฟรช</span>
              </button>
            </div>

            {loadingLogs ? (
              <div className="space-y-3">
                {/* Skeleton stats row */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-white/90 rounded-2xl border border-rose-100 p-4 animate-pulse">
                      <div className="h-7 bg-slate-200 rounded w-1/2 mx-auto mb-1" />
                      <div className="h-3 bg-slate-100 rounded w-3/4 mx-auto" />
                    </div>
                  ))}
                </div>
                {/* Skeleton table rows */}
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="flex gap-3 bg-white/80 rounded-xl p-3 animate-pulse">
                    <div className="h-4 bg-slate-200 rounded w-28 flex-shrink-0" />
                    <div className="h-4 bg-slate-100 rounded w-40" />
                    <div className="h-4 bg-slate-200 rounded w-16" />
                    <div className="h-4 bg-slate-100 rounded flex-1" />
                  </div>
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="bg-rose-50 border border-rose-100 rounded-2xl p-12 text-center">
                <p className="text-4xl mb-3">📋</p>
                <p className="text-rose-700 font-semibold">ยังไม่มี Activity Log</p>
                <p className="text-rose-500 text-sm mt-1">จะเริ่มบันทึกเมื่อ Staff ใช้งานระบบ</p>
              </div>
            ) : (
              <>
                {/* Stats */}
                {(() => {
                  const today = new Date().toLocaleDateString("th-TH");
                  const todayLogs = logs.filter((l) => l.timestamp.startsWith(today) || l.timestamp.includes(new Date().toLocaleDateString("en-GB")));
                  const uniqueUsers = new Set(logs.map((l) => l.email)).size;
                  const uniqueActions = [...new Set(logs.map((l) => l.action))];
                  return (
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
                      <div className="bg-white/90 rounded-2xl border border-rose-100 p-3 sm:p-4 text-center">
                        <p className="text-xl sm:text-2xl font-bold text-rose-600">{logsTotal}</p>
                        <p className="text-[10px] sm:text-xs text-slate-500 mt-1">รายการทั้งหมด</p>
                      </div>
                      <div className="bg-white/90 rounded-2xl border border-rose-100 p-3 sm:p-4 text-center">
                        <p className="text-xl sm:text-2xl font-bold text-rose-600">{uniqueUsers}</p>
                        <p className="text-[10px] sm:text-xs text-slate-500 mt-1">ผู้ใช้งาน</p>
                      </div>
                      <div className="bg-white/90 rounded-2xl border border-rose-100 p-3 sm:p-4 text-center">
                        <p className="text-xl sm:text-2xl font-bold text-rose-600">{uniqueActions.length}</p>
                        <p className="text-[10px] sm:text-xs text-slate-500 mt-1">ประเภท Action</p>
                      </div>
                    </div>
                  );
                })()}

                {/* Filters */}
                <div className="flex gap-2 mb-4 flex-wrap">
                  <select
                    value={logFilterEmail}
                    onChange={(e) => setLogFilterEmail(e.target.value)}
                    className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-200"
                  >
                    <option value="">ทุกคน</option>
                    {[...new Set(logs.map((l) => l.email))].map((e) => (
                      <option key={e as string} value={e as string}>{e as string}</option>
                    ))}
                  </select>
                  <select
                    value={logFilterAction}
                    onChange={(e) => setLogFilterAction(e.target.value)}
                    className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-200"
                  >
                    <option value="">ทุก Action</option>
                    {[...new Set(logs.map((l) => l.action))].map((a) => (
                      <option key={a as string} value={a as string}>
                        {a === "submit" ? "บันทึก" : a === "update" ? "แก้ไข" : a === "upload_pdf" ? "อัป PDF" : a === "delete" ? "ลบ" : a as string}
                      </option>
                    ))}
                  </select>
                  {(logFilterEmail || logFilterAction) && (
                    <button onClick={() => { setLogFilterEmail(""); setLogFilterAction(""); }} className="text-sm text-rose-500 hover:text-rose-700 px-2">
                      ล้างตัวกรอง
                    </button>
                  )}
                </div>

                {/* Log list — card on mobile, table on desktop */}
                {(() => {
                  const actionMap: Record<string, { label: string; color: string }> = {
                    submit:     { label: "บันทึก",  color: "bg-green-100 text-green-700" },
                    update:     { label: "แก้ไข",   color: "bg-yellow-100 text-yellow-700" },
                    upload_pdf: { label: "อัป PDF", color: "bg-blue-100 text-blue-700" },
                    delete:     { label: "ลบ",      color: "bg-red-100 text-red-700" },
                  };
                  const filteredLogs = logs.filter(
                    (l) => (!logFilterEmail || l.email === logFilterEmail) && (!logFilterAction || l.action === logFilterAction)
                  );
                  const getEditUrl = (log: any) => {
                    const matchedMod = userData?.modules?.find(
                      (m: any) => m.sheetName === log.module && m.spreadsheetId === log.spreadsheetId
                    );
                    if (!matchedMod) return null;
                    const highlightValue = log.rowIndex ? log.rowIndex : "new";
                    return `/ERP/transaction/edit?moduleId=${matchedMod.moduleId}&spreadsheetId=${log.spreadsheetId}&sheetName=${encodeURIComponent(log.module)}&configName=${encodeURIComponent(matchedMod.configName)}&moduleName=${encodeURIComponent(matchedMod.moduleName)}&highlight=${highlightValue}`;
                  };

                  return (
                    <div className="bg-white/90 rounded-2xl border border-rose-100 overflow-hidden shadow-sm">

                      {/* Mobile: card list */}
                      <div className="sm:hidden divide-y divide-rose-50">
                        {filteredLogs.map((log, i) => {
                          const badge = actionMap[log.action] || { label: log.action, color: "bg-gray-100 text-gray-600" };
                          const editUrl = getEditUrl(log);
                          return (
                            <div key={i} className="p-3 space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>
                                <span className="text-[10px] text-gray-400">{log.timestamp}</span>
                              </div>
                              <p className="text-xs font-semibold text-slate-700 truncate">{log.email}</p>
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-[11px] text-slate-500 truncate">{log.module}</p>
                                  {log.detail && <p className="text-[10px] text-slate-400 truncate">{log.detail}</p>}
                                </div>
                                {editUrl && (
                                  <button
                                    onClick={() => router.push(editUrl)}
                                    className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-[11px] font-medium"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                    ดู
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop: table */}
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-rose-50 border-b border-rose-100">
                              <th className="text-left px-4 py-3 font-semibold text-rose-700 whitespace-nowrap">เวลา</th>
                              <th className="text-left px-4 py-3 font-semibold text-rose-700">ผู้ใช้</th>
                              <th className="text-left px-4 py-3 font-semibold text-rose-700">Action</th>
                              <th className="text-left px-4 py-3 font-semibold text-rose-700">Module</th>
                              <th className="text-left px-4 py-3 font-semibold text-rose-700">รายละเอียด</th>
                              <th className="px-4 py-3"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {filteredLogs.map((log, i) => {
                              const badge = actionMap[log.action] || { label: log.action, color: "bg-gray-100 text-gray-600" };
                              const editUrl = getEditUrl(log);
                              return (
                                <tr key={i} className="hover:bg-rose-50/30 transition-colors">
                                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{log.timestamp}</td>
                                  <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate text-xs" title={log.email}>{log.email}</td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>{badge.label}</span>
                                  </td>
                                  <td className="px-4 py-3 text-gray-600 text-xs">{log.module}</td>
                                  <td className="px-4 py-3 text-gray-400 text-xs">{log.detail}</td>
                                  <td className="px-4 py-3">
                                    {editUrl && (
                                      <button
                                        onClick={() => router.push(editUrl)}
                                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-xs font-medium hover:bg-rose-100 transition-colors whitespace-nowrap"
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                        ดูข้อมูล
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {/* Empty State - Modules */}
        {activeTab === "modules" && validModules.length === 0 && !error && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl lg:rounded-3xl p-8 lg:p-12 text-center">
            <svg className="w-12 lg:w-16 h-12 lg:h-16 text-blue-300 mx-auto mb-3 lg:mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-blue-700 text-base lg:text-lg font-semibold">ยังไม่มีโมดูลที่สามารถใช้งาน</p>
            <p className="text-blue-600 text-xs lg:text-sm mt-2">กรุณาติดต่อผู้ดูแลระบบเพื่อเพิ่มโมดูล</p>
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
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <style jsx>{`
        // ... existing styles
      `}</style>
    </div>
  );
}