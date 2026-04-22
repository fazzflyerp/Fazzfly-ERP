/**
 * Overview Dashboard
 * Location: app/components/dashboards/overview/OverviewDashboard.tsx
 *
 * แสดง KPI ภาพรวมจากทุก dashboard ของ Admin ก่อนเข้าเลือก module
 * Admin only
 */

"use client";

import { useEffect, useState } from "react";

interface DashboardItem {
  dashboardId: string;
  dashboardName: string;
  spreadsheetId: string;
  sheetName: string;
  dashboardConfigName: string;
}

interface DashboardSummary {
  dashboardName: string;
  icon: string;
  color: string;
  metrics: { label: string; value: string; sub?: string }[];
  loading: boolean;
  error?: string;
}

// ── ตัวช่วย ─────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 1_000_000) return "฿" + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return "฿" + (n / 1_000).toFixed(0) + "K";
  return "฿" + n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + "K";
  return n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

function parseNum(v: any): number {
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  const n = parseFloat(String(v || "").replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

/** ตรวจจาก dashboardName/configName ว่า dashboard นี้เป็นประเภทไหน */
function detectType(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("sales") || n.includes("ขาย"))       return "sales";
  if (n.includes("purchase") || n.includes("ซื้อ"))   return "purchase";
  if (n.includes("expense") || n.includes("ค่าใช้"))  return "expense";
  if (n.includes("payroll") || n.includes("เงินเดือน")) return "payroll";
  if (n.includes("inventory") || n.includes("สต๊อก") || n.includes("คลัง")) return "inventory";
  if (n.includes("financial") || n.includes("การเงิน")) return "financial";
  if (n.includes("usage") || n.includes("การใช้"))    return "usage";
  return "general";
}

const TYPE_META: Record<string, { icon: string; color: string; gradient: string }> = {
  sales:     { icon: "💰", color: "text-emerald-600", gradient: "from-emerald-50 to-teal-50 border-emerald-200" },
  purchase:  { icon: "🛒", color: "text-blue-600",    gradient: "from-blue-50 to-sky-50 border-blue-200" },
  expense:   { icon: "💸", color: "text-rose-600",    gradient: "from-rose-50 to-pink-50 border-rose-200" },
  payroll:   { icon: "👥", color: "text-violet-600",  gradient: "from-violet-50 to-purple-50 border-violet-200" },
  inventory: { icon: "📦", color: "text-amber-600",   gradient: "from-amber-50 to-yellow-50 border-amber-200" },
  financial: { icon: "📊", color: "text-indigo-600",  gradient: "from-indigo-50 to-blue-50 border-indigo-200" },
  usage:     { icon: "📈", color: "text-cyan-600",    gradient: "from-cyan-50 to-sky-50 border-cyan-200" },
  general:   { icon: "📋", color: "text-slate-600",   gradient: "from-slate-50 to-gray-50 border-slate-200" },
};

/** หา period ล่าสุดจาก data */
function getLatestPeriod(data: any[], config: any[]): string | null {
  const pField = config.find((f: any) => f.type === "period");
  if (!pField) return null;
  const periods = [...new Set(data.map((r) => String(r[pField.fieldName] || "").trim()).filter(Boolean))].sort();
  return periods[periods.length - 1] || null;
}

/** สรุป metrics จาก data + config */
function summarize(data: any[], config: any[], type: string): { label: string; value: string; sub?: string }[] {
  const numberFields = config.filter((f: any) => f.type === "number");
  if (data.length === 0 || numberFields.length === 0) return [{ label: "รายการ", value: fmtNum(data.length) + " รายการ" }];

  // กรอง period ล่าสุด
  const latestPeriod = getLatestPeriod(data, config);
  const filtered = latestPeriod
    ? data.filter((r) => {
        const pField = config.find((f: any) => f.type === "period");
        return pField ? String(r[pField.fieldName] || "").trim() === latestPeriod : true;
      })
    : data;

  const metrics: { label: string; value: string; sub?: string }[] = [];

  // เลือก field ที่สำคัญตาม type
  const priority: Record<string, string[]> = {
    sales:     ["total_sales", "profit", "cost"],
    purchase:  ["total_purchase", "total", "amount", "cost"],
    expense:   ["amount", "total", "expense"],
    payroll:   ["net_pay", "salary", "total", "gross_pay"],
    financial: ["revenue", "income", "total_sales", "expense", "total"],
    inventory: [],
    usage:     ["total_sales", "revenue", "amount"],
    general:   [],
  };

  const picked = priority[type] || [];

  if (type === "inventory") {
    // นับสินค้าที่ใกล้หมด
    const statusField = config.find((f: any) => f.type === "status" || f.fieldName.toLowerCase().includes("status"));
    const lowStatuses = ["สต๊อกต่ำ", "ใกล้หมด", "หมดแล้ว"];
    const lowCount = statusField
      ? data.filter((r) => lowStatuses.includes(String(r[statusField.fieldName] || "").trim())).length
      : 0;
    metrics.push({ label: "สินค้าทั้งหมด", value: fmtNum(data.length) + " รายการ" });
    if (lowCount > 0) metrics.push({ label: "ใกล้หมด/หมด", value: fmtNum(lowCount) + " รายการ", sub: "⚠️ ต้องสั่งเพิ่ม" });
    return metrics;
  }

  // หา fields ตาม priority
  const shown = new Set<string>();
  for (const key of picked) {
    const f = numberFields.find((nf: any) => nf.fieldName.toLowerCase() === key.toLowerCase());
    if (f && !shown.has(f.fieldName)) {
      const sum = filtered.reduce((s: number, r: any) => s + parseNum(r[f.fieldName]), 0);
      if (sum !== 0) {
        metrics.push({ label: f.label || f.fieldName, value: fmt(sum), sub: latestPeriod ? `${latestPeriod}` : undefined });
        shown.add(f.fieldName);
      }
      if (metrics.length >= 2) break;
    }
  }

  // fallback: ใช้ number fields แรกๆ
  if (metrics.length === 0) {
    for (const f of numberFields.slice(0, 2)) {
      const sum = filtered.reduce((s: number, r: any) => s + parseNum(r[f.fieldName]), 0);
      if (sum !== 0) {
        metrics.push({ label: f.label || f.fieldName, value: fmt(sum) });
      }
    }
  }

  if (metrics.length === 0) {
    metrics.push({ label: "รายการ", value: fmtNum(filtered.length) + " รายการ", sub: latestPeriod || undefined });
  }

  return metrics;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function OverviewDashboard({ dashboardItems, dark = false }: { dashboardItems: DashboardItem[]; dark?: boolean }) {
  const [summaries, setSummaries] = useState<DashboardSummary[]>([]);

  useEffect(() => {
    if (!dashboardItems || dashboardItems.length === 0) return;

    // init loading state
    setSummaries(
      dashboardItems.map((d) => {
        const type = detectType(d.dashboardName + " " + d.dashboardConfigName);
        const meta = TYPE_META[type] || TYPE_META.general;
        return {
          dashboardName: d.dashboardName,
          icon: meta.icon,
          color: meta.color,
          metrics: [],
          loading: true,
        };
      })
    );

    // fetch each dashboard
    dashboardItems.forEach((d, idx) => {
      const url = `/api/dashboard/data?spreadsheetId=${encodeURIComponent(d.spreadsheetId)}&configSheetName=${encodeURIComponent(d.dashboardConfigName)}&dataSheetName=${encodeURIComponent(d.sheetName)}`;

      fetch(url)
        .then((r) => r.json())
        .then((data) => {
          const type = detectType(d.dashboardName + " " + d.dashboardConfigName);
          const metrics = data.data && data.config
            ? summarize(data.data, data.config, type)
            : [{ label: "ไม่พบข้อมูล", value: "-" }];

          setSummaries((prev) =>
            prev.map((s, i) =>
              i === idx ? { ...s, metrics, loading: false } : s
            )
          );
        })
        .catch(() => {
          setSummaries((prev) =>
            prev.map((s, i) =>
              i === idx ? { ...s, metrics: [{ label: "โหลดไม่สำเร็จ", value: "-" }], loading: false, error: "error" } : s
            )
          );
        });
    });
  }, [dashboardItems]);

  if (!dashboardItems || dashboardItems.length === 0) return null;

  const cardBg = dark
    ? "bg-white/5 border-white/10 hover:bg-white/8"
    : "bg-gradient-to-br border hover:shadow-md";

  const labelColor  = dark ? "text-slate-400" : "text-slate-500";
  const subColor    = dark ? "text-slate-500" : "text-slate-400";
  const titleColor  = dark ? "text-slate-300" : "text-slate-600";
  const headingColor = dark ? "text-white" : "text-slate-800";
  const subheadColor = dark ? "text-slate-500" : "text-slate-400";

  return (
    <div className="mb-0">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🏢</span>
        <h2 className={`text-lg lg:text-xl font-bold ${headingColor}`}>ภาพรวมธุรกิจ</h2>
        <span className={`text-xs font-normal ${subheadColor}`}>ข้อมูลล่าสุด</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
        {summaries.map((s, i) => {
          const type = detectType(dashboardItems[i].dashboardName + " " + dashboardItems[i].dashboardConfigName);
          const meta = TYPE_META[type] || TYPE_META.general;

          return (
            <div
              key={i}
              className={`${dark ? "bg-white/5 border border-white/10 hover:bg-white/8" : `bg-gradient-to-br ${meta.gradient} border`} rounded-2xl p-4 lg:p-5 transition-all`}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{meta.icon}</span>
                <p className={`text-xs font-semibold truncate ${titleColor}`}>{s.dashboardName}</p>
              </div>

              {s.loading ? (
                <div className="space-y-2">
                  <div className={`h-6 ${dark ? "bg-white/10" : "bg-white/60"} rounded animate-pulse`} />
                  <div className={`h-4 ${dark ? "bg-white/5" : "bg-white/40"} rounded animate-pulse w-2/3`} />
                </div>
              ) : (
                <div className="space-y-2">
                  {s.metrics.map((m, mi) => (
                    <div key={mi}>
                      <p className={`text-xs ${labelColor}`}>{m.label}</p>
                      <p className={`text-lg font-bold ${dark ? "text-white" : meta.color}`}>{m.value}</p>
                      {m.sub && <p className={`text-xs ${subColor}`}>{m.sub}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
