/**
 * Payroll KPI Cards Component - Fully Mobile/Tablet Friendly
 * Location: app/components/dashboards/payroll/PayrollKPICards.tsx
 * ✅ Displays: 6 KPI cards responsive (1 column mobile, 2 tablet, 3 desktop)
 */

"use client";

import React from "react";
import { ConfigField, KPIData, getMetricChange } from "@/app/components/dashboards/payroll/payrollUtils";

interface PayrollKPICardsProps {
  kpiData: { [key: string]: KPIData };
  allData: any[];
  filteredData: any[];
  config: ConfigField[];
  selectedPeriods: string[];
}

const COLORS = {
  salary: "from-green-500 to-emerald-600",
  commission: "from-blue-500 to-cyan-600",
  staffFees: "from-purple-500 to-violet-600",
  leave: "from-orange-500 to-amber-600",
  late: "from-red-500 to-rose-600",
  ot: "from-indigo-500 to-blue-600",
};

const LABELS: Record<string, { label: string; icon: string; color: string; unit: string }> = {
  salary: { label: "เงินเดือนรวม", icon: "💰", color: COLORS.salary, unit: "บาท" },
  commission: { label: "คอมมิชชั่นรวม", icon: "💵", color: COLORS.commission, unit: "บาท" },
  staff_fees: { label: "ค่าพนักงานรวม", icon: "💳", color: COLORS.staffFees, unit: "บาท" },
  off: { label: "ลารวม", icon: "🏖️", color: COLORS.leave, unit: "วัน" },
  late: { label: "สายรวม", icon: "⏰", color: COLORS.late, unit: "นาที" },
  ot: { label: "OT รวม", icon: "⏱️", color: COLORS.ot, unit: "นาที" },
};

