/**
 * Expense KPI Cards Component - Modern Stripe Style
 * Location: app/components/dashboards/expense/ExpenseKPICards.tsx
 * ✅ Split into 4 separate cards with Accent Bar
 */

import React from "react";
import { ConfigField, KPIData, getMetricChange } from "./expenseUtils";

interface ExpenseKPICardsProps {
  kpiData: { [key: string]: KPIData };
  allData: any[];
  filteredData: any[];
  config: ConfigField[];
  selectedPeriods: string[];
}

const KPI_METRICS = [
  { key: "sum", label: "ค่าใช้จ่ายรวม (บาท)", valueKey: "sum" },
  { key: "avg", label: "ค่าใช้จ่ายเฉลี่ย (บาท)", valueKey: "avg" },
  { key: "max", label: "ค่าใช้จ่ายสูงสุด (บาท)", valueKey: "max" },
  { key: "count", label: "จำนวนรายการ", valueKey: "count" },
];

export default function ExpenseKPICards({
  kpiData,
  allData,
  filteredData = [],
  config,
  selectedPeriods,
}: ExpenseKPICardsProps) {
  if (Object.keys(kpiData).length === 0) {
    return null;
  }

  const safeFilteredData = filteredData && filteredData.length > 0 ? filteredData : allData;
  const amountKPI = kpiData["amount"];

  if (!amountKPI) {
    return null;
  }

  // Calculate change for amount field (Total)
  const { change: changePercent, icon: changeIcon } = getMetricChange(
    "amount",
    selectedPeriods[0] || "",
    allData,
    config
  );
  const shouldShowChange = selectedPeriods.length === 1 && changePercent !== null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 w-full">
      {KPI_METRICS.map((metric, idx) => {
        let value: number;
        
        if (metric.key === "count") {
          value = safeFilteredData.length;
        } else {
          value = amountKPI[metric.valueKey as keyof KPIData] as number;
        }

        // กำหนดสีและไอคอนตามหมวดหมู่ (สไตล์เดียวกับ Sales/Purchase)
        const STYLES = [
          { 
            bar: "bg-violet-500", 
            iconBg: "bg-violet-500", 
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          },
          { 
            bar: "bg-rose-500", 
            iconBg: "bg-rose-500", 
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          },
          { 
            bar: "bg-amber-500", 
            iconBg: "bg-amber-500", 
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          },
          { 
            bar: "bg-sky-500", 
            iconBg: "bg-sky-500", 
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          },
        ];
        const s = STYLES[idx % STYLES.length];

        return (
          <div
            key={metric.key}
            className="relative bg-white rounded-2xl p-4 lg:p-5 border border-slate-100 hover:border-slate-200 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden"
          >
            {/* ✅ แถบสีด้านล่าง (Accent Bar) */}
            <div className={`absolute bottom-0 left-0 right-0 h-1.5 ${s.bar}`} />

            {/* Header row */}
            <div className="flex items-center justify-between mb-4">
              <div className={`w-9 h-9 rounded-xl ${s.iconBg} flex items-center justify-center shadow-md`}>
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {s.icon}
                </svg>
              </div>
              
              {metric.key === "sum" && shouldShowChange && (
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    changePercent! > 0
                      ? "bg-red-100 text-red-600" // รายจ่ายเพิ่มเป็นสีแดง
                      : changePercent! < 0
                        ? "bg-emerald-100 text-emerald-600" // รายจ่ายลดเป็นสีเขียว
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {changeIcon} {changePercent!.toFixed(1)}%
                </span>
              )}
            </div>

            {/* Label (Original Font) */}
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1 truncate">
              {metric.label}
            </p>

            {/* Main value (Original Font) */}
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-800 truncate">
              {value.toLocaleString("th-TH", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </p>
            
            {/* Footer space to prevent bar covering text */}
            <div className="h-2"></div>
          </div>
        );
      })}
    </div>
  );
}