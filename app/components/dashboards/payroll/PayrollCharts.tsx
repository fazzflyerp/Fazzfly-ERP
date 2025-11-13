/**
 * Payroll Charts Component
 * Location: app/components/dashboards/payroll/PayrollCharts.tsx
 * ✅ Charts: Performance Distribution (Pie), OT Leaders (Vertical Bar), Attendance Issues (Stacked Bar)
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
      {/* Row 1: Performance Distribution (Pie) */}
      <div className="grid grid-cols-1 gap-6">
        {/* Performance Distribution Pie Chart */}
        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            การกระจายคะแนน (Performance Distribution)
          </h3>
          
          {performanceDistribution.length === 0 ? (
            <div className="flex items-center justify-center h-[350px]">
              <p className="text-slate-500">ไม่มีข้อมูล</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={performanceDistribution}
                    cx="50%"
                    cy="45%"
                    labelLine={false}
                    label={false}
                    outerRadius={115}
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
                      border: "2px solid #e2e8f0",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Beautiful Legend Grid */}
              <div className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(GRADE_COLORS).map(([grade, color]) => {
                  const data = performanceDistribution.find((d) => d.grade === grade);
                  const count = data?.count || 0;
                  const percentage = data?.percentage || 0;
                  return (
                    <div
                      key={grade}
                      className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-4 border-2 border-slate-200 hover:border-slate-400 hover:shadow-lg transition-all duration-200 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="w-6 h-6 rounded-full shadow-md flex-shrink-0"
                          style={{ backgroundColor: color }}
                        ></div>
                        <span className="text-xs font-bold text-slate-600 uppercase">{grade}</span>
                      </div>
                      <div className="ml-9">
                        <div className="text-2xl font-bold text-slate-900">{count}</div>
                        <div className="text-xs text-slate-500">
                          <span className="font-semibold text-slate-600">{percentage.toFixed(1)}%</span>
                          <span className="text-slate-400"> </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Row 2: OT Leaders + Attendance Issues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* OT Leaders Bar Chart - Vertical with OT Minutes */}
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
              <BarChart data={otLeaders}>
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
                  formatter={(value: any) => formatMinutes(Number(value))}
                />
                <Bar
                  dataKey="ot"
                  fill="#8b5cf6"
                  radius={[8, 8, 0, 0]}
                  label={{
                    position: "top",
                    fontSize: 11,
                    formatter: (value: any) => formatMinutes(Number(value)),
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