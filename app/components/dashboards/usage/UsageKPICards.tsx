/**
 * Usage KPI Cards Component - Modern Stripe Style
 * Location: app/components/dashboards/usage/UsageKPICards.tsx
 */

import React, { useState, useMemo } from "react";
import { ConfigField, KPIData, getMetricChange, generateTransactionTableData } from "./usageUtils";

interface UsageKPICardsProps {
  kpiData: { [key: string]: KPIData };
  allData: any[];
  filteredData: any[];
  config: ConfigField[];
  selectedPeriods: string[];
}

const KPI_METRICS = [
  { key: "sum", label: "ต้นทุนรวม (บาท)", valueKey: "sum" },
  { key: "avg", label: "ต้นทุนเฉลี่ย (บาท)", valueKey: "avg" },
  { key: "max", label: "ต้นทุนสูงสุด (บาท)", valueKey: "max" },
  { key: "count", label: "จำนวนรายการ", valueKey: "count" },
];

export default function UsageKPICards({
  kpiData,
  allData,
  filteredData = [],
  config,
  selectedPeriods,
}: UsageKPICardsProps) {
  const [showTransactionDetails, setShowTransactionDetails] = useState(false);
  const [sortBy, setSortBy] = useState<string>("cust_name");

  if (Object.keys(kpiData).length === 0) {
    return null;
  }

  const safeFilteredData = filteredData && filteredData.length > 0 ? filteredData : allData;

  const costField = useMemo(() => {
    return config.find((f) => f.fieldName === "cost");
  }, [config]);

  const costKPI = kpiData["cost"];

  if (!costKPI || !costField) {
    return null;
  }

  const transactionData = useMemo(() => {
    return generateTransactionTableData(safeFilteredData, config);
  }, [safeFilteredData, config]);

  const sortedTransactionData = useMemo(() => {
    const sorted = [...transactionData];
    sorted.sort((a, b) => {
      const aVal = a[sortBy as keyof typeof a];
      const bVal = b[sortBy as keyof typeof b];
      
      if (typeof aVal === "string" && typeof bVal === "string") {
        return aVal.localeCompare(bVal, "th-TH");
      } else if (typeof aVal === "number" && typeof bVal === "number") {
        return bVal - aVal;
      }
      return 0;
    });
    return sorted;
  }, [transactionData, sortBy]);

  const { change: changePercent, icon: changeIcon } = getMetricChange(
    "cost",
    selectedPeriods[0] || "",
    allData,
    config
  );
  const shouldShowChange = selectedPeriods.length === 1 && changePercent !== null;

  return (
    <>
      {/* KPI Cards Grid - 4 Separate Cards with Accent Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 w-full">
        {KPI_METRICS.map((metric, idx) => {
          const value = costKPI[metric.valueKey as keyof KPIData];
          
          const STYLES = [
            { bar: "bg-violet-500", iconBg: "bg-violet-500", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
            { bar: "bg-rose-500", iconBg: "bg-rose-500", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> },
            { bar: "bg-emerald-500", iconBg: "bg-emerald-500", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /> },
            { bar: "bg-sky-500", iconBg: "bg-sky-500", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /> },
          ];
          const s = STYLES[idx % STYLES.length];

          return (
            <div
              key={metric.key}
              className="relative bg-white rounded-2xl p-4 lg:p-5 border border-slate-100 hover:border-slate-200 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden"
            >
              <div className={`absolute bottom-0 left-0 right-0 h-1.5 ${s.bar}`} />

              <div className="flex items-center justify-between mb-4">
                <div className={`w-9 h-9 rounded-xl ${s.iconBg} flex items-center justify-center shadow-md`}>
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {s.icon}
                  </svg>
                </div>
                {metric.key === "sum" && shouldShowChange && (
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${changePercent! > 0 ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"}`}>
                    {changeIcon} {changePercent!.toFixed(1)}%
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1 truncate">
                {metric.label}
              </p>

              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-800 truncate">
                {(value as number).toLocaleString("th-TH")}
              </p>
              <div className="h-2"></div>
            </div>
          );
        })}
      </div>

      {/* Transaction Details - Desktop Only Style (Matched with Purchase) */}
      <div className="hidden md:block mt-8 animate-fadeIn">
        <button
          onClick={() => setShowTransactionDetails(!showTransactionDetails)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
        >
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span>รายละเอียดการใช้งาน</span>
          </div>
          <svg className={`w-5 h-5 transition-transform duration-300 ${showTransactionDetails ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showTransactionDetails && (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl animate-fadeIn">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] uppercase tracking-wider text-slate-600">
                    <th className="px-4 py-4 text-left font-bold">วันที่</th>
                    <th className="px-4 py-4 text-left font-bold cursor-pointer hover:text-blue-600" onClick={() => setSortBy("cust_name")}>ชื่อลูกค้า {sortBy === "cust_name" && "▼"}</th>
                    <th className="px-4 py-4 text-left font-bold">สินค้า</th>
                    <th className="px-4 py-4 text-center font-bold cursor-pointer hover:text-blue-600" onClick={() => setSortBy("quantity")}>จำนวน {sortBy === "quantity" && "▼"}</th>
                    <th className="px-4 py-4 text-right font-bold cursor-pointer hover:text-blue-600" onClick={() => setSortBy("cost")}>ต้นทุน {sortBy === "cost" && "▼"}</th>
                    <th className="px-4 py-4 text-left font-bold">พนักงาน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedTransactionData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-4 py-4 text-slate-500 text-xs">{row.date}</td>
                      <td className="px-4 py-4 font-bold text-slate-800">{row.cust_name}</td>
                      <td className="px-4 py-4 text-slate-600">{row.product}</td>
                      <td className="px-4 py-4 text-center">
                        <span className="px-2 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-600">{row.quantity}</span>
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-slate-800">฿{row.cost.toLocaleString()}</td>
                      <td className="px-4 py-4 text-slate-500 text-xs">{row.staff}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}