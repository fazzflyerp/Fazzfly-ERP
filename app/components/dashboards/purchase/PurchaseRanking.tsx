/**
 * Purchase Ranking Component - Mobile/Tablet Friendly
 * Location: app/components/dashboards/purchase/PurchaseRanking.tsx
 * ✅ Top 10 Suppliers by Total Cost
 * ✅ Desktop: Table view | Mobile: Card view
 */

import React from "react";

interface RankingRow {
  supplier_name: string;
  count: number;
  total_cost: number;
}

interface PurchaseRankingProps {
  rankingTableData: RankingRow[];
}

export default function PurchaseRanking({
  rankingTableData,
}: PurchaseRankingProps) {

  if (!rankingTableData || rankingTableData.length === 0) {
    return null;
  }

  return (
    <>
      {/* Desktop Table - Hidden on Mobile */}
      <div className="hidden lg:block bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-slate-200 shadow-sm overflow-x-auto">
        <h3 className="text-base lg:text-lg font-bold text-slate-800 mb-4">
          Suppliers Leaderboard
        </h3>
        <table className="w-full text-xs lg:text-sm">
          <thead>
            <tr className="border-b-2 border-slate-300 bg-slate-50">
              <th className="px-2 lg:px-4 py-2 lg:py-3 text-center font-bold text-slate-700">
                ลำดับ
              </th>
              <th className="px-2 lg:px-4 py-2 lg:py-3 text-left font-bold text-slate-700">
                ผู้ขาย
              </th>
              <th className="px-2 lg:px-4 py-2 lg:py-3 text-right font-bold text-slate-700 whitespace-nowrap">
                จำนวนครั้ง
              </th>
              <th className="px-2 lg:px-4 py-2 lg:py-3 text-right font-bold text-slate-700 whitespace-nowrap">
                ยอดรวม
              </th>
              <th className="px-2 lg:px-4 py-2 lg:py-3 text-right font-bold text-slate-700 whitespace-nowrap">
                เฉลี่ย/ครั้ง
              </th>
            </tr>
          </thead>
          <tbody>
            {rankingTableData.map((row, idx) => (
              <tr
                key={idx}
                className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
              >
                <td className="px-2 lg:px-4 py-2 lg:py-3 text-center text-black font-bold text-slate-800">
                  {idx + 1 === 1 && "🥇"}
                  {idx + 1 === 2 && "🥈"}
                  {idx + 1 === 3 && "🥉"}
                  {idx + 1 > 3 && idx + 1}
                </td>
                <td className="px-2 lg:px-4 py-2 lg:py-3 font-semibold text-slate-800 truncate">
                  {row.supplier_name}
                </td>
                <td className="px-2 lg:px-4 py-2 lg:py-3 text-right text-slate-700 whitespace-nowrap text-xs lg:text-sm">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                    {row.count}
                  </span>
                </td>
                <td className="px-2 lg:px-4 py-2 lg:py-3 text-right font-semibold text-red-600 whitespace-nowrap text-xs lg:text-sm">
                  {row.total_cost.toLocaleString("th-TH", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })} ฿
                </td>
                <td className="px-2 lg:px-4 py-2 lg:py-3 text-right font-semibold text-slate-700 whitespace-nowrap text-xs lg:text-sm">
                  {(row.total_cost / row.count).toLocaleString("th-TH", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })} ฿
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View - Hidden on Desktop */}
      <div className="lg:hidden bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
        <h3 className="text-base font-bold text-slate-800 mb-4">
          Suppliers Leaderboard
        </h3>
        <div className="space-y-3">
          {rankingTableData.map((row, idx) => (
            <div
              key={idx}
              className="border border-slate-100 rounded-lg p-3 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">
                    {idx + 1 === 1 && "🥇"}
                    {idx + 1 === 2 && "🥈"}
                    {idx + 1 === 3 && "🥉"}
                    {idx + 1 > 3 && <span className="text-sm text-black bg-slate-100 px-2 py-0.5 rounded">{idx + 1}</span>}
                  </span>
                  <span className="font-semibold text-slate-800 truncate flex-1">
                    {row.supplier_name}
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="flex flex-col">
                  <span className="text-slate-500">จำนวนครั้ง</span>
                  <span className="font-bold text-blue-700">{row.count}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-500">ยอดรวม</span>
                  <span className="font-bold text-red-600">
                    {row.total_cost.toLocaleString("th-TH", {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })} ฿
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-500">เฉลี่ย</span>
                  <span className="font-bold text-slate-700">
                    {(row.total_cost / row.count).toLocaleString("th-TH", {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })} ฿
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}