/**
 * Expense Filters Component
 * Location: app/components/dashboards/expense/ExpenseFilters.tsx
 */

import React, { useState, useEffect } from "react";
import { ConfigField, getPeriodOptions } from "./expenseUtils";

interface ExpenseFiltersProps {
  config: ConfigField[];
  allData: any[];
  selectedYear: string | null;
  selectedPeriods: string[];
  dateFrom: string;
  dateTo: string;
  availableYears: { year: string; spreadsheetId: string; fileName: string }[];
  loadingYears: boolean;
  archiveFolderId?: string;
  loading?: boolean;
  onYearChange: (year: string | null) => void;
  onPeriodToggle: (period: string) => void;
  onSelectAll: (periodOptions: string[]) => void;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  onClearFilters: () => void;
}

function todayISO() { return new Date().toISOString().split("T")[0]; }
function daysAgoISO(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split("T")[0]; }
function startOfMonthISO() { const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0]; }

const PRESETS = [
  { label: "ทั้งหมด",  from: "",                to: ""          },
  { label: "วันนี้",    from: todayISO(),         to: todayISO()  },
  { label: "7 วัน",    from: daysAgoISO(7),      to: todayISO()  },
  { label: "30 วัน",   from: daysAgoISO(30),     to: todayISO()  },
  { label: "เดือนนี้", from: startOfMonthISO(),  to: todayISO()  },
];

