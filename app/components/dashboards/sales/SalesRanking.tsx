/**
 * Sales Ranking Component - Mobile/Tablet Friendly
 * Location: app/components/dashboards/sales/SalesRanking.tsx
 * ✅ Desktop table + Mobile card view for top 10 customers
 */

import React from "react";

interface RankingRow {
  cust_name: string;
  count: number;
  total_sales: number;
  profit: number;
}

interface SalesRankingProps {
  rankingTableData: RankingRow[];
}

export default function SalesRanking({
  rankingTableData,
}: SalesRankingProps) {
  if (rankingTableData.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-slate-200 shadow-sm">
      <h3 className="text-base lg:text-lg font-bold text-slate-800 mb-4 lg:mb-6 flex items-center gap-2">
        <span className="text-lg lg:text-2xl"></span>
        <span>Customers Leaderboard</span>
      </h3>

      {/* Desktop Table - Hidden on Mobile */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-slate-300 bg-slate-50">
              <th className="px-4 py-3 text-center font-bold text-slate-700 w-16">
                ลำดับ
              </th>
              <th className="px-4 py-3 text-left font-bold text-slate-700">
                ชื่อลูกค้า
              </th>
              <th className="px-4 py-3 text-right font-bold text-slate-700">
                จำนวนครั้ง
              </th>
              <th className="px-4 py-3 text-right font-bold text-slate-700">
                ยอดรวม
              </th>
              <th className="px-4 py-3 text-right font-bold text-slate-700">
                กำไร
              </th>
            </tr>
          </thead>
          <tbody>
            {rankingTableData.map((row, idx) => (
              <tr
                key={idx}
                className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
              >
                <td className="px-4 py-3 text-center font-bold text-slate-800 text-lg">
                  {idx + 1 === 1 && "🥇"}
                  {idx + 1 === 2 && "🥈"}
                  {idx + 1 === 3 && "🥉"}
                  {idx + 1 > 3 && idx + 1}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-800">
                  {row.cust_name}
                </td>
                <td className="px-4 py-3 text-right text-slate-700">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                    {row.count} ครั้ง
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-800">
                  ฿{row.total_sales.toLocaleString("th-TH", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-green-600">
                  ฿{row.profit.toLocaleString("th-TH", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View - Visible on Mobile Only */}
      <div className="lg:hidden space-y-3">
        {rankingTableData.map((row, idx) => (
          <div
            key={idx}
            className={`rounded-lg p-3 border-2 transition-all ${idx < 3
              ? "bg-yellow-50 border-yellow-200"
              : "bg-white border-slate-200"
              }`}
          >
            {/* Header: Rank + Name */}
            <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span
                  className={`text-lg font-bold w-8 h-8 flex items-center justify-center rounded-full ${idx === 0
                    ? "bg-yellow-400 text-white"
                    : idx === 1
                      ? "bg-gray-300 text-white"
                      : idx === 2
                        ? "bg-orange-400 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                >
                  {idx + 1 === 1 ? "🥇" : idx + 1 === 2 ? "🥈" : idx + 1 === 3 ? "🥉" : idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-800 text-sm truncate">{row.cust_name}</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {row.count} ครั้ง
                  </p>
                </div>
              </div>
            </div>
            {/* Stats Grid: 2 columns */}
            <div className="grid grid-cols-2 gap-3">
              {/* Sales */}
              <div className="text-center p-2 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-600 mb-1">ยอดรวม</p>
                <p className="font-bold text-slate-800 text-sm break-words">
                  <span className="mr-0.5">฿</span>
                  {row.total_sales.toLocaleString("th-TH", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </p>
              </div>
              {/* Profit */}
              <div className="text-center p-2 bg-green-50 rounded-lg">
                <p className="text-xs text-slate-600 mb-1">กำไร</p>
                <p className="font-bold text-green-600 text-sm break-words">
                  <span className="mr-0.5">฿</span>
                  {row.profit.toLocaleString("th-TH", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}