const renderKPICard = (
  fieldName: string,
  kpiData: { [key: string]: KPIData },
  allData: any[],
  config: ConfigField[],
  selectedPeriods: string[],
  formatNumber: (num: number, unit: string) => string
) => {
  const data = kpiData[fieldName];
  if (!data) return null;

  const info = LABELS[fieldName];
  if (!info) return null;

  const currentPeriod = selectedPeriods.length === 1 ? selectedPeriods[0] : "";
  const { change, icon } = getMetricChange(fieldName, currentPeriod, allData, config);

  const isNegativeGood = fieldName === "late" || fieldName === "off";
  const changeColor = change !== null && typeof change === 'number'
    ? isNegativeGood
      ? (change > 0 ? "text-red-600" : change < 0 ? "text-green-600" : "text-slate-600")
      : (change > 0 ? "text-green-600" : change < 0 ? "text-red-600" : "text-slate-600")
    : "text-slate-600";

  return (
    <div
      key={fieldName}
      className="bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-xl lg:rounded-2xl p-3 sm:p-4 lg:p-6 border-2 border-slate-100 hover:shadow-lg sm:hover:shadow-xl sm:hover:scale-105 transition-all duration-300 active:scale-95 sm:active:scale-100"
    >
      {/* Header - More Compact on Mobile */}
      <div className="flex items-start sm:items-center justify-between gap-2 mb-2 sm:mb-3 lg:mb-4">
        <div className={`p-2 sm:p-2.5 lg:p-3 rounded-lg lg:rounded-xl bg-gradient-to-br ${info.color} text-white text-base sm:text-lg lg:text-2xl shadow-lg flex-shrink-0`}>
          {info.icon}
        </div>
        
        {/* Label and Change - Vertical Stack on Mobile */}
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-xs lg:text-sm font-medium text-slate-600 truncate">{info.label}</p>
          {change !== null && typeof change === 'number' && (
            <div className="flex items-center gap-0.5 mt-0.5">
              <span className="text-sm">{icon}</span>
              <span className={`${changeColor} font-semibold text-xs`}>
                {change > 0 ? "+" : ""}{change.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Value - Largest on Mobile */}
      <p className="text-2xl sm:text-2xl lg:text-3xl font-bold text-slate-800 mb-2 sm:mb-3 lg:mb-4 truncate leading-tight">
        {formatNumber(data.sum, info.unit)}
      </p>

      {/* Stats Grid - 2 columns always */}
      <div className="grid grid-cols-2 gap-2 pt-2 sm:pt-3 lg:pt-4 border-t border-slate-200">
        <div className="min-w-0">
          <p className="text-xs text-slate-500 mb-0.5 font-medium">เฉลี่ย</p>
          <p className="text-xs sm:text-sm lg:text-base font-semibold text-slate-700 truncate">
            {formatNumber(data.avg, info.unit)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500 mb-0.5 font-medium">สูงสุด</p>
          <p className="text-xs sm:text-sm lg:text-base font-semibold text-slate-700 truncate">
            {formatNumber(data.max, info.unit)}
          </p>
        </div>
      </div>

      {/* Count */}
      <div className="mt-2 pt-2 border-t border-slate-200">
        <p className="text-xs text-slate-500">
          จำนวน: <span className="font-semibold text-slate-700 text-xs sm:text-sm">{data.count}</span>
        </p>
      </div>

      {/* Performance Hint - Hidden on small mobile */}
      {(fieldName === "late" || fieldName === "off" || fieldName === "ot") && (
        <div className="hidden sm:block mt-2 pt-2 border-t border-slate-200">
          <p className="text-xs text-slate-500">
            {fieldName === "late" && "💡 0 นาที = 30 คะแนน"}
            {fieldName === "off" && "💡 0 วัน = 30 คะแนน"}
            {fieldName === "ot" && `💡 ${'>'}40 ชม. = 40 คะแนน`}
          </p>
        </div>
      )}
    </div>
  );
};

export default function PayrollKPICards({
  kpiData,
  allData,
  filteredData,
  config,
  selectedPeriods,
}: PayrollKPICardsProps) {
  const CARD_ORDER = [
    "salary",
    "commission",
    "staff_fees",
    "off",
    "late",
    "ot",
  ];

  const formatNumber = (num: number, unit: string): string => {
    if (unit === "บาท") {
      return new Intl.NumberFormat("th-TH", {
        style: "currency",
        currency: "THB",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(num);
    }
    
    if (unit === "นาที") {
      const hours = Math.floor(num / 60);
      const minutes = Math.round(num % 60);
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes}m`;
    }

    return `${num.toFixed(1)} ${unit}`;
  };

  return (
    <div className="space-y-2 sm:space-y-3 lg:space-y-4">
      {/* Row 1: Salary, Commission, Staff Fees - Full Width Mobile, 2 Col Tablet, 3 Col Desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 lg:gap-6">
        {CARD_ORDER.slice(0, 3).map((fieldName) =>
          renderKPICard(fieldName, kpiData, allData, config, selectedPeriods, formatNumber)
        )}
      </div>

      {/* Row 2: Leave, Late, OT - Full Width Mobile, 2 Col Tablet, 3 Col Desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 lg:gap-6">
        {CARD_ORDER.slice(3, 6).map((fieldName) =>
          renderKPICard(fieldName, kpiData, allData, config, selectedPeriods, formatNumber)
        )}
      </div>

      {/* Performance Scoring Summary - Fully Responsive */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl sm:rounded-xl lg:rounded-2xl p-3 sm:p-4 lg:p-6 border border-purple-200">
        <h4 className="text-sm sm:text-base lg:text-lg font-bold text-slate-800 mb-2 sm:mb-3 lg:mb-4 flex items-center gap-2">
          <span className="text-base sm:text-lg lg:text-xl">🎯</span>
          <span>เกณฑ์การประเมิน Performance (100 คะแนน)</span>
        </h4>
        
        {/* Scoring Boxes - 1 Col Mobile, 2 Col Tablet, 3 Col Desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 lg:gap-4 mb-3 sm:mb-4 lg:mb-4">
          {/* Late Scoring */}
          <div className="bg-white rounded-lg p-2.5 sm:p-3 lg:p-4 border border-slate-200">
            <p className="font-bold text-red-600 text-xs sm:text-sm mb-2">⏰ สาย (30)</p>
            <ul className="space-y-1 text-slate-600 text-xs">
              <li>✅ 0 นาที = 30</li>
              <li>✅ 1-30 = 27</li>
              <li>⚠️ 31-60 = 22</li>
              <li>⚠️ 61-120 = 15</li>
              <li>❌ {'>'}120 = 0</li>
            </ul>
          </div>

          {/* Leave Scoring */}
          <div className="bg-white rounded-lg p-2.5 sm:p-3 lg:p-4 border border-slate-200">
            <p className="font-bold text-orange-600 text-xs sm:text-sm mb-2">🏖️ ลา (30)</p>
            <ul className="space-y-1 text-slate-600 text-xs">
              <li>✅ 0 วัน = 30</li>
              <li>✅ 1-2 วัน = 27</li>
              <li>⚠️ 3-4 วัน = 22</li>
              <li>⚠️ 5 วัน = 15</li>
              <li>❌ {'>'}5 วัน = 0</li>
            </ul>
          </div>

          {/* OT Scoring */}
          <div className="bg-white rounded-lg p-2.5 sm:p-3 lg:p-4 border border-slate-200">
            <p className="font-bold text-indigo-600 text-xs sm:text-sm mb-2">⏱️ OT (40)</p>
            <ul className="space-y-1 text-slate-600 text-xs">
              <li>✅ {'>'}2,400 = 40</li>
              <li>⭐ 1,200-2,400 = 35</li>
              <li>✓ 600-1,200 = 30</li>
              <li>📊 1-600 = 20</li>
              <li>📉 0 = 10</li>
            </ul>
          </div>
        </div>

        {/* Grade Scale - Wrap on Mobile */}
        <div className="pt-2 sm:pt-3 lg:pt-4 border-t border-purple-200">
          <p className="text-xs font-semibold text-slate-700 mb-2">เกรด:</p>
          <div className="flex flex-wrap gap-1 sm:gap-2">
            <span className="px-2 sm:px-2.5 lg:px-3 py-0.5 sm:py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
              A: 90-100
            </span>
            <span className="px-2 sm:px-2.5 lg:px-3 py-0.5 sm:py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
              B: 80-89
            </span>
            <span className="px-2 sm:px-2.5 lg:px-3 py-0.5 sm:py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
              C: 70-79
            </span>
            <span className="px-2 sm:px-2.5 lg:px-3 py-0.5 sm:py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
              D: 60-69
            </span>
            <span className="px-2 sm:px-2.5 lg:px-3 py-0.5 sm:py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
              F: มากกว่า 60
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}