/**
 * Sales KPI Cards Component
 * Location: app/components/dashboards/sales/SalesKPICards.tsx
 * ✅ Displays: KPI metrics with change indicators
 * ✅ FIXED: Use filteredData for cust_status calculation
 */

import React from "react";
import { ConfigField, KPIData, getMetricChange, getCustomerStatusCounts } from "./salesUtils";

interface SalesKPICardsProps {
  kpiData: { [key: string]: KPIData };
  allData: any[];
  filteredData: any[]; // ✅ Add filtered data prop
  config: ConfigField[];
  selectedPeriods: string[];
}

const COLORS = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
];

const LABELS: Record<string, string> = {
  total_sales: "ยอดขายรวม",
  profit: "กำไร โดยประมาณ",
  cost: "ต้นทุน โดยประมาณ ",
  count: "จำนวนรายการ",
  cust_status: "จำนวนลูกค้าที่ใช้บริการ",
};

export default function SalesKPICards({
  kpiData,
  allData,
  filteredData = [], // ✅ Default to empty array
  config,
  selectedPeriods,
}: SalesKPICardsProps) {
  if (Object.keys(kpiData).length === 0) {
    return null;
  }

  // ✅ Safety check: if filteredData is not provided, fall back to allData
  const safeFilteredData = filteredData && filteredData.length > 0 ? filteredData : allData;

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        "total_sales",
        "cost",
        "profit",
        "count",
        "cust_status",
      ].map((fieldName, idx) => {
        let kpi = kpiData[fieldName];

        let customerNewCount = 0;
        let customerOldCount = 0;

        if (fieldName === "cust_status") {
          // ✅ FIX: Use safeFilteredData with fallback
          const status = getCustomerStatusCounts(safeFilteredData);
          customerNewCount = status.newCount;
          customerOldCount = status.oldCount;

          kpi = {
            sum: status.total,
            avg: 0,
            max: 0,
            count: status.total,
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
          ["total_sales", "cost", "profit", "cust_status"].includes(fieldName) &&
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
                      ? "bg-green-100 text-green-700"
                      : changePercent! < 0
                        ? "bg-red-100 text-red-700"
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
            </p>

            {/* Sub KPIs */}
            {fieldName === "cust_status" ? (
              <div className="space-y-1 text-sm">
                {/* ลูกค้าใหม่ */}
                <div className="flex justify-between text-slate-600">
                  <span>ลูกค้าใหม่:</span>
                  <span className="font-semibold text-green-600">
                    {customerNewCount}
                  </span>
                </div>

                {/* ลูกค้าเก่า */}
                <div className="flex justify-between text-slate-600">
                  <span>ลูกค้าเก่า:</span>
                  <span className="font-semibold text-blue-600">
                    {customerOldCount}
                  </span>
                </div>

                {/* อัตรา */}
                {customerNewCount + customerOldCount > 0 && (
                  <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-300">
                    <span>อัตรา:</span>
                    <span className="font-semibold text-slate-700">
                      {(
                        (customerNewCount /
                          (customerNewCount + customerOldCount)) *
                        100
                      ).toFixed(1)}
                      % ใหม่
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>เฉลี่ย:</span>
                  <span className="font-semibold">
                    {(kpi.avg as number).toLocaleString("th-TH", {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>สูงสุด:</span>
                  <span className="font-semibold">
                    {(kpi.max as number).toLocaleString("th-TH", {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>จำนวน:</span>
                  <span className="font-semibold">{kpi.count}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}