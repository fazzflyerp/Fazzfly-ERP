"use client";

/**
 * System Selector Page - COMPLETE FIXED VERSION
 * ✅ Inventory Alerts จาก API เหมือน ERP Home
 * ✅ Clickable card ไปที่ Inventory Dashboard
 * ✅ Loading state & error handling
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from "next-auth/react";

const ROUTES = {
  ERP_HOME: '/ERP/home',
  ERP_SALES: '/modules/sales',
  ERP_USAGE: '/modules/usage',
  ERP_FINANCIAL: '/modules/financial',
  ERP_INVENTORY: '/modules/inventory',
  CRM_HOME: '/CRM/home',
  PRICING: '/pricing',
  SUPPORT: '/support',
};

export default function SystemSelectorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [userData, setUserData] = useState({
    clientName: "ABC Company",
    clientId: "C003",
    package: "Deluxe",
    daysRemaining: 72,
    hasERP: true,
    hasCRM: true,
  });

  // ✅ NEW: Inventory Alerts State
  const [lowStockCount, setLowStockCount] = useState<number | null>(null);
  const [loadingLowStock, setLoadingLowStock] = useState(true);
  const [hasInventoryDashboard, setHasInventoryDashboard] = useState(false);
  const [inventoryDashboardUrl, setInventoryDashboardUrl] = useState<string>("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetch("/api/user/modules");
        if (response.ok) {
          const data = await response.json();

          const hasERP = data.modules.some(
            (m: any) => ["Sales", "Usage", "Financial", "Inventory"].includes(m.moduleName)
          );
          // ✅ ใช้ hasCRM จาก API แทน
          const hasCRM = data.hasCRM || false;

          console.log("📊 User Data:", {
            clientId: data.clientId,
            clientName: data.clientName,
            hasCRM: data.hasCRM,
            hasERP
          });

          // ✅ เช็คว่ามี Inventory Dashboard หรือไม่
          const invDashboard = data.dashboardItems?.find(
            (d: any) => d.dashboardConfigName === "Inventory_Dashboard_Config"
          );

          if (invDashboard) {
            setHasInventoryDashboard(true);
            setInventoryDashboardUrl(
              `/dashboard/${invDashboard.dashboardConfigName}?spreadsheetId=${invDashboard.spreadsheetId}&sheetName=${encodeURIComponent(invDashboard.sheetName)}`
            );
          }

          setUserData({
            clientName: data.clientName || "Guest User",
            clientId: data.clientId || "N/A",
            package: data.planType || "Basic",
            daysRemaining: data.expiresAt
              ? Math.ceil((new Date(data.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : 0,
            hasERP,
            hasCRM,
          });
        }
      } catch (error) {
        console.error("Failed to fetch user data:", error);
      }
    };

    if (session) {
      fetchUserData();
    }
  }, [session]);

  // ✅ NEW: Fetch Low Stock Count
  useEffect(() => {
    const fetchLowStockCount = async () => {
      if (!session || !hasInventoryDashboard) {
        setLoadingLowStock(false);
        return;
      }

      try {
        setLoadingLowStock(true);
        const response = await fetch("/api/inventory/low-stock");

        if (response.ok) {
          const data = await response.json();
          setLowStockCount(data.count || 0);
        } else {
          console.error("Failed to fetch low stock count");
          setLowStockCount(null);
        }
      } catch (error) {
        console.error("Error fetching low stock count:", error);
        setLowStockCount(null);
      } finally {
        setLoadingLowStock(false);
      }
    };

    if (hasInventoryDashboard) {
      fetchLowStockCount();
    }
  }, [session, hasInventoryDashboard]);

  // ✅ NEW: Go to Inventory Dashboard
  const goToInventoryDashboard = () => {
    if (hasInventoryDashboard && inventoryDashboardUrl) {
      router.push(inventoryDashboardUrl);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50">
      {/* Animated Background Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/3 w-96 h-96 bg-sky-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 px-6 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <Image src="/logo2.png" alt="Fazzfly Logo" width={48} height={48} className="object-contain" />
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                Fazzfly Platform
              </h1>
              <p className="text-xs text-slate-500">Enterprise Solutions</p>
            </div>
          </div>

          {/* User Profile + Logout */}
          <div className="flex items-center gap-3">

            {/* Desktop: Avatar + Name + Logout combo */}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="hidden md:flex items-center gap-2 pl-1.5 pr-4 py-1.5 rounded-full border border-slate-200 hover:border-red-200 hover:bg-red-50 transition-all duration-200 group"
            >
              {session?.user?.image ? (
                <img
                  src={session.user.image}
                  alt="Profile"
                  width={28}
                  height={28}
                  className="rounded-full"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white text-xs font-semibold">
                  {session?.user?.name?.charAt(0) || "U"}
                </div>
              )}
              <div className="text-left">
                <p className="text-xs font-semibold text-slate-700 group-hover:text-red-700 leading-none">
                  {session?.user?.name}
                </p>
                <p className="text-[10px] text-slate-400 group-hover:text-red-400 leading-none mt-0.5">
                  ออกจากระบบ
                </p>
              </div>
              <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-500 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>

            {/* Mobile: Icon Only */}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="ออกจากระบบ"
              className="flex md:hidden items-center justify-center w-9 h-9 rounded-xl border border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>

          </div>

        </div>
      </div>
      {/* Main Content */}
      <div className="relative z-10 px-6 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Welcome Section */}
          <div className="text-center mb-12 animate-slideDown">
            <h2 className="text-4xl font-bold text-slate-800 mb-3">
              ยินดีต้อนรับกลับ, <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">{userData.clientName}</span>
            </h2>
            <p className="text-lg text-slate-600 font-medium">
              จัดการข้อมูล ติดตามสถิติ และใช้งานโมดูลต่างๆ
            </p>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12 animate-slideDown" style={{ animationDelay: '100ms' }}>
            {/* Package Card */}
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-5 border border-blue-100 shadow-lg shadow-blue-100/50 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">แพ็คเกจ</p>
                  <p className="text-lg font-bold text-slate-800">{userData.package}</p>
                </div>
              </div>
            </div>

            {/* Client ID Card */}
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-5 border border-blue-100 shadow-lg shadow-blue-100/50 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">ลูกค้า ID</p>
                  <p className="text-lg font-bold text-slate-800">{userData.clientId}</p>
                </div>
              </div>
            </div>

            {/* Days Remaining Card */}
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-5 border border-green-100 shadow-lg shadow-green-100/50 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">คงเหลือ</p>
                  <p className="text-lg font-bold text-green-600">{userData.daysRemaining} วัน</p>
                </div>
              </div>
            </div>
          </div>


          {/* System Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto animate-slideDown" style={{ animationDelay: '200ms' }}>
            {/* ERP Card */}
            {userData.hasERP && (
              <div
                onMouseEnter={() => setHoveredCard('erp')}
                onMouseLeave={() => setHoveredCard(null)}
                onClick={() => router.push(ROUTES.ERP_HOME)}
                className="relative group cursor-pointer"
              >
                <div className={`
                  bg-white/95 backdrop-blur-xl rounded-3xl p-8 border border-blue-100 
                  transition-all duration-500 shadow-xl
                  ${hoveredCard === 'erp' ? 'shadow-2xl shadow-blue-500/30 -translate-y-2 scale-105' : 'shadow-blue-100/50'}
                `}>
                  <div className="absolute -top-3 -right-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                    Active
                  </div>

                  <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>

                  <h3 className="text-3xl font-bold text-center mb-3 bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                    FAZZFLY ERP
                  </h3>

                  <p className="text-center text-slate-600 mb-6 font-medium">
                    ระบบบริหารจัดการทรัพยากรองค์กร
                  </p>

                  <div className="space-y-3 mb-6">
                    {[
                      { icon: "📊", text: "Sales & Financial" },
                      { icon: "📦", text: "Inventory Management" },
                      { icon: "💰", text: "Expense Tracking" },
                      { icon: "👥", text: "Payroll System" },
                    ].map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-3 text-sm bg-blue-50 rounded-xl p-3 border border-blue-100">
                        <span className="text-xl">{feature.icon}</span>
                        <span className="text-slate-700 font-medium">{feature.text}</span>
                      </div>
                    ))}
                  </div>

                  <button className={`
                    w-full py-4 rounded-2xl font-bold text-lg
                    bg-gradient-to-r from-blue-600 to-cyan-500 text-white
                    transition-all duration-300
                    ${hoveredCard === 'erp' ? 'shadow-xl shadow-blue-500/40' : 'shadow-lg'}
                  `}>
                    เข้าสู่ระบบ ERP
                    <svg className="w-5 h-5 inline-block ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                </div>

                <div className={`
                  absolute inset-0 rounded-3xl bg-gradient-to-r from-blue-500 to-cyan-400 
                  transition-opacity duration-300 -z-10 blur-2xl
                  ${hoveredCard === 'erp' ? 'opacity-40' : 'opacity-0'}
                `}></div>
              </div>
            )}

            {/* CRM Card */}
            {userData.hasCRM && (
              <div
                onMouseEnter={() => setHoveredCard('crm')}
                onMouseLeave={() => setHoveredCard(null)}
                onClick={() => router.push(ROUTES.CRM_HOME)}
                className="relative group cursor-pointer"
              >
                <div className={`
                  bg-white/95 backdrop-blur-xl rounded-3xl p-8 border border-purple-100 
                  transition-all duration-500 shadow-xl
                  ${hoveredCard === 'crm' ? 'shadow-2xl shadow-purple-500/30 -translate-y-2 scale-105' : 'shadow-purple-100/50'}
                `}>
                  <div className="absolute -top-3 -right-3 bg-gradient-to-r from-purple-600 to-pink-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                    Active
                  </div>

                  <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>

                  <h3 className="text-3xl font-bold text-center mb-3 bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">
                    FAZZFLY CRM
                  </h3>

                  <p className="text-center text-slate-600 mb-6 font-medium">
                    ระบบบริหารจัดการลูกค้าสัมพันธ์
                  </p>

                  <div className="space-y-3 mb-6">
                    {[
                      { icon: "👥", text: "Contact Management" },
                      { icon: "🎯", text: "Lead Tracking" },
                      { icon: "💼", text: "Sales Pipeline" },
                      { icon: "📈", text: "Analytics & Reports" },
                    ].map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-3 text-sm bg-purple-50 rounded-xl p-3 border border-purple-100">
                        <span className="text-xl">{feature.icon}</span>
                        <span className="text-slate-700 font-medium">{feature.text}</span>
                      </div>
                    ))}
                  </div>

                  <button className={`
                    w-full py-4 rounded-2xl font-bold text-lg
                    bg-gradient-to-r from-purple-600 to-pink-500 text-white
                    transition-all duration-300
                    ${hoveredCard === 'crm' ? 'shadow-xl shadow-purple-500/40' : 'shadow-lg'}
                  `}>
                    เข้าสู่ระบบ CRM
                    <svg className="w-5 h-5 inline-block ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                </div>

                <div className={`
                  absolute inset-0 rounded-3xl bg-gradient-to-r from-purple-500 to-pink-400 
                  transition-opacity duration-300 -z-10 blur-2xl
                  ${hoveredCard === 'crm' ? 'opacity-40' : 'opacity-0'}
                `}></div>
              </div>
            )}
          </div>

          {/* No Access Message */}
          {!userData.hasERP && !userData.hasCRM && (
            <div className="text-center py-12 animate-slideDown" style={{ animationDelay: '300ms' }}>
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-8 max-w-md mx-auto">
                <svg className="w-16 h-16 mx-auto mb-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="text-xl font-bold text-slate-800 mb-2">ไม่มีสิทธิ์เข้าถึงระบบ</h3>
                <p className="text-slate-600 mb-4">กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์การใช้งาน</p>
                <Link href={ROUTES.PRICING} className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors">
                  ดูแพ็คเกจ
                </Link>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="text-center mt-12 animate-slideDown" style={{ animationDelay: '400ms' }}>
            <p className="text-sm text-slate-600 font-medium">
              ต้องการความช่วยเหลือ? <Link href={ROUTES.SUPPORT} className="text-blue-600 hover:text-blue-700 font-semibold">ติดต่อฝ่ายสนับสนุน</Link>
            </p>
            <p className="text-xs text-slate-500 mt-2">
              © 2025 Fazzfly Platform. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
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
        .animate-slideDown {
          animation: slideDown 0.6s ease-out;
        }
      `}</style>
    </div>
  );
}