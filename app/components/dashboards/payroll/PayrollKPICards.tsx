/**
 * Payroll KPI Cards Component
 * Location: app/components/dashboards/payroll/PayrollKPICards.tsx
 * ✅ Displays: 9 KPI cards in 3 rows (3 + 3 + 3)
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
  salary: "from-green-500 to-emerald-600",       // 💰 เงินเดือน
  commission: "from-blue-500 to-cyan-600",       // 💵 คอมมิชชั่น
  staffFees: "from-purple-500 to-violet-600",    // 💳 ค่าพนักงาน
  leave: "from-orange-500 to-amber-600",         // 🏖️ ลา
  late: "from-red-500 to-rose-600",              // ⏰ สาย
  ot: "from-indigo-500 to-blue-600",             // ⏱️ OT
};

const LABELS: Record<string, { label: string; icon: string; color: string; unit: string }> = {
  salary: { label: "เงินเดือนรวม", icon: "💰", color: COLORS.salary, unit: "บาท" },
  commission: { label: "คอมมิชชั่นรวม", icon: "💵", color: COLORS.commission, unit: "บาท" },
  staff_fees: { label: "ค่าพนักงานรวม", icon: "💳", color: COLORS.staffFees, unit: "บาท" },
  off: { label: "ลารวม", icon: "🏖️", color: COLORS.leave, unit: "วัน" },
  late: { label: "สายรวม", icon: "⏰", color: COLORS.late, unit: "นาที" },
  ot: { label: "OT รวม", icon: "⏱️", color: COLORS.ot, unit: "นาที" },
};

// Helper to render card
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

  // ✅ Special handling for late/leave - lower is better
  const isNegativeGood = fieldName === "late" || fieldName === "off";
  const changeColor = change !== null && typeof change === 'number'
    ? isNegativeGood
      ? (change > 0 ? "text-red-600" : change < 0 ? "text-green-600" : "text-slate-600")
      : (change > 0 ? "text-green-600" : change < 0 ? "text-red-600" : "text-slate-600")
    : "text-slate-600";

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
        {change !== null && typeof change === 'number' && (
          <div className="flex items-center gap-1 text-sm">
            <span>{icon}</span>
            <span className={changeColor}>
              {change > 0 ? "+" : ""}{change.toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {/* Label */}
      <p className="text-sm font-medium text-slate-600 mb-2">{info.label}</p>

      {/* Main Value */}
      <p className="text-3xl font-bold text-slate-800 mb-4">
        {formatNumber(data.sum, info.unit)}
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-200">
        <div>
          <p className="text-xs text-slate-500">เฉลี่ย</p>
          <p className="text-sm font-semibold text-slate-700">
            {formatNumber(data.avg, info.unit)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">สูงสุด</p>
          <p className="text-sm font-semibold text-slate-700">
            {formatNumber(data.max, info.unit)}
          </p>
        </div>
      </div>

      {/* Count */}
      <div className="mt-3 pt-3 border-t border-slate-200">
        <p className="text-xs text-slate-500">
          จำนวน: <span className="font-semibold text-slate-700">{data.count} รายการ</span>
        </p>
      </div>

      {/* Performance Hint for Late/Leave/OT */}
      {(fieldName === "late" || fieldName === "off" || fieldName === "ot") && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          <p className="text-xs text-slate-500">
            {fieldName === "late" && "💡 สาย 0 นาที = 30 คะแนน"}
            {fieldName === "off" && "💡 ลา 0 วัน = 30 คะแนน"}
            {fieldName === "ot" && "💡 OT >40 ชม. = 40 คะแนน"}
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
  // ✅ Define order for cards (3 rows x 3 cards)
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
    <div className="space-y-4">
      {/* Row 1: เงินเดือน, คอมมิชชั่น, ค่าพนักงาน */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {CARD_ORDER.slice(0, 3).map((fieldName) =>
          renderKPICard(fieldName, kpiData, allData, config, selectedPeriods, formatNumber)
        )}
      </div>

      {/* Row 2: ลา, สาย, OT */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {CARD_ORDER.slice(3, 6).map((fieldName) =>
          renderKPICard(fieldName, kpiData, allData, config, selectedPeriods, formatNumber)
        )}
      </div>

      {/* Performance Scoring Summary */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-200">
        <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <span>🎯</span>
          เกณฑ์การประเมิน Performance Score (100 คะแนน)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Late Scoring */}
          <div className="bg-white rounded-lg p-3 border border-slate-200">
            <p className="font-bold text-red-600 mb-2">⏰ สาย (30 คะแนน)</p>
            <ul className="space-y-1 text-slate-600">
              <li>✅ 0 นาที = 30 🌟</li>
              <li>✅ 1-30 นาที = 27</li>
              <li>⚠️ 31-60 นาที = 22</li>
              <li>⚠️ 61-120 นาที = 15</li>
              <li>❌ &gt;120 นาที = 0</li>
            </ul>
          </div>

          {/* Leave Scoring */}
          <div className="bg-white rounded-lg p-3 border border-slate-200">
            <p className="font-bold text-orange-600 mb-2">🏖️ ลา (30 คะแนน)</p>
            <ul className="space-y-1 text-slate-600">
              <li>✅ 0 วัน = 30 🌟</li>
              <li>✅ 1-2 วัน = 27</li>
              <li>⚠️ 3-4 วัน = 22</li>
              <li>⚠️ 5 วัน = 15</li>
              <li>❌ &gt;5 วัน = 0</li>
            </ul>
          </div>

          {/* OT Scoring */}
          <div className="bg-white rounded-lg p-3 border border-slate-200">
            <p className="font-bold text-indigo-600 mb-2">⏱️ OT (40 คะแนน)</p>
            <ul className="space-y-1 text-slate-600">
              <li>✅ &gt;2,400 นาที (&gt;40h) = 40 🌟</li>
              <li>⭐ 1,200-2,400 นาที = 35</li>
              <li>✓ 600-1,200 นาที = 30</li>
              <li>📊 1-600 นาที = 20</li>
              <li>📉 0 นาที = 10</li>
            </ul>
          </div>
        </div>

        {/* Grade Scale */}
        <div className="mt-4 pt-4 border-t border-purple-200">
          <p className="text-xs font-semibold text-slate-700 mb-2">เกรด:</p>
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
              A: 90-100
            </span>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
              B: 80-89
            </span>
            <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
              C: 70-79
            </span>
            <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
              D: 60-69
            </span>
            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
              F: &lt;60
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}