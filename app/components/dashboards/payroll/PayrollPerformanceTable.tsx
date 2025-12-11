/**
 * Payroll Performance Table Component - Mobile/Tablet Friendly
 * Location: app/components/dashboards/payroll/PayrollPerformanceTable.tsx
 * ✅ Displays: Employee performance ranking with responsive design
 */

"use client";

import React from "react";
import { getPerformanceGrade } from "@/app/components/dashboards/payroll/payrollUtils";

interface PerformanceTableRow {
  rank: number;
  name: string;
  salary: number;
  late: number;
  leave: number;
  ot: number;
  advPayments: number;
  lateScore: number;
  leaveScore: number;
  otScore: number;
  totalScore: number;
  grade: string;
  gradeColor: string;
}

interface PayrollPerformanceTableProps {
  performanceTable: PerformanceTableRow[];
}

export default function PayrollPerformanceTable({
  performanceTable,
}: PayrollPerformanceTableProps) {
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (performanceTable.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl lg:rounded-2xl p-4 lg:p-6 text-center">
        <p className="text-yellow-700 font-semibold text-sm lg:text-base">⚠️ ไม่มีข้อมูล</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl lg:rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 lg:p-6 border-b border-slate-200 bg-gradient-to-r from-purple-50 to-pink-50">
        <h3 className="text-base lg:text-lg font-bold text-slate-800 flex items-center gap-2 mb-1">
          <span className="text-lg lg:text-2xl"></span>
          <span>ตารางอันดับพนักงาน (Performance Ranking)</span>
        </h3>
        <p className="text-xs lg:text-sm text-slate-600">
          เรียงตามคะแนนรวม (สาย 30 + ลา 30 + OT 40 = 100 คะแนน)
        </p>
      </div>

      {/* Desktop Table - Hidden on Mobile */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 border-b border-slate-200">
                อันดับ
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 border-b border-slate-200">
                ชื่อพนักงาน
              </th>
              <th className="px-4 py-3 text-right text-xs font-bold text-slate-700 border-b border-slate-200">
                เงินเดือน
              </th>
              <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 border-b border-slate-200">
                สาย (นาที)
              </th>
              <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 border-b border-slate-200">
                ลา (วัน)
              </th>
              <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 border-b border-slate-200">
                OT (นาที)
              </th>
              <th className="px-4 py-3 text-right text-xs font-bold text-slate-700 border-b border-slate-200">
                เบิกเงิน
              </th>
              <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 border-b border-slate-200">
                คะแนนสาย
              </th>
              <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 border-b border-slate-200">
                คะแนนลา
              </th>
              <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 border-b border-slate-200">
                คะแนนOT
              </th>
              <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 border-b border-slate-200">
                รวม
              </th>
              <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 border-b border-slate-200">
                เกรด
              </th>
            </tr>
          </thead>
          <tbody>
            {performanceTable.map((row) => (
              <tr
                key={row.rank}
                className={`hover:bg-slate-50 transition-colors ${
                  row.rank <= 3 ? "bg-yellow-50" : ""
                }`}
              >
                <td className="px-4 py-3 text-center border-b border-slate-100">
                  <span
                    className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                      row.rank === 1
                        ? "bg-yellow-400 text-white"
                        : row.rank === 2
                        ? "bg-gray-300 text-white"
                        : row.rank === 3
                        ? "bg-orange-400 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : row.rank}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-slate-800 border-b border-slate-100">
                  {row.name}
                </td>
                <td className="px-4 py-3 text-sm text-right text-slate-700 border-b border-slate-100">
                  {formatCurrency(row.salary)}
                </td>
                <td className="px-4 py-3 text-center border-b border-slate-100">
                  <span className="text-sm font-medium text-slate-700">
                    {row.late > 0 ? formatMinutes(row.late) : "-"}
                  </span>
                </td>
                <td className="px-4 py-3 text-center border-b border-slate-100">
                  <span className="text-sm font-medium text-slate-700">
                    {row.leave > 0 ? `${row.leave} วัน` : "-"}
                  </span>
                </td>
                <td className="px-4 py-3 text-center border-b border-slate-100">
                  <span className="text-sm font-medium text-slate-700">
                    {row.ot > 0 ? formatMinutes(row.ot) : "-"}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-right text-slate-700 border-b border-slate-100">
                  {row.advPayments > 0 ? formatCurrency(row.advPayments) : "-"}
                </td>
                <td className="px-4 py-3 text-center border-b border-slate-100">
                  <span
                    className={`text-sm font-bold ${
                      row.lateScore >= 27
                        ? "text-green-600"
                        : row.lateScore >= 22
                        ? "text-yellow-600"
                        : row.lateScore >= 15
                        ? "text-orange-600"
                        : "text-red-600"
                    }`}
                  >
                    {row.lateScore}
                  </span>
                </td>
                <td className="px-4 py-3 text-center border-b border-slate-100">
                  <span
                    className={`text-sm font-bold ${
                      row.leaveScore >= 27
                        ? "text-green-600"
                        : row.leaveScore >= 22
                        ? "text-yellow-600"
                        : row.leaveScore >= 15
                        ? "text-orange-600"
                        : "text-red-600"
                    }`}
                  >
                    {row.leaveScore}
                  </span>
                </td>
                <td className="px-4 py-3 text-center border-b border-slate-100">
                  <span
                    className={`text-sm font-bold ${
                      row.otScore >= 35
                        ? "text-green-600"
                        : row.otScore >= 30
                        ? "text-blue-600"
                        : row.otScore >= 20
                        ? "text-yellow-600"
                        : "text-orange-600"
                    }`}
                  >
                    {row.otScore}
                  </span>
                </td>
                <td className="px-4 py-3 text-center border-b border-slate-100">
                  <span className="text-lg font-bold text-slate-800">
                    {row.totalScore.toFixed(1)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center border-b border-slate-100">
                  <span
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold"
                    style={{
                      backgroundColor: `${row.gradeColor}20`,
                      color: row.gradeColor,
                    }}
                  >
                    {row.grade}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View - Visible on Mobile Only */}
      <div className="lg:hidden space-y-3 p-4">
        {performanceTable.map((row) => (
          <div
            key={row.rank}
            className={`rounded-lg p-3 border-2 ${
              row.rank <= 3
                ? "bg-yellow-50 border-yellow-200"
                : "bg-white border-slate-200"
            }`}
          >
            {/* Header Row */}
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm flex-shrink-0 ${
                    row.rank === 1
                      ? "bg-yellow-400 text-white"
                      : row.rank === 2
                      ? "bg-gray-300 text-white"
                      : row.rank === 3
                      ? "bg-orange-400 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : row.rank}
                </span>
                <div>
                  <p className="font-bold text-slate-800 text-sm">{row.name}</p>
                  <p className="text-xs text-slate-600">เงินเดือน: {formatCurrency(row.salary)}</p>
                </div>
              </div>
              <span
                className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold"
                style={{
                  backgroundColor: `${row.gradeColor}20`,
                  color: row.gradeColor,
                }}
              >
                {row.grade}
              </span>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {/* Attendance */}
              <div className="text-center">
                <p className="text-xs text-slate-600 mb-1">สาย</p>
                <p className="text-xs font-bold text-slate-800">
                  {row.late > 0 ? formatMinutes(row.late) : "-"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-600 mb-1">ลา</p>
                <p className="text-xs font-bold text-slate-800">
                  {row.leave > 0 ? `${row.leave}d` : "-"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-600 mb-1">OT</p>
                <p className="text-xs font-bold text-slate-800">
                  {row.ot > 0 ? formatMinutes(row.ot) : "-"}
                </p>
              </div>
            </div>

            {/* Scores */}
            <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-200">
              <div className="text-center">
                <p className="text-xs text-slate-600 mb-1">สาย</p>
                <p className={`text-xs font-bold ${
                  row.lateScore >= 27
                    ? "text-green-600"
                    : row.lateScore >= 22
                    ? "text-yellow-600"
                    : row.lateScore >= 15
                    ? "text-orange-600"
                    : "text-red-600"
                }`}>
                  {row.lateScore}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-600 mb-1">ลา</p>
                <p className={`text-xs font-bold ${
                  row.leaveScore >= 27
                    ? "text-green-600"
                    : row.leaveScore >= 22
                    ? "text-yellow-600"
                    : row.leaveScore >= 15
                    ? "text-orange-600"
                    : "text-red-600"
                }`}>
                  {row.leaveScore}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-600 mb-1">OT</p>
                <p className={`text-xs font-bold ${
                  row.otScore >= 35
                    ? "text-green-600"
                    : row.otScore >= 30
                    ? "text-blue-600"
                    : row.otScore >= 20
                    ? "text-yellow-600"
                    : "text-orange-600"
                }`}>
                  {row.otScore}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-600 mb-1">รวม</p>
                <p className="text-sm font-bold text-slate-800">
                  {row.totalScore.toFixed(1)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}