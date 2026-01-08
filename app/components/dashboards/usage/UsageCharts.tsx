/**
 * Usage Charts Component - Mobile/Tablet Friendly
 * Location: app/components/dashboards/usage/UsageCharts.tsx
 * ✅ 3D Donut Chart: Cost by Product
 * ✅ Line Chart: Daily Trend (Cost)
 * ✅ Fully Responsive
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

interface UsageChartsProps {
  pieChartData: any[];
  lineChartData: any[];
}

// ใช้สีเดียวกับ Sales
const COLORS = [
  "#04469a", 
  "#ff7f09", 
  "#12b19cff",  
  "#2d8bba",  
  "#41b8d5", 
  "#6ce5e8",
  "#cfcdcd", 
  "#696565",
  "#70b8e4ff",
  "#9fe2eaff",   
];

export default function UsageCharts({
  pieChartData,
  lineChartData,
}: UsageChartsProps) {
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
      {/* 3D Donut Chart: ต้นทุนต่อ Product */}
      {/* ============================================================ */}
      {pieChartData.length > 0 && (
        <div className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-slate-200 shadow-sm">
          <h3 className="text-base lg:text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
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
                                 'ต้นทุน: %{value:,.0f} ฿<br>' +
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
            <ul className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {[...pieChartData]
                .sort((a, b) => b.value - a.value)
                .map((entry, index) => (
                  <li
                    key={`legend-${index}`}
                    className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs lg:text-lg font-medium text-slate-800 truncate">
                        {entry.name}
                      </p>
                      <p className="text-sm text-slate-500">
                        {entry.value.toLocaleString("th-TH")} ฿
                        <span className="ml-1 text-slate-400">
                          ({((entry.value / pieChartData.reduce((acc, d) => acc + d.value, 0)) * 100).toFixed(1)}%)
                        </span>
                      </p>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Line Chart: Daily Usage Trend */}
      {/* ============================================================ */}
      {lineChartData.length > 0 && (
        <div className="bg-white rounded-xl text-black lg:rounded-2xl p-4 lg:p-6 border border-slate-200 shadow-sm">
          <h3 className="text-base lg:text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="text-lg lg:text-2xl"></span>
            <span>แนวโน้มต้นทุนรายวัน</span>
          </h3>

          <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
            <LineChart data={lineChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} width={isMobile ? 35 : 45} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />

              {/* ✔ Only cost line remains */}
              <Line
                type="monotone"
                dataKey="cost"
                name="ต้นทุน"
                stroke="#ef4444"
                dot={false}
                strokeWidth={2}
                isAnimationActive={!isMobile}
              />
            </LineChart>
          </ResponsiveContainer>
              {/* Summary Stats */}
    <div className="mt-6 pt-6 border-t border-slate-200">
      <div className="text-center p-4 bg-red-50 rounded-xl">
        <p className="text-xs lg:text-sm text-slate-600 font-medium mb-1">ต้นทุนรวม</p>
        <p className="text-xl lg:text-2xl font-bold text-red-600">
          {lineChartData.reduce((sum, d) => sum + (d.cost || 0), 0).toLocaleString('th-TH')} ฿
        </p>
      </div>
      </div>
        </div>
      )}
    </div>
  );
}