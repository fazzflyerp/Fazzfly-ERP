/**
 * Purchase KPI Cards Component - Modern Stripe Style (Matched with Sales)
 * Location: app/components/dashboards/purchase/PurchaseKPICards.tsx
 */

import React, { useState, useMemo } from "react";
import { ConfigField, KPIData, getMetricChange, generatePendingItems } from "./purchaseUtils";

interface PurchaseKPICardsProps {
  kpiData: { [key: string]: KPIData };
  allData: any[];
  filteredData: any[];
  config: ConfigField[];
  selectedPeriods: string[];
}

export default function PurchaseKPICards({
  kpiData,
  allData,
  filteredData = [],
  config,
  selectedPeriods,
}: PurchaseKPICardsProps) {
  const [showPendingItems, setShowPendingItems] = useState(false);

  if (Object.keys(kpiData).length === 0) {
    return null;
  }

  const safeFilteredData = filteredData && filteredData.length > 0 ? filteredData : allData;

  // ✅ Get number fields from config dynamically
  const numberFields = useMemo(() => {
    return config
      .filter((f) => f.type === "number")
      .sort((a, b) => a.order - b.order);
  }, [config]);

  // Get pending items (Status = "รอรับของ")
  const pendingItems = useMemo(() => {
    return generatePendingItems(safeFilteredData);
  }, [safeFilteredData]);

  return (
    <>
      {/* KPI Cards Grid - ปรับเป็น 2 คอลัมน์ตามคำขอ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 lg:gap-6 w-full">
        {numberFields.map((field, idx) => {
          const kpi = kpiData[field.fieldName];
          if (!kpi) return null;

          const { change: changePercent, icon: changeIcon } = getMetricChange(
            field.fieldName,
            selectedPeriods[0] || "",
            allData,
            config
          );
          const shouldShowChange =
            selectedPeriods.length === 1 &&
            changePercent !== null;

          const STYLES = [
            { 
              bar: "bg-violet-500", 
              iconBg: "bg-violet-500", 
              accent: "text-violet-400",
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            },
            { 
              bar: "bg-rose-500", 
              iconBg: "bg-rose-500", 
              accent: "text-rose-400",
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            },
            { 
              bar: "bg-emerald-500", 
              iconBg: "bg-emerald-500", 
              accent: "text-emerald-400",
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            },
            { 
              bar: "bg-amber-500", 
              iconBg: "bg-amber-500", 
              accent: "text-amber-400",
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            },
          ];
          const s = STYLES[idx % STYLES.length];

          return (
            <div
              key={field.fieldName}
              className="relative bg-white rounded-2xl p-5 lg:p-6 border border-slate-100 hover:border-slate-200 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden"
            >
              <div className={`absolute bottom-0 left-0 right-0 h-1.5 ${s.bar}`} />

              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl ${s.iconBg} flex items-center justify-center shadow-md`}>
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {s.icon}
                  </svg>
                </div>
                {shouldShowChange && (
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${changePercent! > 0 ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"}`}>
                    {changeIcon} {changePercent!.toFixed(1)}%
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">
                {field.label}{field.fieldName === "cost" && " (บาท)"}
              </p>

              <p className="text-2xl lg:text-4xl font-bold text-slate-800 mb-4">
                {(kpi.sum as number).toLocaleString("th-TH")}
              </p>

              <div className="border-t border-slate-100 pt-4">
                <div className="space-y-2 text-xs lg:text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">เฉลี่ย</span>
                    <span className={`font-semibold ${s.accent}`}>฿{(kpi.avg as number).toLocaleString("th-TH")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">สูงสุด</span>
                    <span className="font-semibold text-slate-600">฿{(kpi.max as number).toLocaleString("th-TH")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">จำนวน</span>
                    <span className="font-semibold text-slate-600">{kpi.count}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pending Items Section (Desktop Only Style) - ปรับตามโค้ดตัวอย่างที่ให้มา */}
      <div className="hidden md:block mt-8 animate-fadeIn">
        <button
          onClick={() => setShowPendingItems(!showPendingItems)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
        >
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span>สินค้าที่รอรับ</span>
            {pendingItems.length > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-black bg-red-500 text-white animate-pulse">
                {pendingItems.length}
              </span>
            )}
          </div>
          <svg className={`w-5 h-5 transition-transform duration-300 ${showPendingItems ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showPendingItems && (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl animate-fadeIn">
            <div className="overflow-x-auto">
              {pendingItems.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] uppercase tracking-wider text-slate-600">
                      <th className="px-4 py-4 text-left font-bold">สินค้า</th>
                      <th className="px-4 py-4 text-center font-bold">รายการ</th>
                      <th className="px-4 py-4 text-center font-bold">จำนวนรวม</th>
                      <th className="px-4 py-4 text-left font-bold">ผู้ขาย (Suppliers)</th>
                      <th className="px-4 py-4 text-left font-bold">วันที่สั่ง</th>
                      <th className="px-4 py-4 text-left font-bold">กำหนดรับ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pendingItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-amber-50/30 transition-colors">
                        <td className="px-4 py-4 font-bold text-slate-800">{item.product_name}</td>
                        <td className="px-4 py-4 text-center">
                          <span className="px-2 py-1 rounded-md text-xs font-bold bg-red-50 text-red-600 border border-red-100">
                            {item.pending_count}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center font-bold text-blue-600">
                          {item.total_quantity.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{item.unit}</span>
                        </td>
                        <td className="px-4 py-4 text-slate-600 text-xs max-w-[200px] truncate">{item.suppliers}</td>
                        <td className="px-4 py-4 text-slate-400 text-xs">{item.earliest_date}</td>
                        <td className="px-4 py-4 text-slate-800 font-semibold bg-amber-50/20">{item.earliest_deliverdate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-10 text-center text-slate-400">🎉 ไม่มีสินค้าค้างรับในระบบ</div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}