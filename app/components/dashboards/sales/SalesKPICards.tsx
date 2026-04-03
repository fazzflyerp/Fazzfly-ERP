/**
 * Sales KPI Cards Component - Accent Bar Style with Original Details
 * Location: app/components/dashboards/sales/SalesKPICards.tsx
 */

import React, { useState, useMemo } from "react";
import { ConfigField, KPIData, getMetricChange, getCustomerStatusCounts, generateTransactionTableData } from "./salesUtils";

interface SalesKPICardsProps {
  kpiData: { [key: string]: KPIData };
  allData: any[];
  filteredData: any[];
  config: ConfigField[];
  selectedPeriods: string[];
}

const LABELS: Record<string, string> = {
  total_sales: "ยอดขายรวม (บาท)",
  profit: "กำไร โดยประมาณ (บาท)",
  cost: "ต้นทุน โดยประมาณ (บาท)",
  count: "จำนวนรายการ",
  cust_status: "จำนวนลูกค้าที่ใช้บริการ",
};

export default function SalesKPICards({
  kpiData,
  allData,
  filteredData = [],
  config,
  selectedPeriods,
}: SalesKPICardsProps) {
  const [showProgramDetails, setShowProgramDetails] = useState(false);
  const [sortBy, setSortBy] = useState<"cust_name" | "total_sales" | "profit">("cust_name");

  if (Object.keys(kpiData).length === 0) {
    return null;
  }

  const safeFilteredData = filteredData && filteredData.length > 0 ? filteredData : allData;

  const transactionData = useMemo(() => {
    return generateTransactionTableData(safeFilteredData);
  }, [safeFilteredData]);

  const sortedTransactionData = useMemo(() => {
    const sorted = [...transactionData];
    sorted.sort((a, b) => {
      if (sortBy === "cust_name") {
        return a.cust_name.localeCompare(b.cust_name, "th-TH");
      } else if (sortBy === "total_sales") {
        return b.total_sales - a.total_sales;
      } else {
        return b.profit - a.profit;
      }
    });
    return sorted;
  }, [transactionData, sortBy]);

  return (
    <>
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 w-full">
        {[
          "total_sales",
          "cost",
          "profit",
          "count",
          "cust_status",
        ].map((fieldName, idx) => {
          let kpi = kpiData[fieldName];
          let customerNewCount = 0;
          let customerOldCount = 0;

          if (fieldName === "cust_status") {
            const status = getCustomerStatusCounts(safeFilteredData);
            customerNewCount = status.newCount;
            customerOldCount = status.oldCount;
            kpi = { sum: status.total, avg: 0, max: 0, count: status.total };
          }

          if (!kpi) return null;

          const { change: changePercent, icon: changeIcon } = getMetricChange(
            fieldName,
            selectedPeriods[0] || "",
            allData,
            config
          );
          const shouldShowChange =
            selectedPeriods.length === 1 &&
            ["total_sales", "cost", "profit", "cust_status"].includes(fieldName) &&
            changePercent !== null;

          const STYLES = [
            { bar: "bg-violet-500", iconBg: "bg-violet-500", accent: "text-violet-400", icon: <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
            { bar: "bg-rose-500", iconBg: "bg-rose-500", accent: "text-rose-400", icon: <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /> },
            { bar: "bg-emerald-500", iconBg: "bg-emerald-500", accent: "text-emerald-400", icon: <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /> },
            { bar: "bg-amber-500", iconBg: "bg-amber-500", accent: "text-amber-400", icon: <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /> },
            { bar: "bg-sky-500", iconBg: "bg-sky-500", accent: "text-sky-400", icon: <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /> },
          ];
          const s = STYLES[idx % STYLES.length];

          return (
            <div
              key={fieldName}
              className="relative bg-white rounded-2xl p-4 lg:p-5 border border-slate-100 hover:border-slate-200 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden"
            >
              {/* ✅ แถบสีด้านล่าง (Accent Bar) */}
              <div className={`absolute bottom-0 left-0 right-0 h-1.5 ${s.bar}`} />

              {/* Header row */}
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl ${s.iconBg} flex items-center justify-center shadow-md`}>
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {s.icon}
                  </svg>
                </div>
                {shouldShowChange && (
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${changePercent! > 0
                        ? "bg-emerald-100 text-emerald-600"
                        : changePercent! < 0
                          ? "bg-red-100 text-red-600"
                          : "bg-slate-100 text-slate-500"
                      }`}
                  >
                    {changeIcon} {changePercent!.toFixed(1)}%
                  </span>
                )}
              </div>

              {/* Label (Original Font) */}
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1 truncate">
                {LABELS[fieldName] || fieldName}
              </p>

              {/* Main value (Original Font) */}
              <p className="text-2xl lg:text-3xl font-bold text-slate-800 mb-4 truncate">
                {(kpi.sum as number).toLocaleString("th-TH", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </p>

              {/* Divider & Details (Original Details) */}
              <div className="border-t border-slate-100 pt-3">
                {fieldName === "cust_status" ? (
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">ใหม่</span>
                      <span className="font-semibold text-emerald-500">{customerNewCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">เก่า</span>
                      <span className="font-semibold text-sky-500">{customerOldCount}</span>
                    </div>
                    {customerNewCount + customerOldCount > 0 && (
                      <div className="flex justify-between pt-1 border-t border-slate-100">
                        <span className="text-slate-400">อัตรา</span>
                        <span className="font-semibold text-slate-600">
                          {((customerNewCount / (customerNewCount + customerOldCount)) * 100).toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">เฉลี่ย</span>
                      <span className={`font-semibold ${s.accent}`}>
                        ฿{(kpi.avg as number).toLocaleString("th-TH", { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">สูงสุด</span>
                      <span className="font-semibold text-slate-600">
                        ฿{(kpi.max as number).toLocaleString("th-TH", { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">จำนวน</span>
                      <span className="font-semibold text-slate-600">{kpi.count}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

{/* Transaction Table Section (Desktop Only) */}
      <div className="hidden md:block mt-8 animate-fadeIn">
        <button
          onClick={() => setShowProgramDetails(!showProgramDetails)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
        >
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span>รายละเอียดรายการขาย</span>
          </div>
          <svg className={`w-5 h-5 transition-transform duration-300 ${showProgramDetails ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showProgramDetails && (
          <div className="hidden md:block mt-3 md:mt-4 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs lg:text-sm">
              <thead>
                <tr className="border-b-2 border-slate-300 bg-slate-50">
                  <th className="px-2 lg:px-4 py-2 lg:py-3 text-left font-bold text-slate-700 whitespace-nowrap">วันที่</th>
                  <th className="px-2 lg:px-4 py-2 lg:py-3 text-left font-bold text-slate-700 cursor-pointer hover:bg-slate-100 whitespace-nowrap" onClick={() => setSortBy("cust_name")}>ชื่อลูกค้า {sortBy === "cust_name" && "▼"}</th>
                  <th className="px-2 lg:px-4 py-2 lg:py-3 text-left font-bold text-slate-700">โปรแกรม</th>
                  <th className="px-2 lg:px-4 py-2 lg:py-3 text-center font-bold text-slate-700 whitespace-nowrap">จำนวน</th>
                  <th className="px-2 lg:px-4 py-2 lg:py-3 text-right font-bold text-slate-700 whitespace-nowrap">ยอดขาย</th>
                  <th className="px-2 lg:px-4 py-2 lg:py-3 text-right font-bold text-slate-700 whitespace-nowrap">ต้นทุน</th>
                  <th className="px-2 lg:px-4 py-2 lg:py-3 text-right font-bold text-slate-700 whitespace-nowrap">กำไร</th>
                </tr>
              </thead>
              <tbody>
                {sortedTransactionData.map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-2 lg:px-4 py-2 lg:py-3 text-slate-700 text-xs whitespace-nowrap">{row.date}</td>
                    <td className="px-2 lg:px-4 py-2 lg:py-3 font-semibold text-slate-800 max-w-xs truncate">{row.cust_name}</td>
                    <td className="px-2 lg:px-4 py-2 lg:py-3 text-slate-700 truncate">{row.program}</td>
                    <td className="px-2 lg:px-4 py-2 lg:py-3 text-center text-slate-700">
                      <span className="inline-flex items-center px-1.5 lg:px-2 py-0.5 lg:py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 whitespace-nowrap">{row.quantity}</span>
                    </td>
                    <td className="px-2 lg:px-4 py-2 lg:py-3 text-right font-semibold text-slate-800 text-xs lg:text-sm whitespace-nowrap">฿{row.total_sales.toLocaleString()}</td>
                    <td className="px-2 lg:px-4 py-2 lg:py-3 text-right font-semibold text-slate-800 text-xs lg:text-sm whitespace-nowrap">฿{row.cost.toLocaleString()}</td>
                    <td className="px-2 lg:px-4 py-2 lg:py-3 text-right font-semibold text-green-600 text-xs lg:text-sm whitespace-nowrap">฿{row.profit.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}