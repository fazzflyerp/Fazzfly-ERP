/**
 * Sales Filters Component - Mobile/Tablet Friendly
 * Location: app/components/dashboards/sales/SalesFilters.tsx
 * ✅ Fully responsive design for mobile, tablet, and desktop
 */

import React, { useState, useEffect } from "react";
import {
  ConfigField,
  getAvailableDatesFromData,
  getPeriodOptions,
} from "./salesUtils";

interface SalesFiltersProps {
  config: ConfigField[];
  allData: any[];
  selectedYear: string | null;
  selectedPeriods: string[];
  selectedDate: string;
  availableYears: { year: string; spreadsheetId: string; fileName: string }[];
  loadingYears: boolean;
  archiveFolderId?: string;
  loading?: boolean;
  onYearChange: (year: string | null) => void;
  onPeriodToggle: (period: string) => void;
  onSelectAll: (periodOptions: string[]) => void;
  onDateChange: (date: string) => void;
  onClearFilters: () => void;
  onDefaultPeriodReady?: (period: string) => void;
}

export default function SalesFilters({
  config,
  allData,
  selectedYear,
  selectedPeriods,
  selectedDate,
  availableYears,
  loadingYears,
  archiveFolderId,
  loading = false,
  onYearChange,
  onPeriodToggle,
  onSelectAll,
  onDateChange,
  onClearFilters,
  onDefaultPeriodReady,
}: SalesFiltersProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [hasAttemptedDefault, setHasAttemptedDefault] = useState(false);

  const periodOptions = getPeriodOptions(allData, config);

  /**
   * Reset period selection when year changes
   */
  useEffect(() => {
    setHasAttemptedDefault(false);
  }, [selectedYear]);

  const availableDates =
    selectedPeriods.length === 1
      ? getAvailableDatesFromData(
          allData,
          config.find((f) => f.type === "period")?.fieldName || "",
          config.find((f) => f.type === "date")?.fieldName || "",
          selectedPeriods[0]
        )
      : [];

  const canSelectDate =
    selectedPeriods.length === 1 && availableDates.length > 0;

  return (
    <div className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-slate-200 shadow-sm">
      <h3 className="text-base lg:text-lg font-semibold text-slate-900 mb-4 lg:mb-6">
        ตัวกรองข้อมูล
      </h3>

      {/* Loading indicator */}
      {loading && selectedYear && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 flex-shrink-0"></div>
          <p className="text-blue-700 text-xs lg:text-sm font-medium">
            กำลังโหลดข้อมูลปี {selectedYear}...
          </p>
        </div>
      )}

      {/* Filters Grid - Responsive: 1 col mobile, 2 col tablet, 4 col desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {/* Year Filter */}
        {archiveFolderId && (
          <div>
            <label className="block text-xs lg:text-sm font-medium text-slate-900 mb-2">
              ปี
            </label>
            <select
              value={selectedYear || ""}
              onChange={(e) => {
                const value = e.target.value;
                onYearChange(value || null);
              }}
              className="w-full px-3 lg:px-4 py-2 lg:py-2.5 bg-white border border-slate-300 text-slate-900 rounded-lg text-xs lg:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
              disabled={loadingYears || loading}
            >
              <option value="">ปีปัจจุบัน</option>
              {availableYears.map((yearData) => (
                <option key={yearData.year} value={yearData.year}>
                  {yearData.year}
                </option>
              ))}
            </select>
            {loadingYears && (
              <p className="text-xs text-slate-500 mt-1.5">กำลังโหลดปี...</p>
            )}
          </div>
        )}

        {/* Period Filter - Dropdown */}
        <div className="relative sm:col-span-1">
          <label className="block text-xs lg:text-sm font-medium text-slate-900 mb-2">
            ช่วงเวลา
          </label>

          <button
            onClick={() => !loading && periodOptions.length > 0 && setShowDropdown(!showDropdown)}
            disabled={loading || periodOptions.length === 0}
            className="w-full px-3 lg:px-4 py-2 lg:py-2.5 bg-white border border-slate-300 text-slate-900 rounded-lg text-xs lg:text-sm font-medium text-left flex items-center justify-between hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed transition-all active:scale-95 lg:active:scale-100"
          >
            <span className="truncate">
              {loading ? (
                "กำลังโหลด..."
              ) : periodOptions.length === 0 ? (
                "ไม่มีข้อมูล"
              ) : selectedPeriods.length === 0 ? (
                "เลือกช่วงเวลา"
              ) : selectedPeriods.length === periodOptions.length ? (
                "ทั้งหมด"
              ) : selectedPeriods.length === 1 ? (
                selectedPeriods[0]
              ) : (
                `${selectedPeriods.length} ช่วง`
              )}
            </span>
            <svg
              className={`w-4 h-4 text-slate-500 transition-transform flex-shrink-0 ml-2 ${
                showDropdown ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {showDropdown && periodOptions.length > 0 && (
            <>
              <div className="absolute z-50 mt-2 w-full bg-white border border-slate-300 rounded-lg shadow-xl overflow-hidden">
                {/* Select All */}
                <div className="border-b border-slate-200 bg-slate-50 p-2 lg:p-3">
                  <label className="flex items-center gap-3 cursor-pointer hover:bg-slate-100 p-2 rounded-md transition-colors text-xs lg:text-sm">
                    <input
                      type="checkbox"
                      checked={
                        selectedPeriods.length === periodOptions.length &&
                        periodOptions.length > 0
                      }
                      onChange={() => onSelectAll(periodOptions)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="font-semibold text-slate-900">
                      เลือกทั้งหมด ({periodOptions.length})
                    </span>
                  </label>
                </div>

                {/* Options */}
                <div className="max-h-48 sm:max-h-64 overflow-y-auto">
                  {periodOptions.map((period) => (
                    <label
                      key={period}
                      className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-2 lg:p-3 border-b border-slate-100 last:border-b-0 transition-colors text-xs lg:text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPeriods.includes(period)}
                        onChange={() => onPeriodToggle(period)}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                      />
                      <span className="text-slate-900 font-medium">
                        {period}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowDropdown(false)}
              />
            </>
          )}
        </div>

        {/* Date Filter */}
        <div>
          <label className="block text-xs lg:text-sm font-medium text-slate-900 mb-2">
            วันที่
            {selectedPeriods.length !== 1 && !loading && (
              <span className="text-xs text-slate-500 font-normal ml-1 block lg:inline">
                (เลือก 1 ช่วง)
              </span>
            )}
          </label>
          <select
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            disabled={loading || !canSelectDate}
            className="w-full px-3 lg:px-4 py-2 lg:py-2.5 bg-white border border-slate-300 text-slate-900 rounded-lg text-xs lg:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
          >
            <option value="">ทุกวัน</option>
            {availableDates.map((date) => (
              <option key={date} value={date}>
                {new Date(date).toLocaleDateString("th-TH", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </option>
            ))}
          </select>
          {canSelectDate && !loading && (
            <p className="text-xs text-slate-500 mt-1.5">
              {availableDates.length} วันที่มีข้อมูล
            </p>
          )}
        </div>
      </div>

      {/* Clear Filters Buttons - Responsive */}
      {(selectedDate || selectedPeriods.length > 0 || selectedYear) && (
        <div className="mt-4 lg:mt-6 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
          {/* Clear Period & Date */}
          {(selectedDate || selectedPeriods.length > 0) && (
            <button
              onClick={() => {
                selectedPeriods.forEach((p) => onPeriodToggle(p));
                onDateChange("");
                setHasAttemptedDefault(true);
              }}
              disabled={loading}
              className="px-3 lg:px-4 py-2 text-xs lg:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 lg:active:scale-100"
            >
              ล้างช่วงเวลา/วัน
            </button>
          )}

          {/* Clear All */}
          {selectedYear && (
            <button
              onClick={() => {
                onYearChange(null);
                selectedPeriods.forEach((p) => onPeriodToggle(p));
                onDateChange("");
                onClearFilters();
                setHasAttemptedDefault(true);
              }}
              disabled={loading}
              className="px-3 lg:px-4 py-2 text-xs lg:text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 lg:active:scale-100"
            >
              ✕ ล้างทั้งหมด
            </button>
          )}
        </div>
      )}
    </div>
  );
}