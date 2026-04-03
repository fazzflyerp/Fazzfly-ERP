/**
 * Payroll KPI Cards Component - Modern Stripe Style
 * Location: app/components/dashboards/payroll/PayrollKPICards.tsx
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

const LABELS: Record<string, { label: string; icon: React.ReactNode; barColor: string; unit: string }> = {
  salary: { 
    label: "เงินเดือนรวม", 
    unit: "บาท",
    barColor: "bg-emerald-500",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  },
  commission: { 
    label: "คอมมิชชั่นรวม", 
    unit: "บาท",
    barColor: "bg-blue-500",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
  },
  staff_fees: { 
    label: "ค่าพนักงานรวม", 
    unit: "บาท",
    barColor: "bg-violet-500",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  },
  off: { 
    label: "ลารวม", 
    unit: "วัน",
    barColor: "bg-orange-500",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  },
  late: { 
    label: "สายรวม", 
    unit: "นาที",
    barColor: "bg-rose-500",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  },
  ot: { 
    label: "OT รวม", 
    unit: "นาที",
    barColor: "bg-sky-500",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  },
};

const KPICard = ({ 
  fieldName, kpiData, allData, config, selectedPeriods, formatNumber 
}: { 
  fieldName: string; kpiData: { [key: string]: KPIData }; allData: any[]; config: ConfigField[]; selectedPeriods: string[]; formatNumber: (num: number, unit: string) => string 
}) => {
  const data = kpiData[fieldName];
  const info = LABELS[fieldName];
  if (!data || !info) return null;

  const currentPeriod = selectedPeriods.length === 1 ? selectedPeriods[0] : "";
  const { change, icon } = getMetricChange(fieldName, currentPeriod, allData, config);

  const isNegativeGood = fieldName === "late" || fieldName === "off";
  const changeColor = change !== null && typeof change === 'number'
    ? isNegativeGood
      ? (change > 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600")
      : (change > 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")
    : "bg-slate-50 text-slate-500";

  return (
    <div className="relative bg-white rounded-2xl p-4 lg:p-5 border border-slate-100 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between min-h-[160px]">
      {/* ✅ Accent Bar */}
      <div className={`absolute bottom-0 left-0 right-0 h-1.5 ${info.barColor}`} />

      <div>
        <div className="flex items-center justify-between mb-4">
          <div className={`w-9 h-9 rounded-xl ${info.barColor} text-white flex items-center justify-center shadow-md`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {info.icon}
            </svg>
          </div>
          {change !== null && typeof change === 'number' && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-0.5 ${changeColor}`}>
              {icon} {Math.abs(change).toFixed(1)}%
            </span>
          )}
        </div>

        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">
          {info.label}
        </p>
        <p className="text-xl lg:text-2xl font-bold text-slate-800 truncate">
          {formatNumber(data.sum, info.unit)}
        </p>
      </div>

      {/* Original Details */}
      <div className="mt-3 pt-3 border-t border-slate-50 grid grid-cols-2 gap-2 text-[10px] lg:text-xs">
        <div>
          <span className="text-slate-400 block">เฉลี่ย</span>
          <span className="font-semibold text-slate-700">{formatNumber(data.avg, info.unit)}</span>
        </div>
        <div className="text-right">
          <span className="text-slate-400 block">สูงสุด</span>
          <span className="font-semibold text-slate-700">{formatNumber(data.max, info.unit)}</span>
        </div>
      </div>
    </div>
  );
};

export default function PayrollKPICards({
  kpiData, allData, config, selectedPeriods,
}: PayrollKPICardsProps) {
  
  const formatNumber = (num: number, unit: string): string => {
    if (unit === "บาท") {
      return new Intl.NumberFormat("th-TH", { minimumFractionDigits: 0 }).format(num) + " ฿";
    }
    if (unit === "นาที") {
      const hours = Math.floor(num / 60);
      const minutes = Math.round(num % 60);
      return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }
    return `${num.toFixed(1)} ${unit}`;
  };

  return (
    <div className="space-y-6">
      {/* 6 KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-6">
        {Object.keys(LABELS).map((fieldName) => (
          <KPICard 
            key={fieldName} 
            fieldName={fieldName} 
            kpiData={kpiData} 
            allData={allData} 
            config={config} 
            selectedPeriods={selectedPeriods} 
            formatNumber={formatNumber} 
          />
        ))}
      </div>

      {/* Scoring Summary Style เหมือนเดิมแต่ปรับขอบให้เข้าชุด */}
      <div className="bg-white rounded-2xl p-5 lg:p-6 border border-slate-200 shadow-sm">
        <h4 className="text-base lg:text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">🎯</span>
          <span>เกณฑ์การประเมิน Performance (100 คะแนน)</span>
        </h4>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <p className="font-bold text-rose-600 text-xs mb-2 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              สาย (30)
            </p>
            <ul className="space-y-1 text-slate-500 text-[11px]">
              <li>✅ 0 นาที = 30</li>
              <li>✅ 1-30 = 27</li>
              <li>⚠️ 31-60 = 22</li>
              <li>⚠️ 61-120 = 15</li>
              <li>❌ {'>'}120 = 0</li>
            </ul>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <p className="font-bold text-orange-600 text-xs mb-2 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              ลา (30)
            </p>
            <ul className="space-y-1 text-slate-500 text-[11px]">
              <li>✅ 0 วัน = 30</li>
              <li>✅ 1-2 วัน = 27</li>
              <li>⚠️ 3-4 วัน = 22</li>
              <li>⚠️ 5 วัน = 15</li>
              <li>❌ {'>'}5 วัน = 0</li>
            </ul>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <p className="font-bold text-sky-600 text-xs mb-2 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              OT (40)
            </p>
            <ul className="space-y-1 text-slate-500 text-[11px]">
              <li>✅ {'>'}2,400 = 40</li>
              <li>⭐ 1,200-2,400 = 35</li>
              <li>✓ 600-1,200 = 30</li>
              <li>📊 1-600 = 20</li>
              <li>📉 0 = 10</li>
            </ul>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-2">
            {["A: 90-100", "B: 80-89", "C: 70-79", "D: 60-69", "F: < 60"].map((grade, i) => (
              <span key={i} className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold border border-slate-200">
                {grade}
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}