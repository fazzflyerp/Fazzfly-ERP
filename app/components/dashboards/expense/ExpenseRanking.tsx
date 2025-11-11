/**
 * Expense Ranking Component
 * Location: app/components/dashboards/expense/ExpenseRanking.tsx
 * ✅ Displays: Top 10 Expense Categories ranking table
 */

import React from "react";

interface RankingRow {
  expense_name: string;
  count: number;
  total_amount: number;
}

interface ExpenseRankingProps {
  rankingTableData: RankingRow[];
}

export default function ExpenseRanking({
  rankingTableData,
}: ExpenseRankingProps) {
  if (rankingTableData.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-md overflow-x-auto">
      <h3 className="text-lg font-bold text-slate-800 mb-4">
        🏆 Top 10 หมวดหมู่ค่าใช้จ่าย
      </h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-slate-300 bg-slate-50">
            <th className="px-4 py-3 text-center font-bold text-slate-700">
              ลำดับ
            </th>
            <th className="px-4 py-3 text-left font-bold text-slate-700">
              หมวดหมู่
            </th>
            <th className="px-4 py-3 text-right font-bold text-slate-700">
              จำนวนครั้ง
            </th>
            <th className="px-4 py-3 text-right font-bold text-slate-700">
              ยอดรวม
            </th>
            <th className="px-4 py-3 text-right font-bold text-slate-700">
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
              <td className="px-4 py-3 text-center font-bold text-slate-800">
                {idx + 1 === 1 && "🥇"}
                {idx + 1 === 2 && "🥈"}
                {idx + 1 === 3 && "🥉"}
                {idx + 1 > 3 && idx + 1}
              </td>
              <td className="px-4 py-3 font-semibold text-slate-800">
                {row.expense_name}
              </td>
              <td className="px-4 py-3 text-right text-slate-700">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                  {row.count} ครั้ง
                </span>
              </td>
              <td className="px-4 py-3 text-right font-semibold text-red-600">
                {row.total_amount.toLocaleString("th-TH", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })} บาท
              </td>
              <td className="px-4 py-3 text-right font-semibold text-slate-700">
                {(row.total_amount / row.count).toLocaleString("th-TH", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })} บาท
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}