/**
 * Financial KPI Cards Component
 * Location: app/components/dashboards/financial/FinancialKPICards.tsx
 * ✅ Displays: 6 KPI cards in 2 rows (3 + 3)
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

const COLORS = {
  revenue: "from-green-500 to-emerald-600",     // 💰 รายได้
  cost: "from-red-500 to-rose-600",             // 💸 ต้นทุน
  profit: "from-blue-500 to-cyan-600",          // 📈 กำไรขั้นต้น
  expense: "from-orange-500 to-amber-600",      // 💵 ค่าใช้จ่าย
  netProfit: "from-purple-500 to-violet-600",   // 💎 กำไรสุทธิ
  percent: "from-cyan-500 to-sky-600",          // 📊 % กำไรสุทธิ
};

const LABELS: Record<string, { label: string; icon: string; color: string }> = {
  total_sales: { label: "รายได้รวม", icon: "💰", color: COLORS.revenue },
  cost: { label: "ต้นทุน", icon: "💸", color: COLORS.cost },
  profit: { label: "กำไรขั้นต้น", icon: "📈", color: COLORS.profit },
  expense: { label: "ค่าใช้จ่ายรวม", icon: "💵", color: COLORS.expense },
  net_profit: { label: "กำไรสุทธิ", icon: "💎", color: COLORS.netProfit },
  percent_net_profit: { label: "% กำไรสุทธิ", icon: "📊", color: COLORS.percent },
};

export default function FinancialKPICards({
  kpiData,
  allData,
  filteredData,
  config,
  selectedPeriods,
}: FinancialKPICardsProps) {
  // ✅ Define order for cards
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
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <div className="space-y-4">
      {/* Row 1: รายได้, ต้นทุน, กำไรขั้นต้น */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {CARD_ORDER.slice(0, 3).map((fieldName) => {
          const data = kpiData[fieldName];
          if (!data) return null;

          const info = LABELS[fieldName];
          if (!info) return null;

          const isPercent = fieldName.includes("percent");
          const currentPeriod = selectedPeriods.length === 1 ? selectedPeriods[0] : "";
          const { change, icon } = getMetricChange(fieldName, currentPeriod, allData, config);

          return (
            <div
              key={fieldName}
              className="bg-gradient-to-br from-white to-slate-50 rounded-2xl p-6 border-2 border-slate-100 hover:shadow-xl hover:scale-105 transition-all duration-300"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${info.color} text-white text-2xl shadow-lg`}>
                  {info.icon}
                </div>
                {change !== null && (
                  <div className="flex items-center gap-1 text-sm">
                    <span>{icon}</span>
                    <span className={change > 0 ? "text-green-600" : change < 0 ? "text-red-600" : "text-slate-600"}>
                      {change > 0 ? "+" : ""}{change.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Label */}
              <p className="text-sm font-medium text-slate-600 mb-2">{info.label}</p>

              {/* Main Value */}
              <p className="text-3xl font-bold text-slate-800 mb-4">
                {formatNumber(data.sum, isPercent)}
              </p>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-200">
                <div>
                  <p className="text-xs text-slate-500">เฉลี่ย</p>
                  <p className="text-sm font-semibold text-slate-700">
                    {formatNumber(data.avg, isPercent)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">สูงสุด</p>
                  <p className="text-sm font-semibold text-slate-700">
                    {formatNumber(data.max, isPercent)}
                  </p>
                </div>
              </div>

              {/* Count */}
              <div className="mt-3 pt-3 border-t border-slate-200">
                <p className="text-xs text-slate-500">
                  จำนวน: <span className="font-semibold text-slate-700">{data.count} รายการ</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Row 2: ค่าใช้จ่าย, กำไรสุทธิ, % กำไรสุทธิ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {CARD_ORDER.slice(3, 6).map((fieldName) => {
          const data = kpiData[fieldName];
          if (!data) return null;

          const info = LABELS[fieldName];
          if (!info) return null;

          const isPercent = fieldName.includes("percent");
          const currentPeriod = selectedPeriods.length === 1 ? selectedPeriods[0] : "";
          const { change, icon } = getMetricChange(fieldName, currentPeriod, allData, config);

          return (
            <div
              key={fieldName}
              className="bg-gradient-to-br from-white to-slate-50 rounded-2xl p-6 border-2 border-slate-100 hover:shadow-xl hover:scale-105 transition-all duration-300"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${info.color} text-white text-2xl shadow-lg`}>
                  {info.icon}
                </div>
                {change !== null && (
                  <div className="flex items-center gap-1 text-sm">
                    <span>{icon}</span>
                    <span className={change > 0 ? "text-green-600" : change < 0 ? "text-red-600" : "text-slate-600"}>
                      {change > 0 ? "+" : ""}{change.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Label */}
              <p className="text-sm font-medium text-slate-600 mb-2">{info.label}</p>

              {/* Main Value */}
              <p className="text-3xl font-bold text-slate-800 mb-4">
                {formatNumber(data.sum, isPercent)}
              </p>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-200">
                <div>
                  <p className="text-xs text-slate-500">เฉลี่ย</p>
                  <p className="text-sm font-semibold text-slate-700">
                    {formatNumber(data.avg, isPercent)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">สูงสุด</p>
                  <p className="text-sm font-semibold text-slate-700">
                    {formatNumber(data.max, isPercent)}
                  </p>
                </div>
              </div>

              {/* Count */}
              <div className="mt-3 pt-3 border-t border-slate-200">
                <p className="text-xs text-slate-500">
                  จำนวน: <span className="font-semibold text-slate-700">{data.count} รายการ</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}