/**
 * Expense KPI Cards Component - Mobile/Tablet Friendly
 * Location: app/components/dashboards/expense/ExpenseKPICards.tsx
 * ✅ Split into 4 separate cards - Total, Average, Max, Count
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
  "#ef4444", // Red - Total
  "#f59e0b", // Orange - Average
  "#fb923c", // Light Orange - Max
  "#fbbf24", // Amber - Count
];

const KPI_METRICS = [
  { key: "sum", label: "ค่าใช้จ่ายรวม", icon: "", valueKey: "sum" },
  { key: "avg", label: "ค่าใช้จ่ายเฉลี่ย", icon: "", valueKey: "avg" },
  { key: "max", label: "ค่าใช้จ่ายสูงสุด", icon: "", valueKey: "max" },
  { key: "count", label: "จำนวนรายการ", icon: "", valueKey: "count" },
];

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

  const safeFilteredData = filteredData && filteredData.length > 0 ? filteredData : allData;

  const amountKPI = kpiData["amount"];

  if (!amountKPI) {
    return null;
  }

  // Calculate change for amount field
  const { change: changePercent, icon: changeIcon } = getMetricChange(
    "amount",
    selectedPeriods[0] || "",
    allData,
    config
  );
  const shouldShowChange = selectedPeriods.length === 1 && changePercent !== null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 w-full">
      {KPI_METRICS.map((metric, idx) => {
        let value: number | string;
        
        if (metric.key === "count") {
          value = safeFilteredData.length;
        } else {
          value = amountKPI[metric.valueKey as keyof KPIData] as number;
        }
        
        const isCount = metric.key === "count";
        
        return (
          <div
            key={metric.key}
            className="bg-gradient-to-br rounded-xl lg:rounded-2xl p-3 sm:p-4 lg:p-6 border shadow-sm hover:shadow-lg hover:scale-105 transition-all active:scale-95 sm:active:scale-100 duration-300"
            style={{
              background: `linear-gradient(135deg, ${COLORS[idx]}20, ${COLORS[idx]}10)`,
              borderColor: `${COLORS[idx]}40`,
            }}
          >
            {/* Header: Icon + Label */}
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <span className="text-lg sm:text-xl lg:text-2xl">{metric.icon}</span>
              <p className="text-xs lg:text-sm text-slate-600 font-medium uppercase tracking-wide truncate">
                {metric.label}
              </p>
            </div>

            {/* Main Value */}
            <div className="flex items-end justify-between gap-2">
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-800 truncate">
                {typeof value === "number"
                  ? value.toLocaleString("th-TH", {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })
                  : value}
                {!isCount && " ฿"}
              </p>

              {/* Change Badge - Show only on Total (sum) */}
              {metric.key === "sum" && shouldShowChange && (
                <span
                  className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${
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
          </div>
        );
      })}
    </div>
  );
}