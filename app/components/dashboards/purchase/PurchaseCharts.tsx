/**
 * Purchase Charts Component - Mobile/Tablet Friendly
 * Location: app/components/dashboards/purchase/PurchaseCharts.tsx
 * ✅ 3D Donut Chart, Line Chart - Fully Responsive
 */

"use client";

import React, { useState } from "react";
import dynamic from 'next/dynamic';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Import Plotly แบบ dynamic เพื่อป้องกัน SSR error
// @ts-ignore
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface PurchaseChartsProps {
  pieChartData: any[];
  lineChartData: any[];
}

const COLORS = [
  "#04469a",
  "#ff7f09",
  "#12b19cff",
  "#2d8bba",
  "#41b8d5",
  "#6ce5e8",
  "#cfcdcd",
  "#696565",
  "#70b8e4ff ",
  "#9fe2eaff",
];

export default function PurchaseCharts({
  pieChartData,
  lineChartData,
}: PurchaseChartsProps) {
  // Detect screen size for responsive chart sizing
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* ============================================================ */}
      {/* 3D Donut Chart: ต้นทุนแยกตามสินค้า */}
      {/* ============================================================ */}
      {pieChartData.length > 0 && (
        <div className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-slate-200 shadow-sm">
          <h3 className="text-base lg:text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="text-lg lg:text-2xl"></span>
            ต้นทุนแยกตามสินค้า
          </h3>

          <div className="w-full" style={{ height: isMobile ? 350 : 450 }}>
            <Plot
              data={[
                {
                  type: 'pie',
                  labels: pieChartData.map(d => d.name),
                  values: pieChartData.map(d => d.value),
                  marker: {
                    colors: COLORS,
                    line: {
                      color: '#0a0a0aff',
                      width: 0
                    }
                  },
                  textinfo: 'none',
                  hovertemplate: '<b>%{label}</b><br>' +
                    'ต้นทุน: %{value:,.0f} บาท<br>' +
                    'สัดส่วน: %{percent}<br>' +
                    '<extra></extra>',
                  hole: 0.4,
                  rotation: 0,
                  direction: 'clockwise',
                  sort: false,
                }
              ]}
              layout={{
                height: isMobile ? 350 : 450,
                showlegend: false,
                margin: { t: 40, b: 40, l: 40, r: 40 },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                font: {
                  family: 'Prompt, sans-serif',
                  color: '#334155'
                }
              }}
              config={{
                displayModeBar: false,
                responsive: true,
                doubleClick: false,
                scrollZoom: false
              }}
              style={{ width: '100%', height: '100%' }}
            />
          </div>

          {/* Legend - แบบเดิม */}
          <div className="mt-4 lg:mt-6">
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 lg:gap-3">
              {[...pieChartData]
                .sort((a, b) => b.value - a.value)
                .map((entry, index) => (
                  <li
                    key={`legend-${index}`}
                    className="flex items-center gap-2 text-xs lg:text-sm text-slate-700 p-2 lg:p-3 bg-slate-50 rounded-lg"
                  >
                    <span
                      className="w-3 h-3 rounded-full shadow-sm flex-shrink-0"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-lg font-bold truncate">{entry.name}</p>
                      <p className="text-slate-500 text-medium font-medium">
                        {entry.value.toLocaleString("th-TH", {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })} บาท (
                        {(
                          (entry.value /
                            pieChartData.reduce((acc, d) => acc + d.value, 0)) *
                          100
                        ).toFixed(1)}
                        %)
                      </p>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Line Chart: แนวโน้มต้นทุนรายวัน - Modern Style */}
      {/* ============================================================ */}
      {lineChartData.length > 0 && (
        <div className="bg-white text-black rounded-xl lg:rounded-2xl p-4 lg:p-8 border border-slate-200 shadow-sm">
          <h3 className="text-lg lg:text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <span className="text-2xl lg:text-3xl"></span>
            <span>แนวโน้มต้นทุนรายวัน</span>
          </h3>
          <ResponsiveContainer width="100%" height={isMobile ? 400 : 550}>
            <LineChart
              data={lineChartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
            >
              {/* Grid */}
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e2e8f0"
                strokeOpacity={0.6}
                vertical={false}
              />

              {/* X-Axis */}
              <XAxis
                dataKey="date"
                stroke="#64748b"
                tick={{ fontSize: isMobile ? 11 : 14, fill: '#475569', fontWeight: 500 }}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1', strokeWidth: 2 }}
                height={70}
                angle={-45}
                textAnchor="end"
                interval={isMobile ? 'preserveStartEnd' : 0}
              />

              {/* Y-Axis */}
              <YAxis
                stroke="#64748b"
                tick={{ fontSize: isMobile ? 12 : 14, fill: '#475569', fontWeight: 500 }}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1', strokeWidth: 2 }}
                width={isMobile ? 60 : 80}
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
                  return value;
                }}
              />

              {/* Tooltip */}
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "none",
                  borderRadius: "12px",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
                  fontSize: "14px",
                  padding: "12px 16px",
                }}
                itemStyle={{
                  color: "#334155",
                  fontWeight: 600,
                  padding: "4px 0",
                  fontSize: "14px"
                }}
                labelStyle={{
                  color: "#0f172a",
                  fontWeight: 700,
                  marginBottom: "8px",
                  fontSize: "15px"
                }}
                cursor={{ stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '5 5' }}
                formatter={(value: any) => {
                  return [`${Number(value).toLocaleString('th-TH')}`, ''];
                }}
              />

              {/* Legend */}
              <Legend
                wrapperStyle={{
                  fontSize: isMobile ? "13px" : "15px",
                  paddingTop: "20px",
                  fontWeight: 600
                }}
                iconType="circle"
                iconSize={10}
              />

              {/* Line: จำนวน */}
              <Line
                type="monotone"
                dataKey="quantity"
                name="จำนวน"
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={{
                  fill: "#3b82f6",
                  strokeWidth: 2,
                  r: 4,
                  stroke: "#ffffff",
                }}
                activeDot={{
                  r: 7,
                  fill: "#3b82f6",
                  stroke: "#ffffff",
                  strokeWidth: 3,
                }}
                isAnimationActive={!isMobile}
              />

              {/* Line: ต้นทุน */}
              <Line
                type="monotone"
                dataKey="cost"
                name="ต้นทุน"
                stroke="#ef4444"
                strokeWidth={2.5}
                dot={{
                  fill: "#ef4444",
                  strokeWidth: 2,
                  r: 4,
                  stroke: "#ffffff",
                }}
                activeDot={{
                  r: 7,
                  fill: "#ef4444",
                  stroke: "#ffffff",
                  strokeWidth: 3,
                }}
                isAnimationActive={!isMobile}
              />
            </LineChart>
          </ResponsiveContainer>

          {/* Summary Stats ด้านล่าง */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <div className="grid grid-cols-2 gap-3 lg:gap-4">
              <div className="text-center p-3 lg:p-4 bg-blue-50 rounded-xl">
                <p className="text-xs lg:text-sm text-slate-600 font-medium mb-1">จำนวนรวม</p>
                <p className="text-base lg:text-xl font-bold text-blue-600">
                  {lineChartData.reduce((sum, d) => sum + (d.quantity || 0), 0).toLocaleString('th-TH')}
                </p>
              </div>
              <div className="text-center p-3 lg:p-4 bg-red-50 rounded-xl">
                <p className="text-xs lg:text-sm text-slate-600 font-medium mb-1">ต้นทุนรวม</p>
                <p className="text-base lg:text-xl font-bold text-red-600">
                  {lineChartData.reduce((sum, d) => sum + (d.cost || 0), 0).toLocaleString('th-TH')} ฿
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}