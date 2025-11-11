/**
 * Financial Summary Table Component
 * Location: app/components/dashboards/financial/FinancialSummaryTable.tsx
 * ✅ Displays: Period-wise financial summary
 */

"use client";

import React from "react";
import { getProfitMarginColor } from "@/app/components/dashboards/financial/financialUtils";

interface FinancialSummaryTableProps {
  summaryData: any[];
}

export default function FinancialSummaryTable({
  summaryData,
}: FinancialSummaryTableProps) {
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (summaryData.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 text-center">
        <p className="text-yellow-700 font-semibold">⚠️ ไม่พบข้อมูล</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-green-50 to-blue-50">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span className="text-2xl">📋</span>
          สรุปงบการเงิน (Financial Summary)
        </h3>
        <p className="text-sm text-slate-600 mt-1">
          แสดงข้อมูลตามช่วงเวลา
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 border-b border-slate-200">
                ช่วง
              </th>
              <th className="px-6 py-4 text-right text-sm font-bold text-slate-700 border-b border-slate-200">
                รายได้รวม
              </th>
              <th className="px-6 py-4 text-right text-sm font-bold text-slate-700 border-b border-slate-200">
                กำไรสุทธิ
              </th>
              <th className="px-6 py-4 text-center text-sm font-bold text-slate-700 border-b border-slate-200">
                % กำไรสุทธิ
              </th>
              <th className="px-6 py-4 text-center text-sm font-bold text-slate-700 border-b border-slate-200">
                สถานะ
              </th>
            </tr>
          </thead>
          <tbody>
            {summaryData.map((row, index) => {
              const profitColor = getProfitMarginColor(row.percent_net_profit);
              const isPositive = row.net_profit >= 0;

              return (
                <tr
                  key={index}
                  className="hover:bg-slate-50 transition-colors"
                >
                  {/* Period */}
                  <td className="px-6 py-4 text-sm font-semibold text-slate-800 border-b border-slate-100">
                    {row.period}
                  </td>

                  {/* Total Sales */}
                  <td className="px-6 py-4 text-sm text-right font-medium text-slate-700 border-b border-slate-100">
                    {formatCurrency(row.total_sales)}
                  </td>

                  {/* Net Profit */}
                  <td
                    className="px-6 py-4 text-sm text-right font-bold border-b border-slate-100"
                    style={{ color: isPositive ? "#10b981" : "#ef4444" }}
                  >
                    {formatCurrency(row.net_profit)}
                  </td>

                  {/* Percent Net Profit */}
                  <td className="px-6 py-4 text-center border-b border-slate-100">
                    <span
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold"
                      style={{
                        backgroundColor: `${profitColor}20`,
                        color: profitColor,
                      }}
                    >
                      {row.percent_net_profit.toFixed(2)}%
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4 text-center border-b border-slate-100">
                    {row.percent_net_profit >= 30 ? (
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-green-600">
                        🟢 ดีมาก
                      </span>
                    ) : row.percent_net_profit >= 20 ? (
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-yellow-600">
                        🟡 ดี
                      </span>
                    ) : row.percent_net_profit >= 10 ? (
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-orange-600">
                        🟠 พอใช้
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-red-600">
                        🔴 ควรปรับปรุง
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Footer: Totals */}
          <tfoot className="bg-slate-50 font-bold">
            <tr>
              <td className="px-6 py-4 text-sm text-slate-800 border-t-2 border-slate-300">
                รวมทั้งหมด
              </td>
              <td className="px-6 py-4 text-sm text-right text-slate-800 border-t-2 border-slate-300">
                {formatCurrency(
                  summaryData.reduce((sum, row) => sum + row.total_sales, 0)
                )}
              </td>
              <td
                className="px-6 py-4 text-sm text-right border-t-2 border-slate-300"
                style={{
                  color: summaryData.reduce((sum, row) => sum + row.net_profit, 0) >= 0
                    ? "#10b981"
                    : "#ef4444",
                }}
              >
                {formatCurrency(
                  summaryData.reduce((sum, row) => sum + row.net_profit, 0)
                )}
              </td>
              <td className="px-6 py-4 text-sm text-center text-slate-800 border-t-2 border-slate-300">
                {(
                  summaryData.reduce((sum, row) => sum + row.percent_net_profit, 0) /
                  summaryData.length
                ).toFixed(2)}%
              </td>
              <td className="px-6 py-4 text-center border-t-2 border-slate-300">
                <span className="text-sm text-slate-600">เฉลี่ย</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}