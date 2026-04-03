/**
 * Financial KPI Cards Component - Modern Stripe Style
 * Location: app/components/dashboards/financial/FinancialKPICards.tsx
 * ✅ Displays: 6 KPI cards in 2 rows with Accent Bar and SVG Icons
 */

"use client";

import React from "react";
import { ConfigField, KPIData, getMetricChange } from "@/app/components/dashboards/financial/financialUtils";

interface FinancialKPICardsProps {
  kpiData: { [key: string]: KPIData };
  allData: any[];
  filteredData: any[];
  config: ConfigField[];
  selectedPeriods: string[];
}

const LABELS: Record<string, { label: string; icon: React.ReactNode; barColor: string }> = {
  total_sales: { 
    label: "รายได้รวม", 
    barColor: "bg-emerald-500",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  },
  cost: { 
    label: "ต้นทุนรวม", 
    barColor: "bg-rose-500",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  },
  profit: { 
    label: "กำไรขั้นต้น", 
    barColor: "bg-blue-500",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  },
  expense: { 
    label: "ค่าใช้จ่ายรวม", 
    barColor: "bg-orange-500",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
  },
  net_profit: { 
    label: "กำไรสุทธิ", 
    barColor: "bg-purple-500",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
  },
  percent_net_profit: { 
    label: "% กำไรสุทธิ", 
    barColor: "bg-sky-500",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  },
};

export default function FinancialKPICards({
  kpiData,
  allData,
  filteredData,
  config,
  selectedPeriods,
}: FinancialKPICardsProps) {
  
  const CARD_ORDER = [
    "total_sales",
    "cost",
    "profit",
    "expense",
    "net_profit",
    "percent_net_profit",
  ];

  const formatNumber = (num: number, isPercent: boolean = false): string => {
    if (isPercent) {
      return `${num.toFixed(2)}%`;
    }
    return new Intl.NumberFormat("th-TH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num) + " ฿";
  };

  const renderCard = (fieldName: string) => {
    const data = kpiData[fieldName];
    const info = LABELS[fieldName];
    if (!data || !info) return null;

    const isPercent = fieldName.includes("percent");
    const currentPeriod = selectedPeriods.length === 1 ? selectedPeriods[0] : "";
    const { change, icon } = getMetricChange(fieldName, currentPeriod, allData, config);

    // สีตัวบ่งชี้การเปลี่ยนแปลง (รายจ่าย/ต้นทุน เพิ่ม = แดง, รายได้/กำไร เพิ่ม = เขียว)
    const isCostOrExpense = fieldName === "cost" || fieldName === "expense";
    const changeColor = change !== null
      ? isCostOrExpense
        ? (change > 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600")
        : (change > 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")
      : "bg-slate-50 text-slate-500";

    return (
      <div
        key={fieldName}
        className="relative bg-white rounded-2xl p-4 lg:p-5 border border-slate-100 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between min-h-[160px]"
      >
        {/* ✅ แถบสีด้านล่าง (Accent Bar) */}
        <div className={`absolute bottom-0 left-0 right-0 h-1.5 ${info.barColor}`} />

        <div>
          <div className="flex items-center justify-between mb-4">
            <div className={`w-10 h-10 rounded-xl ${info.barColor} text-white flex items-center justify-center shadow-md`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {info.icon}
              </svg>
            </div>
            {change !== null && (
              <span className={`text-[10px] lg:text-xs font-bold px-2.5 py-1 rounded-md flex items-center gap-0.5 ${changeColor}`}>
                {icon} {Math.abs(change).toFixed(1)}%
              </span>
            )}
          </div>

          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1 truncate">
            {info.label}
          </p>

          <p className="text-xl lg:text-3xl font-bold text-slate-800 tracking-tight">
            {formatNumber(data.sum, isPercent)}
          </p>
        </div>

        {/* Original Details */}
        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-50 text-[10px] lg:text-xs">
          <div>
            <span className="text-slate-400 block">เฉลี่ย</span>
            <span className="font-semibold text-slate-700">{formatNumber(data.avg, isPercent)}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-400 block">สูงสุด</span>
            <span className="font-semibold text-slate-700">{formatNumber(data.max, isPercent)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Row 1: รายได้, ต้นทุน, กำไรขั้นต้น */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        {CARD_ORDER.slice(0, 3).map(renderCard)}
      </div>

      {/* Row 2: ค่าใช้จ่าย, กำไรสุทธิ, % กำไรสุทธิ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        {CARD_ORDER.slice(3, 6).map(renderCard)}
      </div>
    </div>
  );
}