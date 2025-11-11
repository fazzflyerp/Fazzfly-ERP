/**
 * Expense KPI Cards Component
 * Location: app/components/dashboards/expense/ExpenseKPICards.tsx
 * ✅ Displays: KPI metrics with change indicators
 * ✅ Fields: amount (ยอดเงิน)
 */

import React from "react";
import { ConfigField, KPIData, getMetricChange } from "./expenseUtils";

interface ExpenseKPICardsProps {
  kpiData: { [key: string]: KPIData };
  allData: any[];
  filteredData: any[];
  config: ConfigField[];
  selectedPeriods: string[];
}

const COLORS = [
  "#ef4444", // Red for expenses
  "#f59e0b", // Orange
  "#10b981", // Green
  "#3b82f6", // Blue
];

const LABELS: Record<string, string> = {
  amount: "ค่าใช้จ่ายรวม",
  count: "จำนวนรายการ",
};

export default function ExpenseKPICards({
  kpiData,
  allData,
  filteredData = [],
  config,
  selectedPeriods,
}: ExpenseKPICardsProps) {
  if (Object.keys(kpiData).length === 0) {
    return null;
  }

  // ✅ Safety check: if filteredData is not provided, fall back to allData
  const safeFilteredData = filteredData && filteredData.length > 0 ? filteredData : allData;

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        "amount",
        "count",
      ].map((fieldName, idx) => {
        let kpi = kpiData[fieldName];

        // ✅ Count คำนวณจากจำนวน records
        if (fieldName === "count") {
          kpi = {
            sum: safeFilteredData.length,
            avg: 0,
            max: 0,
            count: safeFilteredData.length,
          };
        }

        if (!kpi) return null;

        const { change: changePercent, icon: changeIcon } = getMetricChange(
          fieldName,
          selectedPeriods[0] || "",
          allData,
          config
        );
        const shouldShowChange =
          selectedPeriods.length === 1 &&
          ["amount"].includes(fieldName) &&
          changePercent !== null;

        return (
          <div
            key={fieldName}
            className="bg-gradient-to-br rounded-2xl p-6 border shadow-md hover:shadow-lg transition-all"
            style={{
              background: `linear-gradient(135deg, ${COLORS[idx % COLORS.length]}20, ${COLORS[idx % COLORS.length]}10)`,
              borderColor: `${COLORS[idx % COLORS.length]}40`,
            }}
          >
            {/* ชื่อ Card + % Change Badge */}
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-600 font-medium uppercase tracking-wide">
                {LABELS[fieldName] || fieldName}
              </p>
              {shouldShowChange && (
                <span
                  className={`text-xs font-bold px-2 py-1 rounded-full ${
                    changePercent! > 0
                      ? "bg-red-100 text-red-700"
                      : changePercent! < 0
                        ? "bg-green-100 text-green-700"
                        : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {changeIcon} {changePercent!.toFixed(1)}%
                </span>
              )}
            </div>

            {/* ค่าหลัก */}
            <p className="text-3xl font-bold text-slate-800 mb-4">
              {(kpi.sum as number).toLocaleString("th-TH", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
              {fieldName === "amount" && " บาท"}
            </p>

            {/* Sub KPIs */}
            {fieldName === "count" ? (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>จำนวนรายการทั้งหมด</span>
                  <span className="font-semibold text-slate-700">
                    {kpi.count}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>เฉลี่ย:</span>
                  <span className="font-semibold">
                    {(kpi.avg as number).toLocaleString("th-TH", {
                      maximumFractionDigits: 0,
                    })} บาท
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>สูงสุด:</span>
                  <span className="font-semibold">
                    {(kpi.max as number).toLocaleString("th-TH", {
                      maximumFractionDigits: 0,
                    })} บาท
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>จำนวน:</span>
                  <span className="font-semibold">{kpi.count} รายการ</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}