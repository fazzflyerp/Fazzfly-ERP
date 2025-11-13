/**
 * Payroll Filters Component - Updated with Year Filter
 * Location: app/components/dashboards/payroll/PayrollFilters.tsx
 *  Filters: Year + Period (button grid, no date)
 */

"use client";

import React, { useState, useEffect } from "react";
import {
  ConfigField,
  getPeriodOptionsFromData,
} from "@/app/components/dashboards/payroll/payrollUtils";

interface PayrollFiltersProps {
  config: ConfigField[];
  allData: any[];
  selectedYear: string | null;
  selectedPeriods: string[];
  availableYears: { year: string; spreadsheetId: string; fileName: string }[];
  loadingYears: boolean;
  archiveFolderId?: string;
  loading?: boolean;
  onYearChange: (year: string | null) => void;
  onPeriodToggle: (period: string) => void;
  onSelectAll: (periods: string[]) => void;
  onClearFilters: () => void;
}

export default function PayrollFilters({
  config,
  allData,
  selectedYear,
  selectedPeriods,
  availableYears,
  loadingYears,
  archiveFolderId,
  loading = false,
  onYearChange,
  onPeriodToggle,
  onSelectAll,
  onClearFilters,
}: PayrollFiltersProps) {
  const [periodOptions, setPeriodOptions] = useState<string[]>([]);

  // Update period options when data or year changes
  useEffect(() => {
    if (allData.length > 0 && config.length > 0) {
      const options = getPeriodOptionsFromData(allData, config, selectedYear || undefined);
      setPeriodOptions(options);

      // Auto-select latest period if none selected and not loading
      if (selectedPeriods.length === 0 && options.length > 0 && !loading) {
        const latest = options[options.length - 1];
        console.log("[Auto-select] Latest period:", latest);
        onPeriodToggle(latest);
      }
    }
  }, [allData, config, selectedYear, loading]);

  const hasFilters = selectedYear || selectedPeriods.length > 0;

  return (
    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span className="text-2xl"></span>
          ตัวกรอง (Filters)
        </h3>
        {hasFilters && (
          <button
            onClick={onClearFilters}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            X
          </button>
        )}
      </div>

      {/* Loading indicator */}
      {loading && selectedYear && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <p className="text-blue-700 text-sm font-medium">
            {selectedYear}...
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* Year Filter */}
        {archiveFolderId && (
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              (Year)
            </label>
            <select
              value={selectedYear || ""}
              onChange={(e) => {
                const value = e.target.value;
                onYearChange(value || null);
              }}
              className="w-full px-4 py-2.5 bg-white border border-slate-300 text-slate-900 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
              disabled={loadingYears || loading}
            >
              <option value=""> (Current)</option>
              {availableYears.map((yearData) => (
                <option key={yearData.year} value={yearData.year}>
                  {yearData.year}
                </option>
              ))}
            </select>
            {loadingYears && (
              <p className="text-xs text-slate-500 mt-1.5">...</p>
            )}
          </div>
        )}

        {/* Period Filter */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-slate-700">
              (Period)
            </label>
            {periodOptions.length > 0 && (
              <button
                onClick={() => onSelectAll(periodOptions)}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {selectedPeriods.length === periodOptions.length
                  ? ""
                  : ""}
              </button>
            )}
          </div>

          {loading ? (
            <div className="bg-white rounded-lg p-4 border border-slate-200 text-center">
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                <p className="text-sm text-slate-600">...</p>
              </div>
            </div>
          ) : periodOptions.length === 0 ? (
            <div className="bg-white rounded-lg p-4 border border-slate-200 text-center">
              <p className="text-sm text-slate-600"></p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {periodOptions.map((period) => {
                const isSelected = selectedPeriods.includes(period);
                return (
                  <button
                    key={period}
                    onClick={() => onPeriodToggle(period)}
                    disabled={loading}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${isSelected
                        ? "bg-purple-600 text-white shadow-md hover:bg-purple-700"
                        : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                      } ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    {period}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Filter Summary */}
        <div className="pt-4 border-t border-green-200">
          <p className="text-sm text-slate-600">
            <span className="font-semibold">สรุป:</span>{" "}
            {selectedYear ? `ปี ${selectedYear}` : "ปีปัจจุบัน"}
            {" • "}
            {selectedPeriods.length > 0
              ? `${selectedPeriods.length} ช่วง`
              : "ทุกช่วง"}
          </p>
        </div>

      </div>
    </div>
  );
}