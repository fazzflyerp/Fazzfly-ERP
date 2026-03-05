//FILE: app/ERP/home/page.tsx
"use client";
import Image from 'next/image';
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
// ✅ Import new dashboard components
import SalesDashboard from "@/app/components/dashboards/sales/SalesDashboard";
import UsageDashboard from "@/app/components/dashboards/usage/UsageDashboard";
import PurchaseDashboard from "@/app/components/dashboards/purchase/PurchaseDashboard";
import ExpenseDashboard from "@/app/components/dashboards/expense/ExpenseDashboard";
import InventoryDashboard from "@/app/components/dashboards/inventory/InventoryDashboard";
import PayrollDashboard from "@/app/components/dashboards/payroll/PayrollDashboard";
import FinancialDashboard from "@/app/components/dashboards/financial/FinancialDashboard";

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

if (typeof window !== 'undefined') {
  console.log("🔍 [Debug] MASTER_CONFIG_ID:", MASTER_CONFIG_ID ? `${MASTER_CONFIG_ID.substring(0, 20)}...` : "❌ NOT SET");
  console.log("🔍 [Debug] From env?", !!process.env.NEXT_PUBLIC_MASTER_CONFIG_ID);
  console.log("🔍 [Debug] All NEXT_PUBLIC vars:", Object.keys(process.env).filter(k => k.startsWith('NEXT_PUBLIC')));
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"modules" | "dashboard" | "documents" | "masterdata">("modules");
  // ✅ เพิ่มโค้ดนี้
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam) {
      console.log("🔍 Opening tab from URL:", tabParam);
      setActiveTab(tabParam as any);
    }
  }, [searchParams]);
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
  const [loadingLowStock, setLoadingLowStock] = useState(false);
  const [hasInventoryDashboard, setHasInventoryDashboard] = useState(false);

  // ✅ NEW: User Documents states
  const [userDocuments, setUserDocuments] = useState<Module[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);



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

  const fetchArchiveFolderIdFromAPI = async (clientId: string, moduleName: string) => {
    try {
      console.log("🔄 [fetchArchiveFolderIdFromAPI] Start");
      console.log(`   clientId: ${clientId}, moduleName: ${moduleName}`);

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

      console.log(`   Response Status: ${res.status}`);

      if (res.status === 404) {
        console.log("ℹ️ No archive folder configured for this client/module");
        setArchiveFolderId(null);
        return null;
      }

      if (!res.ok) {
        console.log(`ℹ️ Could not fetch archive folder (HTTP ${res.status})`);
        setArchiveFolderId(null);
        return null;
      }

      const data = await res.json();

      if (!data.archiveFolderId) {
        console.log("ℹ️ Archive folder ID is empty");
        setArchiveFolderId(null);
        return null;
      }

      console.log("✅ archiveFolderId fetched:", data.archiveFolderId);
      setArchiveFolderId(data.archiveFolderId);
      return data.archiveFolderId;
    } catch (error: any) {
      console.log("ℹ️ Archive folder fetch skipped:", error.message);
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
        console.log("ℹ️ No Inventory Dashboard found");
        setHasInventoryDashboard(false);
        setLowStockCount(0);
        return;
      }

      setHasInventoryDashboard(true);

      const accessToken = (session as any)?.accessToken;
      if (!accessToken) {
        console.error("❌ No access token");
        return;
      }

      // Fetch data from Inventory sheet
      const params = new URLSearchParams({
        spreadsheetId: inventoryDash.spreadsheetId,
        configSheetName: inventoryDash.dashboardConfigName,
        dataSheetName: inventoryDash.sheetName,
      });

      const response = await fetch(`/api/dashboard/data?${params}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.error("❌ Failed to fetch inventory data");
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
        console.log("ℹ️ No status field found in config");
        setLowStockCount(0);
        return;
      }

      // Count items with "สต๊อกต่ำ" or "ใกล้หมด"
      const lowStockStatuses = ["สต๊อกต่ำ", "ใกล้หมด"];
      const count = data.data.filter((row: any) => {
        const status = String(row[statusField.fieldName] || "").trim();
        return lowStockStatuses.includes(status);
      }).length;

      console.log(`✅ Low stock count: ${count}`);
      setLowStockCount(count);

    } catch (error) {
      console.error("❌ Error fetching low stock:", error);
      setLowStockCount(0);
    } finally {
      setLoadingLowStock(false);
    }
  };

  // ✅ NEW: Fetch user documents from API
  const fetchUserDocuments = async () => {
    try {
      console.log("📄 Fetching user documents...");
      setLoadingDocuments(true);

      const accessToken = (session as any)?.accessToken;
      if (!accessToken) {
        console.error("❌ No access token for documents");
        setUserDocuments([]);
        return;
      }

      // ✅ Get clientId from userData
      if (!userData?.clientId) {
        console.error("❌ No clientId in userData");
        setUserDocuments([]);
        return;
      }

      console.log("🔑 Access token available, calling API...");
      console.log("👤 Client ID:", userData.clientId);

      // ✅ Pass clientId as query parameter
      const response = await fetch(`/api/user/documents?clientId=${userData.clientId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      console.log(`📡 API Response status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("❌ Failed to fetch user documents");
        console.error("Error details:", errorData);
        console.error("Status:", response.status, response.statusText);
        setUserDocuments([]);
        return;
      }

      const data = await response.json();
      console.log("✅ User documents loaded:", data);
      console.log("📊 Document count:", data.count);
      console.log("📋 Documents:", data.documents);

      // Transform API response to Module format
      const documents: Module[] = data.documents.map((doc: any) => ({
        moduleId: doc.moduleId,
        moduleName: doc.moduleName,
        spreadsheetId: doc.spreadsheetId,
        sheetName: doc.sheetName,
        configName: doc.configName || "",
        notes: doc.notes,
      }));

      console.log("✅ Transformed documents:", documents);
      setUserDocuments(documents);

    } catch (error: any) {
      console.error("❌ Error fetching user documents:", error);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      setUserDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  };

  // ✅ NEW: Fetch master databases
  const fetchMasterDatabases = async () => {
    try {
      console.log("📊 Fetching master databases...");
      setLoadingMasterData(true);

      const accessToken = (session as any)?.accessToken;
      if (!accessToken) {
        console.error("❌ No access token for master data");
        setMasterDatabases([]);
        setHasMasterDataAccess(false);
        return;
      }

      const response = await fetch("/api/master/databases", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      console.log(`📡 Master Data API Response status: ${response.status}`);

      if (!response.ok) {
        console.log("ℹ️ No master data access");
        setMasterDatabases([]);
        setHasMasterDataAccess(false);
        return;
      }

      const data = await response.json();
      console.log("✅ Master databases loaded:", data);

      if (data.totalDatabases > 0) {
        setMasterDatabases(data.databases || []);
        setHasMasterDataAccess(true);
      } else {
        setMasterDatabases([]);
        setHasMasterDataAccess(false);
      }

    } catch (error: any) {
      console.error("❌ Error fetching master databases:", error);
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

  // ✅ NEW: useEffect: Fetch user documents when tab is documents
  useEffect(() => {
    if (userData && activeTab === "documents") {
      fetchUserDocuments();
    }
  }, [userData, activeTab]);

  // ✅ NEW: useEffect: Fetch master databases when tab is masterdata
  useEffect(() => {
    if (userData && activeTab === "masterdata") {
      fetchMasterDatabases();
    }
  }, [userData, activeTab]);

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
        console.log(`🔄 Loading config for module: ${moduleName}`);
        setLoadingModuleConfigs(true);
        setArchiveFolderId(null);

        fetchModuleConfig(moduleName).then((config) => {
          if (config) {
            console.log("✅ Module config fetched:", config);
            setModuleConfigs(prev => ({
              ...prev,
              [moduleName]: config,
            }));

            if (config.archiveFolderId) {
              console.log("✅ archiveFolderId found in config:", config.archiveFolderId);
              setArchiveFolderId(config.archiveFolderId);
              setLoadingModuleConfigs(false);
            } else {
              console.log("⚠️ archiveFolderId not in config, trying API...");
              fetchArchiveFolderIdFromAPI(userData.clientId, moduleName).then((folderId) => {
                if (!folderId) {
                  console.log("ℹ️ No archive folder ID - Dashboard will work without year filter");
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
    useEffect(() => {
      const timer = setTimeout(() => {
        router.push("/login");
      }, 3000);
      return () => clearTimeout(timer);
    }, [router]);

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

  const daysLeft = userData ? getDaysUntilExpiry(userData.expiresAt) : -1;
  const isExpiringSoon = daysLeft >= 0 && daysLeft <= 5;

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50 pb-20 lg:pb-0"
      style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
    >
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
            <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              {userData?.clientName}
            </span>
          </h1>
          <p className="text-base lg:text-lg text-slate-600">
            จัดการข้อมูล ติดตามสถิติ และใช้งานโมดูลต่างๆ
          </p>
        </div>

        {/* Account Status Card with Low Stock Alert */}
        {userData && (
          <div className={`rounded-2xl lg:rounded-3xl p-4 lg:p-8 mb-6 lg:mb-10 border backdrop-blur-md transition-all duration-300 ${isExpiringSoon
            ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300 shadow-lg shadow-yellow-100'
            : 'bg-gradient-to-r from-blue-50 via-sky-50 to-cyan-50 border-blue-200 shadow-lg shadow-blue-100/50'
            }`}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
              {/* 1. แพ็คเจจ */}
              <div className="p-3 lg:p-4 rounded-xl lg:rounded-2xl bg-white/60 backdrop-blur-sm border border-blue-100">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1 lg:mb-2">แพ็คเจจ</p>
                <p className="text-xl lg:text-2xl font-bold text-slate-800 truncate">{userData.planType}</p>
              </div>

              {/* 2. ลูกค้า ID */}
              <div className="p-3 lg:p-4 rounded-xl lg:rounded-2xl bg-white/60 backdrop-blur-sm border border-blue-100">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1 lg:mb-2">ลูกค้า ID</p>
                <p className="text-xl lg:text-2xl font-bold text-blue-600 truncate">{userData.clientId}</p>
              </div>

              {/* 3. แจ้งเตือนสินค้าใกล้หมด - CLICKABLE */}
              <div
                onClick={hasInventoryDashboard && lowStockCount && lowStockCount > 0 ? goToInventoryDashboard : undefined}
                className={`p-3 lg:p-4 rounded-xl lg:rounded-2xl backdrop-blur-sm border transition-all ${loadingLowStock
                  ? 'bg-slate-100/50 border-slate-300 cursor-wait'
                  : lowStockCount && lowStockCount > 0
                    ? 'bg-orange-100/50 border-orange-300 cursor-pointer hover:bg-orange-200/50 hover:shadow-lg hover:-translate-y-1 active:scale-95'
                    : 'bg-green-100/50 border-green-300 cursor-default'
                  }`}
              >
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1 lg:mb-2">
                  แจ้งเตือนสินค้า
                </p>

                {loadingLowStock ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-600"></div>
                    <p className="text-sm text-slate-600">กำลังโหลด...</p>
                  </div>
                ) : (
                  <>
                    {!hasInventoryDashboard ? (
                      <div>
                        <p className="text-base lg:text-lg font-bold text-slate-600">
                          ไม่มี Inventory Dashboard
                        </p>
                      </div>
                    ) : lowStockCount === null || lowStockCount === 0 ? (
                      <div>
                        <p className="text-base lg:text-lg font-bold text-green-700">
                          ไม่มีสินค้าใกล้หมด
                        </p>
                        <p className="text-xs text-green-600 mt-1">
                          สต๊อกปกติ ✓
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xl lg:text-2xl font-bold text-orange-700">
                          {lowStockCount} รายการ
                        </p>
                        <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                          คลิกเพื่อดู
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* 4. คงเหลือ */}
              <div className={`p-3 lg:p-4 rounded-xl lg:rounded-2xl backdrop-blur-sm border ${isExpiringSoon
                ? 'bg-yellow-100/50 border-yellow-300'
                : 'bg-green-100/50 border-green-300'
                }`}>
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1 lg:mb-2">คงเหลือ</p>
                <p className={`text-xl lg:text-2xl font-bold ${isExpiringSoon ? 'text-yellow-700' : 'text-green-700'}`}>
                  {daysLeft >= 0 ? daysLeft : 0} วัน
                </p>
              </div>
            </div>

            {userData.expiryWarning && (
              <div className="mt-4 lg:mt-6 pt-4 lg:pt-6 border-t border-yellow-200">
                <p className="text-xs lg:text-sm text-yellow-800 font-medium">
                  ⚠️ {userData.expiryWarning}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab Navigation - Mobile Optimized */}
        <div className="flex gap-2 mb-6 lg:mb-8 overflow-x-auto scrollbar-hide bg-white/50 backdrop-blur-md rounded-xl lg:rounded-2xl p-2 border border-blue-100/50">
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
          {(hasMasterDataAccess || true) && (
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
          )}

        </div>

        {/* Tab Content - Modules */}
        {activeTab === "modules" && validModules.length > 0 && (
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

                    <Link
                      href={`/ERP/transaction/edit?moduleId=${module.moduleId}&spreadsheetId=${module.spreadsheetId}&sheetName=${module.sheetName}&configName=${module.configName}&moduleName=${encodeURIComponent(module.moduleName)}`}
                      className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 group/btn"
                    >
                      <svg className="w-4 h-4 group-hover/btn:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      แก้ไข/ลบ
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Content - Dashboard */}
        {activeTab === "dashboard" && (
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
                  <div className="bg-white/90 backdrop-blur-xl rounded-2xl lg:rounded-3xl shadow-lg p-4 lg:p-8 border border-purple-100/50 animate-fadeIn">
                    <div className="flex items-center justify-between mb-6 lg:mb-8">
                      <h3 className="text-xl lg:text-2xl font-bold text-slate-800">
                        {selectedDashboard.dashboardName}
                      </h3>
                    </div>

                    {/* Loading state */}
                    {(loadingModuleConfigs || loadingArchiveFolderId) && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 lg:p-6 flex items-center gap-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600 flex-shrink-0"></div>
                        <p className="text-purple-700 font-medium text-sm lg:text-base">
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

            {/* Loading State */}
            {loadingDocuments && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 lg:p-12 text-center mb-6">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                  <p className="text-emerald-700 font-semibold text-lg">กำลังโหลดรายการเอกสาร...</p>
                </div>
                <p className="text-emerald-600 text-sm">
                  กรุณารอสักครู่ ระบบกำลังดึงข้อมูลจาก Google Sheets
                </p>
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

                    if (moduleName.includes("payroll") || moduleName.includes("สลิป") || moduleName.includes("payslip") || moduleName.includes("เงินเดือน")) {
                      docUrl = `/ERP/payroll-slip?moduleId=${doc.moduleId}&spreadsheetId=${doc.spreadsheetId}`;
                    } else if (moduleName.includes("receipt") || moduleName.includes("ใบเสร็จ")) {
                      docUrl = `/ERP/receipt-simple?moduleId=${doc.moduleId}&spreadsheetId=${doc.spreadsheetId}`;
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
            <h2 className="text-2xl lg:text-3xl font-bold text-slate-800 mb-4 lg:mb-8">
              ข้อมูลหลัก (Master Data) <span className="text-indigo-600">({masterDatabases.length})</span>
            </h2>

            {/* Loading State */}
            {loadingMasterData && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-8 lg:p-12 text-center mb-6">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  <p className="text-indigo-700 font-semibold text-lg">กำลังโหลดรายการข้อมูลหลัก...</p>
                </div>
                <p className="text-indigo-600 text-sm">
                  กรุณารอสักครู่ ระบบกำลังดึงข้อมูลจาก Google Sheets
                </p>
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

                      <Link
                        href={`/ERP/master-data/edit?spreadsheetId=${db.spreadsheetId}&sheetName=${encodeURIComponent(db.sheetName)}&configName=${encodeURIComponent(db.configName)}&title=${encodeURIComponent(db.sheetName)}`}
                        className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 group/btn"
                      >
                        <svg className="w-4 h-4 group-hover/btn:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        แก้ไข/ลบ
                      </Link>
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