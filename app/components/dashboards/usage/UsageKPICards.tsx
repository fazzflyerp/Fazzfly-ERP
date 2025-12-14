/**
 * Usage KPI Cards Component - Mobile/Tablet Friendly
 * Location: app/components/dashboards/usage/UsageKPICards.tsx
 * ✅ Dynamic field mapping from config (like SalesKPICards)
 * ✅ KPI: Split into 4 separate cards - Total, Average, Max, Count
 */

import React, { useState, useMemo } from "react";
import { ConfigField, KPIData, getMetricChange, generateTransactionTableData } from "./usageUtils";

interface UsageKPICardsProps {
  kpiData: { [key: string]: KPIData };
  allData: any[];
  filteredData: any[];
  config: ConfigField[];
  selectedPeriods: string[];
}

const COLORS = [
  "#9580ff",
  "#ff613e",  
  "#fff56d",  
  "#ff66c4",  
  "#b0ff4b",   
  "#dd7ff0ff",
];

const KPI_METRICS = [
  { key: "sum", label: "ต้นทุนรวม (บาท)", icon: "", valueKey: "sum" },
  { key: "avg", label: "ต้นทุนเฉลี่ย (บาท)", icon: "", valueKey: "avg" },
  { key: "max", label: "ต้นทุนสูงสุด (บาท)", icon: "", valueKey: "max" },
  { key: "count", label: "จำนวนรายการ", icon: "", valueKey: "count" },
];

export default function UsageKPICards({
  kpiData,
  allData,
  filteredData = [],
  config,
  selectedPeriods,
}: UsageKPICardsProps) {
  const [showTransactionDetails, setShowTransactionDetails] = useState(false);
  const [sortBy, setSortBy] = useState<string>("cust_name");

  if (Object.keys(kpiData).length === 0) {
    return null;
  }

  const safeFilteredData = filteredData && filteredData.length > 0 ? filteredData : allData;

  // ✅ Get cost field from config
  const costField = useMemo(() => {
    return config.find((f) => f.fieldName === "cost");
  }, [config]);

  const costKPI = kpiData["cost"];

  if (!costKPI || !costField) {
    return null;
  }

  // Prepare transaction data with configFields
  const transactionData = useMemo(() => {
    return generateTransactionTableData(safeFilteredData, config);
  }, [safeFilteredData, config]);

  // Sort transaction data dynamically
  const sortedTransactionData = useMemo(() => {
    const sorted = [...transactionData];
    sorted.sort((a, b) => {
      const aVal = a[sortBy as keyof typeof a];
      const bVal = b[sortBy as keyof typeof b];
      
      if (typeof aVal === "string" && typeof bVal === "string") {
        return aVal.localeCompare(bVal, "th-TH");
      } else if (typeof aVal === "number" && typeof bVal === "number") {
        return bVal - aVal;
      }
      return 0;
    });
    return sorted;
  }, [transactionData, sortBy]);

  // Calculate change for cost field
  const { change: changePercent, icon: changeIcon } = getMetricChange(
    "cost",
    selectedPeriods[0] || "",
    allData,
    config
  );
  const shouldShowChange = selectedPeriods.length === 1 && changePercent !== null;

  return (
    <>
      {/* KPI Cards Grid - 4 Separate Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 w-full">
        {KPI_METRICS.map((metric, idx) => {
          const value = costKPI[metric.valueKey as keyof KPIData];
          const isCount = metric.key === "count";
          
          return (
            <div
              key={metric.key}
              className="bg-gradient-to-br rounded-xl lg:rounded-2xl p-3 sm:p-4 lg:p-6 border shadow-sm hover:shadow-lg hover:scale-105 transition-all active:scale-95 sm:active:scale-100 duration-300"
              style={{
                background: `linear-gradient(135deg, ${COLORS[idx]}40, ${COLORS[idx]}40)`,
                borderColor: `${COLORS[idx]}40`,
              }}
            >
              {/* Header: Icon + Label */}
              <div className="flex items-center gap-2 mb-2 sm:mb-3">
                <span className="text-lg sm:text-xl lg:text-2xl">{metric.icon}</span>
                <p className="text-xs lg:text-sm text-slate-600 font-bold uppercase tracking-wide truncate">
                  {metric.label}
                </p>
              </div>

              {/* Main Value */}
              <div className="flex items-end justify-between gap-2">
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-800 truncate">
                  {typeof value === "number"
                    ? value.toLocaleString("th-TH", {
                        minimumFractionDigits: isCount ? 0 : 0,
                        maximumFractionDigits: isCount ? 0 : 0,
                      })
                    : value}
                  {!isCount && " "}
                </p>

                {/* Change Badge - Show only on Total (sum) */}
                {metric.key === "sum" && shouldShowChange && (
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
            </div>
          );
        })}
      </div>

      {/* Transaction Details - Collapsible (like Sales) */}
      <div className="hidden md:block mt-6 md:mt-8">
        <button
          onClick={() => setShowTransactionDetails(!showTransactionDetails)}
          className="w-full flex items-center justify-between px-3 lg:px-4 py-2 lg:py-3 text-xs lg:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors active:scale-95 lg:active:scale-100"
        >
          <span className="flex items-center gap-2">
            <span>รายละเอียดการใช้งาน</span>
          </span>
          <svg
            className={`w-4 h-4 transition-transform ${
              showTransactionDetails ? "rotate-180" : ""
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

        {showTransactionDetails && (
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
                  <th className="px-2 lg:px-4 py-2 lg:py-3 text-left font-bold text-slate-700 whitespace-nowrap">
                    สินค้า
                  </th>
                  <th 
                    className="px-2 lg:px-4 py-2 lg:py-3 text-center font-bold text-slate-700 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                    onClick={() => setSortBy("quantity")}
                  >
                    จำนวน {sortBy === "quantity" && "▼"}
                  </th>
                  <th 
                    className="px-2 lg:px-4 py-2 lg:py-3 text-right font-bold text-slate-700 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                    onClick={() => setSortBy("cost")}
                  >
                    ต้นทุน  {sortBy === "cost" && "▼"}
                  </th>
                  <th className="px-2 lg:px-4 py-2 lg:py-3 text-left font-bold text-slate-700 whitespace-nowrap">
                    พนักงาน
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
                      {row.product}
                    </td>
                    <td className="px-2 lg:px-4 py-2 lg:py-3 text-center text-slate-700">
                      <span className="inline-flex items-center px-1.5 lg:px-2 py-0.5 lg:py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 whitespace-nowrap">
                        {row.quantity}
                      </span>
                    </td>
                    <td className="px-2 lg:px-4 py-2 lg:py-3 text-right font-semibold text-slate-800 text-xs lg:text-sm whitespace-nowrap">
                      ฿{row.cost.toLocaleString('th-TH', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td className="px-2 lg:px-4 py-2 lg:py-3 text-slate-700 text-xs lg:text-sm">
                      {row.staff}
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