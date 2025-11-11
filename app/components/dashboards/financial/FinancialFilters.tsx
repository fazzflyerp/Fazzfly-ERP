/**
 * Financial Filters Component
 * Location: app/components/dashboards/financial/FinancialFilters.tsx
 * ✅ Filters: Year, Period (no date filter for financial)
 */

"use client";

import React, { useState, useEffect } from "react";
import {
  ConfigField,
  getPeriodOptions,
} from "@/app/components/dashboards/financial/financialUtils";

interface FinancialFiltersProps {
  config: ConfigField[];
  allData: any[];
  selectedYear: string | null;
  selectedPeriods: string[];
  availableYears: { year: string; spreadsheetId: string; fileName: string }[];
  loadingYears: boolean;
  archiveFolderId?: string;
  loading: boolean;
  onYearChange: (year: string | null) => void;
  onPeriodToggle: (period: string) => void;
  onSelectAll: (periods: string[]) => void;
  onClearFilters: () => void;
  onDefaultPeriodReady?: (period: string) => void;
}

export default function FinancialFilters({
  config,
  allData,
  selectedYear,
  selectedPeriods,
  availableYears,
  loadingYears,
  archiveFolderId,
  loading,
  onYearChange,
  onPeriodToggle,
  onSelectAll,
  onClearFilters,
  onDefaultPeriodReady,
}: FinancialFiltersProps) {
  const [periodOptions, setPeriodOptions] = useState<string[]>([]);

  // Generate period options
  useEffect(() => {
    if (allData.length > 0 && config.length > 0) {
      const options = getPeriodOptions(allData, config);
      setPeriodOptions(options);

      // Auto-select latest period if none selected
      if (selectedPeriods.length === 0 && options.length > 0) {
        const latest = options[options.length - 1];
        console.log("🔄 Auto-selecting latest period:", latest);
        onPeriodToggle(latest);
        if (onDefaultPeriodReady) {
          onDefaultPeriodReady(latest);
        }
      }
    }
  }, [allData, config]);

  const hasFilters = selectedYear !== null || selectedPeriods.length > 0;

  return (
    <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-2xl p-6 border border-green-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span className="text-2xl">🎛️</span>
          ตัวกรอง (Filters)
        </h3>
        {hasFilters && (
          <button
            onClick={onClearFilters}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
            disabled={loading}
          >
            ✕ ล้างทั้งหมด
          </button>
        )}
      </div>

      <div className="space-y-6">
        {/* Year Filter */}
        {archiveFolderId && (
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              📆 ปี (Year)
            </label>
            {loadingYears ? (
              <div className="bg-white rounded-lg p-4 border border-slate-200 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto"></div>
                <p className="text-sm text-slate-600 mt-2">กำลังโหลดปี...</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {/* Current Year */}
                <button
                  onClick={() => onYearChange(null)}
                  disabled={loading}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    selectedYear === null
                      ? "bg-green-600 text-white shadow-lg"
                      : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                  } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  ปีปัจจุบัน
                </button>

                {/* Archive Years */}
                {availableYears.map((yearObj) => (
                  <button
                    key={yearObj.year}
                    onClick={() => onYearChange(yearObj.year)}
                    disabled={loading}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      selectedYear === yearObj.year
                        ? "bg-green-600 text-white shadow-lg"
                        : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                    } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {yearObj.year}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Period Filter */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-slate-700">
              📊 ช่วง (Period)
            </label>
            <button
              onClick={() => onSelectAll(periodOptions)}
              className="text-sm text-green-600 hover:text-green-700 font-medium"
              disabled={loading}
            >
              {selectedPeriods.length === periodOptions.length ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
            </button>
          </div>

          {periodOptions.length === 0 ? (
            <div className="bg-white rounded-lg p-4 border border-slate-200 text-center">
              <p className="text-sm text-slate-600">ไม่พบช่วงเวลา</p>
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
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isSelected
                        ? "bg-green-600 text-white shadow-md"
                        : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                    } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
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