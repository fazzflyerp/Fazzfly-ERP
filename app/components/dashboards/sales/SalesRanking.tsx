/**
 * Sales Ranking Component
 * Location: app/components/dashboards/sales/SalesRanking.tsx
 * ✅ Displays: Top 10 Customers ranking table
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
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-md overflow-x-auto">
      <h3 className="text-lg font-bold text-slate-800 mb-4">
        🏆 Top 10 Customers
      </h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-slate-300 bg-slate-50">
            <th className="px-4 py-3 text-center font-bold text-slate-700">
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
              <td className="px-4 py-3 text-center font-bold text-slate-800">
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
                {row.total_sales.toLocaleString("th-TH", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-green-600">
                {row.profit.toLocaleString("th-TH", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}