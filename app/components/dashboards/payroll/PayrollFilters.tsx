/**
 * Payroll Filters Component
 * Location: app/components/dashboards/payroll/PayrollFilters.tsx
 * ✅ Filters: Period only (no year/date for payroll)
 */

"use client";

import React, { useState, useEffect } from "react";
import {
  ConfigField,
  getPeriodOptions,
} from "@/app/components/dashboards/payroll/payrollUtils";

interface PayrollFiltersProps {
  config: ConfigField[];
  allData: any[];
  selectedPeriods: string[];
  loading: boolean;
  onPeriodToggle: (period: string) => void;
  onSelectAll: (periods: string[]) => void;
  onClearFilters: () => void;
}

export default function PayrollFilters({
  config,
  allData,
  selectedPeriods,
  loading,
  onPeriodToggle,
  onSelectAll,
  onClearFilters,
}: PayrollFiltersProps) {
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
      }
    }
  }, [allData, config]);

  const hasFilters = selectedPeriods.length > 0;

  return (
    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-200 shadow-sm">
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
        {/* Period Filter */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-slate-700">
              📊 ช่วง (Period)
            </label>
            <button
              onClick={() => onSelectAll(periodOptions)}
              className="text-sm text-purple-600 hover:text-purple-700 font-medium"
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
                        ? "bg-purple-600 text-white shadow-md"
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
        <div className="pt-4 border-t border-purple-200">
          <p className="text-sm text-slate-600">
            <span className="font-semibold">สรุป:</span>{" "}
            {selectedPeriods.length > 0
              ? `${selectedPeriods.length} ช่วง (${selectedPeriods.join(", ")})`
              : "ทุกช่วง"}
          </p>
        </div>
      </div>
    </div>
  );
}