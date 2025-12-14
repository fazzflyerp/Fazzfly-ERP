/**
 * Purchase KPI Cards Component - Mobile/Tablet Friendly
 * Location: app/components/dashboards/purchase/PurchaseKPICards.tsx
 * ✅ Dynamic field mapping from config + Pending Items
 */

import React, { useState, useMemo } from "react";
import { ConfigField, KPIData, getMetricChange, generatePendingItems } from "./purchaseUtils";

interface PurchaseKPICardsProps {
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

export default function PurchaseKPICards({
  kpiData,
  allData,
  filteredData = [],
  config,
  selectedPeriods,
}: PurchaseKPICardsProps) {
  const [showPendingItems, setShowPendingItems] = useState(false);

  if (Object.keys(kpiData).length === 0) {
    return null;
  }

  const safeFilteredData = filteredData && filteredData.length > 0 ? filteredData : allData;

  // ✅ Get number fields from config dynamically (like Sales/Usage)
  const numberFields = useMemo(() => {
    return config
      .filter((f) => f.type === "number")
      .sort((a, b) => a.order - b.order);
  }, [config]);

  // Get pending items (Status = "รอรับของ")
  const pendingItems = useMemo(() => {
    return generatePendingItems(safeFilteredData);
  }, [safeFilteredData]);

  return (
    <>
      {/* KPI Cards Grid - Responsive (like Sales) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 lg:gap-4 w-full">
        {numberFields.map((field, idx) => {
          const kpi = kpiData[field.fieldName];
          if (!kpi) return null;

          const { change: changePercent, icon: changeIcon } = getMetricChange(
            field.fieldName,
            selectedPeriods[0] || "",
            allData,
            config
          );
          const shouldShowChange =
            selectedPeriods.length === 1 &&
            changePercent !== null;

          return (
            <div
              key={field.fieldName}
              className="bg-gradient-to-br rounded-xl lg:rounded-2xl p-3 sm:p-4 lg:p-6 border shadow-sm hover:shadow-lg hover:scale-105 transition-all active:scale-95 sm:active:scale-100 duration-300"
              style={{
                background: `linear-gradient(135deg, ${COLORS[idx % COLORS.length]}70, ${COLORS[idx % COLORS.length]}40)`,
                borderColor: `${COLORS[idx % COLORS.length]}40`,
              }}
            >
              {/* Header: Label + Change Badge (like Sales) */}
              <div className="flex items-start sm:items-center justify-between gap-2 mb-2 sm:mb-3">
                <p className="text-xs lg:text-sm text-slate-600 font-bold uppercase tracking-wide truncate">
                  {field.label}{field.fieldName === "cost" && " (บาท)"}
                </p>
                {shouldShowChange && (
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${changePercent! > 0
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
                {field.fieldName === "cost" && " "}
              </p>

              {/* Sub Stats (like Sales) */}
              <div className="space-y-1 sm:space-y-1.5 text-xs sm:text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>เฉลี่ย:</span>
                  <span className="font-semibold truncate ml-2">
                    {(kpi.avg as number).toLocaleString("th-TH", {
                      maximumFractionDigits: 0,
                    })}
                    ฿ {field.fieldName === "cost" && " "}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>สูงสุด:</span>
                  <span className="font-semibold truncate ml-2">
                    {(kpi.max as number).toLocaleString("th-TH", {
                      maximumFractionDigits: 0,
                    })}
                    {field.fieldName === "cost" && " ฿"}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>จำนวน:</span>
                  <span className="font-semibold">{kpi.count}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pending Items Section */}
      <div className="mt-6 lg:mt-8">
        <button
          onClick={() => setShowPendingItems(!showPendingItems)}
          className="w-full flex items-center justify-between px-3 lg:px-4 py-2 lg:py-3 text-xs lg:text-sm font-medium text-slate-700 bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 rounded-lg transition-colors active:scale-95 lg:active:scale-100"
        >
          <span className="flex items-center gap-2">
            <span>สินค้าที่รอรับ</span>
            {pendingItems.length > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white">
                {pendingItems.length}
              </span>
            )}
          </span>
          <svg
            className={`w-4 h-4 transition-transform ${showPendingItems ? "rotate-180" : ""
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

        {showPendingItems && pendingItems.length > 0 && (
          <div className="mt-3 lg:mt-4 bg-white rounded-lg border border-yellow-200 overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-xs lg:text-sm">
                <thead>
                  <tr className="border-b-2 border-yellow-300 bg-yellow-50">
                    <th className="px-2 lg:px-4 py-2 lg:py-3 text-left font-bold text-slate-700 whitespace-nowrap">
                      สินค้า
                    </th>
                    <th className="px-2 lg:px-4 py-2 lg:py-3 text-center font-bold text-slate-700 whitespace-nowrap">
                      จำนวนรายการ
                    </th>
                    <th className="px-2 lg:px-4 py-2 lg:py-3 text-center font-bold text-slate-700 whitespace-nowrap">
                      จำนวน
                    </th>
                    <th className="px-2 lg:px-4 py-2 lg:py-3 text-left font-bold text-slate-700">
                      ผู้ขาย
                    </th>
                    <th className="px-2 lg:px-4 py-2 lg:py-3 text-left font-bold text-slate-700 whitespace-nowrap">
                      วันที่สั่งซื้อ
                    </th>
                    <th className="px-2 lg:px-4 py-2 lg:py-3 text-left font-bold text-slate-700 whitespace-nowrap">
                      วันที่รับสินค้า
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pendingItems.map((item, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-yellow-100 hover:bg-yellow-50 transition-colors"
                    >
                      <td className="px-2 lg:px-4 py-2 lg:py-3 font-semibold text-slate-800 truncate">
                        {item.product_name}
                      </td>
                      <td className="px-2 lg:px-4 py-2 lg:py-3 text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                          {item.pending_count}
                        </span>
                      </td>
                      <td className="px-2 lg:px-4 py-2 lg:py-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                          <span>{item.total_quantity.toLocaleString('th-TH')}</span>
                          <span className="text-blue-600">{item.unit}</span>
                        </span>
                      </td>
                      <td className="px-2 lg:px-4 py-2 lg:py-3 text-slate-700 text-xs lg:text-sm max-w-xs truncate">
                        {item.suppliers}
                      </td>
                      <td className="px-2 lg:px-4 py-2 lg:py-3 text-slate-600 text-xs whitespace-nowrap">
                        {item.earliest_date}
                      </td>
                      <td className="px-2 lg:px-4 py-2 lg:py-3 text-slate-600 text-xs whitespace-nowrap">
                        {item.earliest_deliverdate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile Card View */}
            <div className="lg:hidden space-y-3 p-4">
              {pendingItems.map((item, idx) => (
                <div
                  key={idx}
                  className="border border-yellow-200 rounded-lg p-3 bg-yellow-50"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-semibold text-slate-800 text-sm truncate flex-1">
                      {item.product_name}
                    </h4>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-500 text-white whitespace-nowrap flex-shrink-0">
                      {item.pending_count} รายการ
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span className="font-medium">จำนวน:</span>
                      <span className="text-slate-800 font-semibold">
                        {item.total_quantity.toLocaleString('th-TH')} {item.unit}
                      </span>
                    </div>
                    <div className="text-slate-600">
                      <span className="font-medium">ผู้ขาย:</span>
                      <p className="text-slate-700 mt-0.5">{item.suppliers}</p>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span className="font-medium">วันที่สั่งซื้อ:</span>
                      <span className="text-slate-700">{item.earliest_date}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span className="font-medium">วันที่รับสินค้า:</span>
                      <span className="text-slate-700 font-semibold">{item.earliest_deliverdate}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {showPendingItems && pendingItems.length === 0 && (
          <div className="mt-3 lg:mt-4 bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <p className="text-green-700 font-medium text-sm">ไม่มีสินค้าที่รอรับ</p>
          </div>
        )}
      </div>
    </>
  );
}