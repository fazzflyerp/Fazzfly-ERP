/**
 * Payroll Charts Component
 * Location: app/components/dashboards/payroll/PayrollCharts.tsx
 * ✅ Charts: Performance Distribution (Pie), Top Performers (Bar), OT Leaders (Bar), Attendance Issues (Stacked Bar)
 */

"use client";

import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { getPerformanceGrade } from "@/app/components/dashboards/payroll/payrollUtils";

interface PayrollChartsProps {
  performanceDistribution: any[];
  topPerformers: any[];
  otLeaders: any[];
  attendanceData: any[];
}

// 🎨 Performance Grade Colors
const GRADE_COLORS: Record<string, string> = {
  "A (90-100)": "#10b981",  // 🟢 Green
  "B (80-89)": "#3b82f6",   // 🔵 Blue
  "C (70-79)": "#eab308",   // 🟡 Yellow
  "D (60-69)": "#f59e0b",   // 🟠 Orange
  "F (<60)": "#ef4444",     // 🔴 Red
};

export default function PayrollCharts({
  performanceDistribution,
  topPerformers,
  otLeaders,
  attendanceData,
}: PayrollChartsProps) {
  const formatMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="space-y-6">
      {/* Row 1: Performance Distribution (Pie) + Top Performers (Bar) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Distribution Pie Chart */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            การกระจายคะแนน (Performance Distribution)
          </h3>
          
          {performanceDistribution.length === 0 ? (
            <div className="flex items-center justify-center h-[300px]">
              <p className="text-slate-500">ไม่มีข้อมูล</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={performanceDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.grade}: ${entry.count}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {performanceDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={GRADE_COLORS[entry.grade] || "#64748b"} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string, props: any) => [
                    `${value} คน (${props.payload.percentage.toFixed(1)}%)`,
                    props.payload.grade,
                  ]}
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}

          {/* Legend */}
          <div className="mt-4 space-y-2">
            {Object.entries(GRADE_COLORS).map(([grade, color]) => {
              const data = performanceDistribution.find((d) => d.grade === grade);
              return (
                <div key={grade} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: color }}
                    ></div>
                    <span className="text-sm text-slate-700">{grade}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">
                    {data?.count || 0} คน
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Performers Bar Chart */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            พนักงานยอดเยี่ยม (Top 10)
          </h3>

          {topPerformers.length === 0 ? (
            <div className="flex items-center justify-center h-[300px]">
              <p className="text-slate-500">ไม่มีข้อมูล</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topPerformers} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value: any) => [`${Number(value).toFixed(1)} คะแนน`]}
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                  }}
                />
                <Bar
                  dataKey="score"
                  fill="#10b981"
                  radius={[0, 8, 8, 0]}
                  label={{ position: "right", fontSize: 11 }}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 2: OT Leaders (Bar) + Attendance Issues (Stacked Bar) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* OT Leaders Bar Chart */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="text-2xl">⏱️</span>
            พนักงาน OT สูงสุด (Top 10)
          </h3>

          {otLeaders.length === 0 ? (
            <div className="flex items-center justify-center h-[300px]">
              <p className="text-slate-500">ไม่มีข้อมูล</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={otLeaders} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value: any) => [formatMinutes(Number(value))]}
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                  }}
                />
                <Bar
                  dataKey="ot"
                  fill="#8b5cf6"
                  radius={[0, 8, 8, 0]}
                  label={{ 
                    position: "right", 
                    fontSize: 11, 
                    formatter: (value: any) => formatMinutes(Number(value))
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Attendance Issues Stacked Bar Chart */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="text-2xl">📊</span>
            ปัญหาการเข้างาน (สาย + ลา)
          </h3>

          {attendanceData.length === 0 ? (
            <div className="flex items-center justify-center h-[300px]">
              <p className="text-slate-500">ไม่มีข้อมูล</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Bar
                  dataKey="late"
                  name="สาย (นาที)"
                  fill="#ef4444"
                  stackId="a"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="leave"
                  name="ลา (วัน)"
                  fill="#f59e0b"
                  stackId="a"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}