export default function ExpenseFilters({
  config, allData, selectedYear, selectedPeriods,
  dateFrom, dateTo,
  availableYears, loadingYears, archiveFolderId, loading = false,
  onYearChange, onPeriodToggle, onSelectAll,
  onDateFromChange, onDateToChange, onClearFilters,
}: ExpenseFiltersProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const periodOptions = getPeriodOptions(allData, config);

  useEffect(() => { setShowDropdown(false); }, [selectedYear]);

  const activePreset = PRESETS.find((p) => p.from === dateFrom && p.to === dateTo) ?? null;
  const hasDateFilter = !!(dateFrom || dateTo);

  return (
    <div className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-slate-200 shadow-sm">
      <h3 className="text-base lg:text-lg font-semibold text-slate-900 mb-4 lg:mb-5">ตัวกรองข้อมูล</h3>

      {loading && selectedYear && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 flex-shrink-0" />
          <p className="text-blue-700 text-xs lg:text-sm font-medium">กำลังโหลดข้อมูลปี {selectedYear}...</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">

        {/* Year */}
        {archiveFolderId && (
          <div>
            <label className="block text-xs lg:text-sm font-medium text-slate-900 mb-2">ปี</label>
            <select value={selectedYear || ""} onChange={(e) => onYearChange(e.target.value || null)}
              disabled={loadingYears || loading}
              className="w-full px-3 lg:px-4 py-2 lg:py-2.5 bg-white border border-slate-300 text-slate-900 rounded-lg text-xs lg:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500 transition-colors">
              <option value="">ปีปัจจุบัน</option>
              {availableYears.map((y) => <option key={y.year} value={y.year}>{y.year}</option>)}
            </select>
            {loadingYears && <p className="text-xs text-slate-500 mt-1.5">กำลังโหลดปี...</p>}
          </div>
        )}

        {/* Period */}
        <div className="relative">
          <label className="block text-xs lg:text-sm font-medium text-slate-900 mb-2">ช่วงเวลา</label>
          <button
            onClick={() => !loading && periodOptions.length > 0 && setShowDropdown(!showDropdown)}
            disabled={loading || periodOptions.length === 0}
            className="w-full px-3 lg:px-4 py-2 lg:py-2.5 bg-white border border-slate-300 text-slate-900 rounded-lg text-xs lg:text-sm font-medium text-left flex items-center justify-between hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500 transition-all">
            <span className="truncate">
              {loading ? "กำลังโหลด..." : periodOptions.length === 0 ? "ไม่มีข้อมูล" : selectedPeriods.length === 0 ? "เลือกช่วงเวลา" : selectedPeriods.length === periodOptions.length ? "ทั้งหมด" : selectedPeriods.length === 1 ? selectedPeriods[0] : `${selectedPeriods.length} ช่วง`}
            </span>
            <svg className={`w-4 h-4 text-slate-500 transition-transform flex-shrink-0 ml-2 ${showDropdown ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showDropdown && periodOptions.length > 0 && (
            <>
              <div className="absolute z-50 mt-2 w-full bg-white border border-slate-300 rounded-lg shadow-xl overflow-hidden">
                <div className="border-b border-slate-200 bg-slate-50 p-2 lg:p-3">
                  <label className="flex items-center gap-3 cursor-pointer hover:bg-slate-100 p-2 rounded-md transition-colors text-xs lg:text-sm">
                    <input type="checkbox"
                      checked={selectedPeriods.length === periodOptions.length && periodOptions.length > 0}
                      onChange={() => onSelectAll(periodOptions)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded cursor-pointer" />
                    <span className="font-semibold text-slate-900">เลือกทั้งหมด ({periodOptions.length})</span>
                  </label>
                </div>
                <div className="max-h-48 sm:max-h-64 overflow-y-auto">
                  {periodOptions.map((period) => (
                    <label key={period} className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-2 lg:p-3 border-b border-slate-100 last:border-b-0 transition-colors text-xs lg:text-sm">
                      <input type="checkbox" checked={selectedPeriods.includes(period)} onChange={() => onPeriodToggle(period)}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded cursor-pointer flex-shrink-0" />
                      <span className="text-slate-900 font-medium">{period}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
            </>
          )}
        </div>

        {/* Date Range */}
        <div className="sm:col-span-2 lg:col-span-2">
          <label className="block text-xs lg:text-sm font-medium text-slate-900 mb-2">ช่วงวันที่</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {PRESETS.map((p) => {
              const isActive = activePreset?.label === p.label;
              return (
                <button key={p.label} type="button"
                  onClick={() => { onDateFromChange(p.from); onDateToChange(p.to); }}
                  disabled={loading}
                  className={`px-2.5 py-1 text-xs rounded-md border transition-colors disabled:opacity-50 ${isActive ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:text-blue-600"}`}>
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={(e) => onDateFromChange(e.target.value)}
              disabled={loading}
              className="flex-1 min-w-0 px-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-lg text-xs lg:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500 transition-colors" />
            <span className="text-slate-400 text-xs flex-shrink-0">ถึง</span>
            <input type="date" value={dateTo} onChange={(e) => onDateToChange(e.target.value)}
              disabled={loading}
              className="flex-1 min-w-0 px-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-lg text-xs lg:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500 transition-colors" />
          </div>
          {hasDateFilter && !activePreset && (
            <p className="text-xs text-blue-600 mt-1.5">กรองวันที่แบบกำหนดเอง</p>
          )}
        </div>
      </div>

      {(hasDateFilter || selectedPeriods.length > 0 || selectedYear) && (
        <div className="mt-4 lg:mt-5 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
          {(hasDateFilter || selectedPeriods.length > 0) && (
            <button onClick={() => { selectedPeriods.forEach((p) => onPeriodToggle(p)); onDateFromChange(""); onDateToChange(""); }}
              disabled={loading}
              className="px-3 lg:px-4 py-2 text-xs lg:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50">
              ล้างช่วงเวลา/วัน
            </button>
          )}
          {selectedYear && (
            <button onClick={() => { onYearChange(null); selectedPeriods.forEach((p) => onPeriodToggle(p)); onDateFromChange(""); onDateToChange(""); onClearFilters(); }}
              disabled={loading}
              className="px-3 lg:px-4 py-2 text-xs lg:text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50">
              ✕ ล้างทั้งหมด
            </button>
          )}
        </div>
      )}
    </div>
  );
}
