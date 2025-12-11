/**
 * Sales KPI Cards Component - With Transaction Details Table
 * Location: app/components/dashboards/sales/SalesKPICards.tsx
 * ✅ Desktop: Full transaction table with all details
 * ✅ Data from generateTransactionTableData (salesUtils.ts)
 */

import React, { useState, useMemo } from "react";
import { ConfigField, KPIData, getMetricChange, getCustomerStatusCounts, generateTransactionTableData } from "./salesUtils";

interface SalesKPICardsProps {
  kpiData: { [key: string]: KPIData };
  allData: any[];
  filteredData: any[];
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
  filteredData = [],
  config,
  selectedPeriods,
}: SalesKPICardsProps) {
  const [showProgramDetails, setShowProgramDetails] = useState(false);
  const [sortBy, setSortBy] = useState<"cust_name" | "total_sales" | "profit">("cust_name");

  if (Object.keys(kpiData).length === 0) {
    return null;
  }

  const safeFilteredData = filteredData && filteredData.length > 0 ? filteredData : allData;

  // Prepare transaction data using utility function
  const transactionData = useMemo(() => {
    return generateTransactionTableData(safeFilteredData);
  }, [safeFilteredData]);

  // Sort transaction data
  const sortedTransactionData = useMemo(() => {
    const sorted = [...transactionData];
    sorted.sort((a, b) => {
      if (sortBy === "cust_name") {
        return a.cust_name.localeCompare(b.cust_name, "th-TH");
      } else if (sortBy === "total_sales") {
        return b.total_sales - a.total_sales;
      } else {
        return b.profit - a.profit;
      }
    });
    return sorted;
  }, [transactionData, sortBy]);



  return (
    <>
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 w-full">
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
              className="bg-gradient-to-br rounded-xl lg:rounded-2xl p-3 sm:p-4 lg:p-6 border shadow-sm hover:shadow-lg hover:scale-105 transition-all active:scale-95 sm:active:scale-100 duration-300"
              style={{
                background: `linear-gradient(135deg, ${COLORS[idx % COLORS.length]}20, ${COLORS[idx % COLORS.length]}10)`,
                borderColor: `${COLORS[idx % COLORS.length]}40`,
              }}
            >
              {/* Header: Label + Change Badge */}
              <div className="flex items-start sm:items-center justify-between gap-2 mb-2 sm:mb-3">
                <p className="text-xs lg:text-sm text-slate-600 font-medium uppercase tracking-wide truncate">
                  {LABELS[fieldName] || fieldName}
                </p>
                {shouldShowChange && (
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${
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

              {/* Main Value */}
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-800 mb-2 sm:mb-3 lg:mb-4 truncate">
                {(kpi.sum as number).toLocaleString("th-TH", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </p>

              {/* Sub KPIs - Responsive */}
              {fieldName === "cust_status" ? (
                <div className="space-y-1 sm:space-y-1.5 text-xs sm:text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>ใหม่:</span>
                    <span className="font-semibold text-green-600">
                      {customerNewCount}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>เก่า:</span>
                    <span className="font-semibold text-blue-600">
                      {customerOldCount}
                    </span>
                  </div>
                  {customerNewCount + customerOldCount > 0 && (
                    <div className="flex justify-between text-slate-600 pt-1 sm:pt-1.5 border-t border-slate-300">
                      <span>อัตรา:</span>
                      <span className="font-semibold text-slate-700">
                        {(
                          (customerNewCount /
                            (customerNewCount + customerOldCount)) *
                          100
                        ).toFixed(1)}
                        %
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1 sm:space-y-1.5 text-xs sm:text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>เฉลี่ย:</span>
                    <span className="font-semibold truncate ml-2">
                      {(kpi.avg as number).toLocaleString("th-TH", {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>สูงสุด:</span>
                    <span className="font-semibold truncate ml-2">
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

      {/* Transaction Details - Collapsible */}
      <div className="hidden md:block mt-6 md:mt-8">
        <button
          onClick={() => setShowProgramDetails(!showProgramDetails)}
          className="w-full flex items-center justify-between px-3 lg:px-4 py-2 lg:py-3 text-xs lg:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors active:scale-95 lg:active:scale-100"
        >
          <span className="flex items-center gap-2">
            <span>รายละเอียดรายการขาย</span>
          </span>
          <svg
            className={`w-4 h-4 transition-transform ${
              showProgramDetails ? "rotate-180" : ""
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

        {showProgramDetails && (
          <div className="hidden md:block mt-3 md:mt-4 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs lg:text-sm">
              <thead>
                <tr className="border-b-2 border-slate-300 bg-slate-50">
                  <th className="px-2 lg:px-4 py-2 lg:py-3 text-left font-bold text-slate-700 whitespace-nowrap">
                    วันที่
                  </th>
                  <th 
                    className="px-2 lg:px-4 py-2 lg:py-3 text-left font-bold text-slate-700 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                    onClick={() => setSortBy("cust_name")}
                  >
                    ชื่อลูกค้า {sortBy === "cust_name" && "▼"}
                  </th>
                  <th className="px-2 lg:px-4 py-2 lg:py-3 text-left font-bold text-slate-700">
                    โปรแกรม
                  </th>
                  <th className="px-2 lg:px-4 py-2 lg:py-3 text-center font-bold text-slate-700 whitespace-nowrap">
                    จำนวน
                  </th>
                  <th className="px-2 lg:px-4 py-2 lg:py-3 text-right font-bold text-slate-700 whitespace-nowrap">
                    ยอดขาย
                  </th>
                  <th className="px-2 lg:px-4 py-2 lg:py-3 text-right font-bold text-slate-700 whitespace-nowrap">
                    ต้นทุน
                  </th>
                  <th className="px-2 lg:px-4 py-2 lg:py-3 text-right font-bold text-slate-700 whitespace-nowrap">
                    กำไร
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedTransactionData.map((row, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-2 lg:px-4 py-2 lg:py-3 text-slate-700 text-xs whitespace-nowrap">
                      {row.date}
                    </td>
                    <td className="px-2 lg:px-4 py-2 lg:py-3 font-semibold text-slate-800 max-w-xs truncate">
                      {row.cust_name}
                    </td>
                    <td className="px-2 lg:px-4 py-2 lg:py-3 text-slate-700 truncate">
                      {row.program}
                    </td>
                    <td className="px-2 lg:px-4 py-2 lg:py-3 text-center text-slate-700">
                      <span className="inline-flex items-center px-1.5 lg:px-2 py-0.5 lg:py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 whitespace-nowrap">
                        {row.quantity}
                      </span>
                    </td>
                    <td className="px-2 lg:px-4 py-2 lg:py-3 text-right font-semibold text-slate-800 text-xs lg:text-sm whitespace-nowrap">
                      {row.total_sales.toLocaleString('th-TH', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td className="px-2 lg:px-4 py-2 lg:py-3 text-right font-semibold text-slate-800 text-xs lg:text-sm whitespace-nowrap">
                      {row.cost.toLocaleString('th-TH', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td className="px-2 lg:px-4 py-2 lg:py-3 text-right font-semibold text-green-600 text-xs lg:text-sm whitespace-nowrap">
                      {row.profit.toLocaleString('th-TH', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}