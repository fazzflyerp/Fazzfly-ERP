/**
 * Overview Dashboard
 * Location: app/components/dashboards/overview/OverviewDashboard.tsx
 *
 * แสดง KPI ภาพรวมจากทุก dashboard ของ Admin ก่อนเข้าเลือก module
 * Admin only
 */

"use client";

import React, { useEffect, useState } from "react";

interface DashboardItem {
  dashboardId: string;
  dashboardName: string;
  spreadsheetId: string;
  sheetName: string;
  dashboardConfigName: string;
}

interface DashboardSummary {
  dashboardName: string;
  icon: React.ReactNode;
  color: string;
  metrics: { label: string; value: string; sub?: string }[];
  donut?: { cost: number; profit: number; revenue: number; period?: string; profitLabel?: string; revenueLabel?: string; costLabel?: string };
  usageDonut?: { items: { label: string; count: number; pct: number }[]; total: number; period?: string };
  expenseDonut?: { items: { label: string; amount: number; pct: number }[]; total: number; period?: string };
  loading: boolean;
  error?: string;
}

// ── ตัวช่วย ─────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 1_000_000) return "฿" + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return "฿" + (n / 1_000).toFixed(0) + "K";
  return "฿" + n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}
function fmtFull(n: number): string {
  return "฿" + Math.round(n).toLocaleString("th-TH");
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
  if (n.includes("usage") || n.includes("การใช้") || n.includes("จ่ายยา") || n.includes("ยา") || n.includes("usagetransaction")) return "usage";
  return "general";
}

const IcSales = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const IcPurchase = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);
const IcExpense = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);
const IcPayroll = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const IcInventory = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);
const IcFinancial = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);
const IcUsage = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);
const IcGeneral = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);
const IcBuilding = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const TYPE_META: Record<string, { icon: React.ReactNode; color: string; iconBg: string; gradient: string }> = {
  sales:     { icon: <IcSales />,     color: "text-emerald-700", iconBg: "bg-emerald-500", gradient: "from-white to-emerald-50/60 border-emerald-100" },
  purchase:  { icon: <IcPurchase />,  color: "text-sky-700",     iconBg: "bg-sky-500",     gradient: "from-white to-sky-50/60 border-sky-100" },
  expense:   { icon: <IcExpense />,   color: "text-rose-700",    iconBg: "bg-rose-500",    gradient: "from-white to-rose-50/60 border-rose-100" },
  payroll:   { icon: <IcPayroll />,   color: "text-violet-700",  iconBg: "bg-violet-500",  gradient: "from-white to-violet-50/60 border-violet-100" },
  inventory: { icon: <IcInventory />, color: "text-amber-700",   iconBg: "bg-amber-500",   gradient: "from-white to-amber-50/60 border-amber-100" },
  financial: { icon: <IcFinancial />, color: "text-indigo-700",  iconBg: "bg-indigo-500",  gradient: "from-white to-indigo-50/60 border-indigo-100" },
  usage:     { icon: <IcUsage />,     color: "text-cyan-700",    iconBg: "bg-cyan-500",    gradient: "from-white to-cyan-50/60 border-cyan-100" },
  general:   { icon: <IcGeneral />,   color: "text-slate-700",   iconBg: "bg-slate-400",   gradient: "from-white to-slate-50/60 border-slate-100" },
};

// แปลง period string → number สำหรับ sort
const THAI_MONTHS: Record<string, number> = {
  "ม.ค.": 1, "มกราคม": 1,
  "ก.พ.": 2, "กุมภาพันธ์": 2,
  "มี.ค.": 3, "มีนาคม": 3,
  "เม.ย.": 4, "เมษายน": 4,
  "พ.ค.": 5, "พฤษภาคม": 5,
  "มิ.ย.": 6, "มิถุนายน": 6,
  "ก.ค.": 7, "กรกฎาคม": 7,
  "ส.ค.": 8, "สิงหาคม": 8,
  "ก.ย.": 9, "กันยายน": 9,
  "ต.ค.": 10, "ตุลาคม": 10,
  "พ.ย.": 11, "พฤศจิกายน": 11,
  "ธ.ค.": 12, "ธันวาคม": 12,
};

function periodToNum(p: string): number {
  // ISO: "2026-04" → 202604
  const iso = p.match(/^(\d{4})-(\d{2})$/);
  if (iso) return parseInt(iso[1]) * 100 + parseInt(iso[2]);

  // MM/YYYY: "04/2026" → 202604
  const slash = p.match(/^(\d{1,2})\/(\d{4})$/);
  if (slash) return parseInt(slash[2]) * 100 + parseInt(slash[1]);

  // Thai: "เม.ย. 2026" หรือ "เมษายน 2569"
  const yearMatch = p.match(/(\d{4})/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);
    const ce = year > 2400 ? year - 543 : year;
    for (const [key, month] of Object.entries(THAI_MONTHS)) {
      if (p.includes(key)) return ce * 100 + month;
    }
    return ce * 100;
  }
  return 0;
}

/** หา period ล่าสุดจาก data */
function getLatestPeriod(data: any[], config: any[]): string | null {
  const pField = config.find((f: any) => f.type === "period");
  if (!pField) return null;
  const periods = [...new Set(data.map((r) => String(r[pField.fieldName] || "").trim()).filter(Boolean))];
  if (periods.length === 0) return null;
  return periods.sort((a, b) => periodToNum(a) - periodToNum(b)).at(-1) || null;
}

/** helper: กรอง period ล่าสุด + หา field แล้วรวมค่า */
function buildDonutBase(data: any[], config: any[]) {
  const numFields = config.filter((f: any) => f.type === "number");
  const period = getLatestPeriod(data, config);
  const pField = config.find((f: any) => f.type === "period");
  const filtered = period && pField
    ? data.filter((r) => String(r[pField.fieldName] || "").trim() === period)
    : data;

  function findRaw(kws: string[], excludeKws: string[] = []): number {
    const f = numFields.find((nf: any) => {
      const fn = nf.fieldName?.toLowerCase() || "";
      const lb = nf.label?.toLowerCase() || "";
      const excluded = excludeKws.some(x => fn.includes(x) || lb.includes(x));
      return !excluded && kws.some(k => fn.includes(k) || lb.includes(k));
    });
    return f ? filtered.reduce((s: number, r: any) => s + parseNum(r[f.fieldName]), 0) : 0;
  }

  return { numFields, filtered, period, findRaw };
}

/** Sales Donut: total_sales/ยอดรวม | cost/ต้นทุน | profit/กำไร */
function getSalesDonut(data: any[], config: any[]): { cost: number; profit: number; revenue: number; period?: string; profitLabel?: string; revenueLabel?: string; costLabel?: string } | null {
  const { numFields, filtered, period, findRaw } = buildDonutBase(data, config);
  if (numFields.length === 0) return null;

  // revenue: ลอง total_sales / ยอดรวม / ยอดขายรวม ฯลฯ
  const revenue = findRaw(["total_sales", "ยอดรวม", "รายได้รวม", "ยอดขายรวม", "revenue", "sales", "income"]);

  // cost: ลอง "cost" ตรงๆ / ต้นทุน / ต้นทุนขาย ฯลฯ (ยกเว้น expense/ค่าใช้จ่าย)
  const cost = findRaw(["cost", "ต้นทุน", "ต้นทุนขาย", "cost_of", "cogs", "ต้นทุนสินค้า"], ["expense", "ค่าใช้จ่าย"]);

  // profit: ลอง "profit"/"กำไร" ตรงๆ ก่อน แล้วค่อย fallback gross, แล้วค่อยคำนวณ
  const profitField =
    numFields.find((nf: any) => {
      const fn = nf.fieldName?.toLowerCase() || "";
      const lb = nf.label?.toLowerCase() || "";
      return fn === "profit" || lb === "กำไร";
    }) ||
    numFields.find((nf: any) => {
      const fn = nf.fieldName?.toLowerCase() || "";
      const lb = nf.label?.toLowerCase() || "";
      const isNet = fn.includes("net") || lb.includes("สุทธิ");
      return !isNet && (fn.includes("gross") || lb.includes("ขั้นต้น") || fn.includes("profit") || lb.includes("กำไร"));
    });
  const profitVal = profitField
    ? filtered.reduce((s: number, r: any) => s + parseNum(r[profitField.fieldName]), 0)
    : 0;
  const profit = profitVal !== 0 ? profitVal : revenue - cost;
  const profitLabel = (profitField?.label || "").includes("ขั้นต้น") ? "กำไรขั้นต้น" : "กำไร";

  if (revenue === 0 && cost === 0 && profit === 0) return null;
  return { cost, profit, revenue: revenue || cost + profit, period: period || undefined, profitLabel, revenueLabel: "รายได้จากการขาย", costLabel: "ต้นทุนสินค้า" };
}

/** Usage Donut: นับแถวต่อ product เฉพาะเดือนล่าสุด → top 3 */
function getUsageDonut(
  data: any[],
  config: any[]
): { items: { label: string; count: number; pct: number }[]; total: number; period?: string } | null {
  if (!config || data.length === 0) return null;

  // หา field ที่ชื่อตรงกับ product / สินค้า / ยา — ไม่สนใจ type เพราะ sheet เก็บเป็น "text"
  const PRIORITY_KW = ["product", "ยา", "สินค้า", "รายการสินค้า", "รายการ"];
  const NON_CATEGORY = ["number", "period", "date"];
  const field = config.find((f: any) => {
    const fn = (f.fieldName || "").toLowerCase();
    const lb = (f.label || "").toLowerCase();
    const tp = (f.type || "").toLowerCase();
    return !NON_CATEGORY.includes(tp) && PRIORITY_KW.some(k => fn.includes(k) || lb.includes(k));
  });
  if (!field) return null;

  // filter เฉพาะเดือนล่าสุด (ถ้ามี period field)
  const period = getLatestPeriod(data, config);
  const pField = config.find((f: any) => f.type === "period");
  const filtered = period && pField
    ? data.filter((r) => String(r[pField.fieldName] || "").trim() === period)
    : data;

  // นับแถวต่อค่าใน field นั้น
  const counts: Record<string, number> = {};
  for (const row of filtered) {
    const val = String(row[field.fieldName] || "").trim();
    if (!val) continue;
    counts[val] = (counts[val] || 0) + 1;
  }

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;

  const total = entries.reduce((s, [, c]) => s + c, 0);
  const top3 = entries.slice(0, 3).map(([label, count]) => ({
    label,
    count,
    pct: Math.round((count / total) * 100),
  }));

  return { items: top3, total, period: period || undefined };
}

/** Expense Donut: top 3 หมวดค่าใช้จ่ายที่จ่ายมากสุดเดือนล่าสุด (ยกเว้นค่าจ้างพนักงาน) */
function getExpenseDonut(
  data: any[],
  config: any[]
): { items: { label: string; amount: number; pct: number }[]; total: number; period?: string } | null {
  if (!config || data.length === 0) return null;

  const EXCLUDE_KW = ["ค่าจ้างพนักงาน"];

  // หา category field (expense / หมวดค่าใช้จ่าย) และ amount field
  const catField = config.find((f: any) => {
    const fn = (f.fieldName || "").toLowerCase();
    const lb = (f.label || "").toLowerCase();
    return fn === "expense" || lb.includes("หมวด") || lb.includes("ค่าใช้จ่าย");
  });
  const amtField = config.find((f: any) => {
    const fn = (f.fieldName || "").toLowerCase();
    const lb = (f.label || "").toLowerCase();
    return fn === "amount" || lb.includes("ยอดเงิน") || lb.includes("จำนวนเงิน");
  });
  if (!catField || !amtField) return null;

  // filter เฉพาะเดือนล่าสุด
  const period = getLatestPeriod(data, config);
  const pField = config.find((f: any) => f.type === "period");
  const filtered = period && pField
    ? data.filter((r) => String(r[pField.fieldName] || "").trim() === period)
    : data;

  // sum amount per category (ยกเว้น EXCLUDE_KW)
  const sums: Record<string, number> = {};
  for (const row of filtered) {
    const cat = String(row[catField.fieldName] || "").trim();
    if (!cat) continue;
    if (EXCLUDE_KW.some(kw => cat.includes(kw))) continue;
    sums[cat] = (sums[cat] || 0) + parseNum(row[amtField.fieldName]);
  }

  const entries = Object.entries(sums).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;

  const total = entries.reduce((s, [, v]) => s + v, 0);
  const top3 = entries.slice(0, 3).map(([label, amount]) => ({
    label,
    amount,
    pct: Math.round((amount / total) * 100),
  }));

  return { items: top3, total, period: period || undefined };
}

/** Payroll: ค่าจ้างรวม (net_salary) + จำนวนพนักงานไม่ซ้ำ เดือนล่าสุด */
function getPayrollMetrics(data: any[], config: any[]): { label: string; value: string; sub?: string }[] | null {
  if (!config || data.length === 0) return null;

  // หา net_salary ก่อน (รายได้สุทธิรวม)
  const netSalaryField = config.find((f: any) => {
    const fn = (f.fieldName || "").toLowerCase();
    const lb = (f.label || "").toLowerCase();
    return fn === "net_salary" || lb.includes("รายได้สุทธิ");
  });
  // ถ้าไม่มี net_salary → รวมทุก number field ที่เป็น income (salary/commission/staff_fees ฯลฯ)
  // ยกเว้น field ที่เป็น deduction เช่น off/late/adv_payments/หัก
  const INCOME_FIELDS = ["salary", "commission", "staff_fees", "ค่ามือ", "เงินเดือน", "ค่าคอม", "bonus", "โบนัส"];
  const EXCLUDE_INCOME = ["off", "late", "ot", "adv", "หัก", "ลา", "สาย"];
  const incomeFields = config.filter((f: any) => {
    if (f.type !== "number") return false;
    const fn = (f.fieldName || "").toLowerCase();
    const lb = (f.label || "").toLowerCase();
    if (EXCLUDE_INCOME.some(k => fn.includes(k) || lb.includes(k))) return false;
    return INCOME_FIELDS.some(k => fn.includes(k) || lb.includes(k));
  });
  const salaryField = netSalaryField || (incomeFields.length > 0 ? "multi" : null);
  const empField = config.find((f: any) => {
    const fn = (f.fieldName || "").toLowerCase();
    const lb = (f.label || "").toLowerCase();
    return fn === "employee_name" || fn === "employees_name" || lb.includes("ชื่อพนักงาน");
  });
  if (!salaryField && !empField) return null;

  const period = getLatestPeriod(data, config);
  const pField = config.find((f: any) => f.type === "period");
  const filtered = period && pField
    ? data.filter((r) => String(r[pField.fieldName] || "").trim() === period)
    : data;

  const metrics: { label: string; value: string; sub?: string }[] = [];
  const sub = period || undefined;

  if (salaryField) {
    const total = netSalaryField
      ? filtered.reduce((s, r) => s + parseNum(r[netSalaryField.fieldName]), 0)
      : filtered.reduce((s, r) => s + incomeFields.reduce((a, f) => a + parseNum(r[f.fieldName]), 0), 0);
    metrics.push({ label: "ค่าจ้างรวม", value: fmtFull(total), sub });
  }
  if (empField) {
    const unique = new Set(filtered.map(r => String(r[empField.fieldName] || "").trim()).filter(Boolean));
    metrics.push({ label: "จำนวนพนักงาน", value: `${unique.size} คน`, sub });
  }

  return metrics.length > 0 ? metrics : null;
}

/** คำนวณ raw numbers สำหรับ Financial Donut */
function getFinancialDonut(data: any[], config: any[]): { cost: number; profit: number; revenue: number; period?: string; profitLabel?: string; revenueLabel?: string; costLabel?: string } | null {
  const numFields = config.filter((f: any) => f.type === "number");
  if (numFields.length === 0) return null;
  const period = getLatestPeriod(data, config);
  const pField = config.find((f: any) => f.type === "period");
  const filtered = period && pField
    ? data.filter((r) => String(r[pField.fieldName] || "").trim() === period)
    : data;

  function findRaw(kws: string[]): number {
    const f = numFields.find((nf: any) =>
      kws.some(k => nf.fieldName?.toLowerCase().includes(k) || nf.label?.toLowerCase().includes(k))
    );
    return f ? filtered.reduce((s: number, r: any) => s + parseNum(r[f.fieldName]), 0) : 0;
  }

  const revenue = findRaw(["revenue", "income", "รายได้", "ยอดขาย", "total_sales", "sales"]);
  const costOfGoods = findRaw(["cost_of", "cogs", "ต้นทุนขาย", "ต้นทุนสินค้า"]);
  const expense = findRaw(["total_expense", "expense", "ค่าใช้จ่ายรวม", "ค่าใช้จ่าย"]);
  const cost = costOfGoods + expense;
  // หา กำไรสุทธิ โดยเฉพาะ — ห้าม match กำไรขั้นต้น/gross profit
  const netProfitField = config.filter((f: any) => f.type === "number").find((nf: any) => {
    const fn = nf.fieldName?.toLowerCase() || "";
    const lb = nf.label?.toLowerCase() || "";
    const isGross = fn.includes("gross") || lb.includes("ขั้นต้น") || lb.includes("gross");
    const isNet = fn.includes("net_profit") || fn.includes("net profit") ||
                  lb.includes("กำไรสุทธิ") || lb.includes("สุทธิ");
    return isNet && !isGross;
  });
  const profitField = netProfitField
    ? filtered.reduce((s: number, r: any) => s + parseNum(r[netProfitField.fieldName]), 0)
    : 0;
  const profit = profitField !== 0 ? profitField : revenue - cost;

  if (revenue === 0 && cost === 0) return null;
  return { cost, profit, revenue: revenue || cost + profit, period: period || undefined, profitLabel: "กำไรสุทธิ", revenueLabel: "รายได้รวม", costLabel: "ค่าใช้จ่ายรวม" };
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
    financial: ["revenue", "income", "total_sales", "cost", "cogs", "profit", "net_profit", "expense", "total"],
    inventory: [],
    usage:     ["total_sales", "revenue", "amount"],
    general:   [],
  };

  // financial แสดง 3 metrics, อื่นๆ แสดง 2
  const maxMetrics = type === "financial" ? 3 : 2;
  const picked = priority[type] || [];
  const shown = new Set<string>();

  // helper: หา field จาก fieldName หรือ label (รองรับทั้งไทยและอังกฤษ)
  function findField(keywords: string[]): any {
    return numberFields.find((nf: any) => {
      const fn = nf.fieldName?.toLowerCase() || "";
      const lb = nf.label?.toLowerCase() || "";
      return !shown.has(nf.fieldName) && keywords.some(k => fn.includes(k) || lb.includes(k));
    });
  }

  function sumField(field: any): number {
    return filtered.reduce((s: number, r: any) => s + parseNum(r[field.fieldName]), 0);
  }

  if (type === "financial") {
    // รายได้
    const revenueField = findField(["revenue", "income", "รายได้", "ยอดขาย", "total_sales", "sales"]);
    if (revenueField) {
      const s = sumField(revenueField);
      if (s !== 0) { metrics.push({ label: "รายได้", value: fmt(s), sub: latestPeriod || undefined }); shown.add(revenueField.fieldName); }
    }

    // ต้นทุนรวม = ต้นทุนขาย + ค่าใช้จ่ายรวม
    const costField    = findField(["cost_of", "cogs", "ต้นทุนขาย", "ต้นทุนสินค้า", "cost"]);
    const expenseField = findField(["total_expense", "expense", "ค่าใช้จ่ายรวม", "ค่าใช้จ่าย"]);
    const costSum    = costField    ? sumField(costField)    : 0;
    const expenseSum = expenseField ? sumField(expenseField) : 0;
    const totalCost  = costSum + expenseSum;
    if (totalCost !== 0) {
      metrics.push({ label: "ต้นทุนรวม", value: fmt(totalCost), sub: latestPeriod || undefined });
      if (costField)    shown.add(costField.fieldName);
      if (expenseField) shown.add(expenseField.fieldName);
    }

    // กำไร — หา กำไรสุทธิ เท่านั้น ห้าม match กำไรขั้นต้น
    const profitField = numberFields.find((nf: any) => {
      if (shown.has(nf.fieldName)) return false;
      const fn = nf.fieldName?.toLowerCase() || "";
      const lb = nf.label?.toLowerCase() || "";
      const isGross = fn.includes("gross") || lb.includes("ขั้นต้น") || lb.includes("gross");
      return !isGross && (fn.includes("net_profit") || lb.includes("กำไรสุทธิ") || lb.includes("สุทธิ"));
    });
    if (profitField) {
      const s = sumField(profitField);
      if (s !== 0) { metrics.push({ label: "กำไรสุทธิ", value: fmt(s), sub: latestPeriod || undefined }); shown.add(profitField.fieldName); }
    }

    // ถ้าหา field ไม่ได้เลย → คำนวณกำไรจาก รายได้ - ต้นทุน
    if (metrics.length >= 2 && !profitField && revenueField) {
      const rev = metrics[0] ? sumField(revenueField) : 0;
      const cost = totalCost;
      if (rev !== 0 && cost !== 0) {
        metrics.push({ label: "กำไร (คำนวณ)", value: fmt(rev - cost), sub: latestPeriod || undefined });
      }
    }

    if (metrics.length === 0) {
      metrics.push({ label: "รายการ", value: fmtNum(filtered.length) + " รายการ", sub: latestPeriod || undefined });
    }
    return metrics;
  }

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

  // หา fields ตาม priority — ใช้ includes แทน exact match
  for (const key of picked) {
    const f = numberFields.find((nf: any) =>
      !shown.has(nf.fieldName) && (
        nf.fieldName.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(nf.fieldName.toLowerCase())
      )
    );
    if (f) {
      const sum = filtered.reduce((s: number, r: any) => s + parseNum(r[f.fieldName]), 0);
      if (sum !== 0) {
        metrics.push({ label: f.label || f.fieldName, value: fmt(sum), sub: latestPeriod || undefined });
        shown.add(f.fieldName);
      }
      if (metrics.length >= maxMetrics) break;
    }
  }

  // fallback: แสดง number fields ที่มีจริงๆ ทั้งหมด (ไม่นับแถว)
  if (metrics.length === 0) {
    for (const f of numberFields) {
      if (shown.has(f.fieldName)) continue;
      const sum = filtered.reduce((s: number, r: any) => s + parseNum(r[f.fieldName]), 0);
      if (sum !== 0) {
        metrics.push({ label: f.label || f.fieldName, value: fmt(sum), sub: latestPeriod || undefined });
        shown.add(f.fieldName);
      }
      if (metrics.length >= maxMetrics) break;
    }
  }

  if (metrics.length === 0) {
    metrics.push({ label: "รายการ", value: fmtNum(filtered.length) + " รายการ", sub: latestPeriod || undefined });
  }

  return metrics;
}

// ── Donut Chart (SVG, no library) ─────────────────────────────────────────────
function DonutChart({ cost, profit, dark }: { cost: number; profit: number; dark: boolean }) {
  const r = 34;
  const circ = 2 * Math.PI * r;
  const total = Math.abs(cost) + Math.abs(profit);
  if (total === 0) return null;

  const costFrac  = Math.abs(cost)   / total;
  const profitFrac = Math.abs(profit) / total;
  const profitPct  = Math.round(profitFrac * 100);
  const isLoss     = profit < 0;

  const costDash   = costFrac   * circ;
  const profitDash = profitFrac * circ;

  // start at 12 o'clock → rotate(-90)
  // profit segment rotates past cost segment
  const profitRotate = -90 + costFrac * 360;

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm">
      {/* bg ring */}
      <circle cx="50" cy="50" r={r} fill="none"
        stroke={dark ? "rgba(255,255,255,0.08)" : "#f1f5f9"} strokeWidth="13" />

      {/* ต้นทุน — rose */}
      <circle cx="50" cy="50" r={r} fill="none"
        stroke={dark ? "#fb7185" : "#f43f5e"}
        strokeWidth="13"
        strokeDasharray={`${costDash} ${circ}`}
        strokeLinecap="butt"
        transform="rotate(-90 50 50)"
      />

      {/* กำไร — emerald (หรือ red ถ้าขาดทุน) */}
      <circle cx="50" cy="50" r={r} fill="none"
        stroke={isLoss ? "#94a3b8" : (dark ? "#34d399" : "#10b981")}
        strokeWidth="13"
        strokeDasharray={`${profitDash} ${circ}`}
        strokeLinecap="butt"
        transform={`rotate(${profitRotate} 50 50)`}
      />

      {/* center % */}
      <text x="50" y="46" textAnchor="middle" fontSize="17" fontWeight="bold"
        fill={dark ? "#fff" : (isLoss ? "#f43f5e" : "#10b981")} fontFamily="sans-serif">
        {isLoss ? "-" : ""}{profitPct}%
      </text>
      <text x="50" y="60" textAnchor="middle" fontSize="9"
        fill={dark ? "rgba(255,255,255,0.5)" : "#94a3b8"} fontFamily="sans-serif">
        {isLoss ? "ขาดทุน" : "กำไร"}
      </text>
    </svg>
  );
}

// ── Usage Donut (multi-segment) ───────────────────────────────────────────────
const USAGE_COLORS = [
  { stroke: "#6366f1", light: "#818cf8" }, // indigo
  { stroke: "#8b5cf6", light: "#a78bfa" }, // violet
  { stroke: "#06b6d4", light: "#22d3ee" }, // cyan
];

function UsageDonutChart({ items, dark }: { items: { label: string; count: number; pct: number }[]; total: number; dark: boolean }) {
  const r = 34;
  const circ = 2 * Math.PI * r;
  const total = items.reduce((s, it) => s + it.count, 0);
  if (total === 0) return null;

  // build segments with cumulative start angle
  let cumFrac = 0;
  const segments = items.map((it, i) => {
    const frac = it.count / total;
    const startAngle = -90 + cumFrac * 360;
    const dashLen = frac * circ;
    cumFrac += frac;
    return { frac, startAngle, dashLen, color: USAGE_COLORS[i] || USAGE_COLORS[2] };
  });

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm">
      {/* bg ring */}
      <circle cx="50" cy="50" r={r} fill="none"
        stroke={dark ? "rgba(255,255,255,0.08)" : "#f1f5f9"} strokeWidth="13" />
      {segments.map((seg, i) => (
        <circle key={i} cx="50" cy="50" r={r} fill="none"
          stroke={dark ? seg.color.light : seg.color.stroke}
          strokeWidth="13"
          strokeDasharray={`${seg.dashLen} ${circ}`}
          strokeLinecap="butt"
          transform={`rotate(${seg.startAngle} 50 50)`}
        />
      ))}
      {/* center: total rows */}
      <text x="50" y="47" textAnchor="middle" fontSize="15" fontWeight="bold"
        fill={dark ? "#fff" : "#6366f1"} fontFamily="sans-serif">
        {total.toLocaleString("th-TH")}
      </text>
      <text x="50" y="60" textAnchor="middle" fontSize="8"
        fill={dark ? "rgba(255,255,255,0.5)" : "#94a3b8"} fontFamily="sans-serif">
        รายการ
      </text>
    </svg>
  );
}

const EXPENSE_COLORS = [
  { stroke: "#f59e0b", light: "#fcd34d" }, // amber
  { stroke: "#f97316", light: "#fb923c" }, // orange
  { stroke: "#ef4444", light: "#fca5a5" }, // red
];

function ExpenseDonutChart({ items, total, dark }: { items: { label: string; amount: number; pct: number }[]; total: number; dark: boolean }) {
  const r = 34;
  const circ = 2 * Math.PI * r;
  if (total === 0) return null;

  let cumFrac = 0;
  const segments = items.map((it, i) => {
    const frac = it.amount / total;
    const startAngle = -90 + cumFrac * 360;
    cumFrac += frac;
    return { dashLen: frac * circ, startAngle, color: EXPENSE_COLORS[i] || EXPENSE_COLORS[2] };
  });

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm">
      <circle cx="50" cy="50" r={r} fill="none"
        stroke={dark ? "rgba(255,255,255,0.08)" : "#f1f5f9"} strokeWidth="13" />
      {segments.map((seg, i) => (
        <circle key={i} cx="50" cy="50" r={r} fill="none"
          stroke={dark ? seg.color.light : seg.color.stroke}
          strokeWidth="13"
          strokeDasharray={`${seg.dashLen} ${circ}`}
          strokeLinecap="butt"
          transform={`rotate(${seg.startAngle} 50 50)`}
        />
      ))}
      <text x="50" y="47" textAnchor="middle" fontSize="10" fontWeight="bold"
        fill={dark ? "#fff" : "#f59e0b"} fontFamily="sans-serif">
        {total >= 1_000_000 ? `฿${(total / 1_000_000).toFixed(1)}M` : total >= 1_000 ? `฿${(total / 1_000).toFixed(0)}K` : `฿${Math.round(total)}`}
      </text>
      <text x="50" y="60" textAnchor="middle" fontSize="8"
        fill={dark ? "rgba(255,255,255,0.5)" : "#94a3b8"} fontFamily="sans-serif">
        รวม
      </text>
    </svg>
  );
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
          const payrollMetrics = (type === "payroll" && data.data && data.config)
            ? getPayrollMetrics(data.data, data.config)
            : null;
          const metrics = payrollMetrics
            ?? (data.data && data.config ? summarize(data.data, data.config, type) : [{ label: "ไม่พบข้อมูล", value: "-" }]);
          const donut = (type === "financial" && data.data && data.config)
            ? getFinancialDonut(data.data, data.config) ?? undefined
            : (type === "sales" && data.data && data.config)
            ? getSalesDonut(data.data, data.config) ?? undefined
            : undefined;
          // ลอง usageDonut เฉพาะ dashboard ที่ไม่ใช่ inventory/financial/sales
          const usageDonut = (!donut && type !== "inventory" && type !== "expense" && data.data && data.config)
            ? getUsageDonut(data.data, data.config) ?? undefined
            : undefined;
          const expenseDonut = (type === "expense" && data.data && data.config)
            ? getExpenseDonut(data.data, data.config) ?? undefined
            : undefined;

          setSummaries((prev) =>
            prev.map((s, i) =>
              i === idx ? { ...s, metrics, donut, usageDonut, expenseDonut, loading: false } : s
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

  const labelColor  = dark ? "text-slate-400" : "text-slate-500";
  const subColor    = dark ? "text-slate-500" : "text-slate-400";
  const titleColor  = dark ? "text-slate-300" : "text-slate-600";
  const headingColor = dark ? "text-white" : "text-slate-800";
  const subheadColor = dark ? "text-slate-500" : "text-slate-400";

  return (
    <div className="mb-0">
      <div className="flex items-center gap-3 mb-4">
        <div className={`flex items-center justify-center w-8 h-8 rounded-xl ${dark ? "bg-white/10" : "bg-slate-800"} shadow-sm`}>
          <span className="text-white"><IcBuilding /></span>
        </div>
        <div>
          <h2 className={`text-base lg:text-lg font-bold leading-tight ${headingColor}`}>ภาพรวมธุรกิจ</h2>
          <span className={`text-xs ${subheadColor}`}>ข้อมูลล่าสุด</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
        {summaries.map((s, i) => {
          const type = detectType(dashboardItems[i].dashboardName + " " + dashboardItems[i].dashboardConfigName);
          const meta = TYPE_META[type] || TYPE_META.general;

          return (
            <div
              key={i}
              className={`${dark ? "bg-white/5 border border-white/10 hover:bg-white/10" : `bg-gradient-to-br ${meta.gradient} border hover:shadow-md`} rounded-2xl p-4 lg:p-5 transition-all duration-200`}
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div className={`flex items-center justify-center w-7 h-7 rounded-lg ${dark ? "bg-white/15" : meta.iconBg} shadow-sm flex-shrink-0`}>
                  <span className="text-white">{meta.icon}</span>
                </div>
                <p className={`text-xs font-semibold truncate ${titleColor}`}>{s.dashboardName}</p>
              </div>

              {s.loading ? (
                <div className="space-y-2">
                  <div className={`h-6 ${dark ? "bg-white/10" : "bg-white/60"} rounded animate-pulse`} />
                  <div className={`h-4 ${dark ? "bg-white/5" : "bg-white/40"} rounded animate-pulse w-2/3`} />
                </div>
              ) : s.expenseDonut ? (
                /* Expense Donut Card — top 3 หมวดค่าใช้จ่าย */
                <div>
                  <div className="flex items-center gap-3">
                    <div className="w-[72px] h-[72px] flex-shrink-0">
                      <ExpenseDonutChart items={s.expenseDonut.items} total={s.expenseDonut.total} dark={dark} />
                    </div>
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      {s.expenseDonut.items.map((it, ii) => (
                        <div key={ii} className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: dark ? EXPENSE_COLORS[ii]?.light : EXPENSE_COLORS[ii]?.stroke }} />
                          <p className={`text-[10px] truncate flex-1 ${labelColor}`}>{it.label}</p>
                          <p className={`text-[10px] font-bold tabular-nums flex-shrink-0 ${dark ? "text-white" : "text-slate-700"}`}>
                            {it.amount >= 1_000_000 ? `฿${(it.amount / 1_000_000).toFixed(1)}M` : it.amount >= 1_000 ? `฿${(it.amount / 1_000).toFixed(0)}K` : `฿${Math.round(it.amount).toLocaleString("th-TH")}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className={`text-[10px] mt-1.5 ${subColor}`}>
                    {s.expenseDonut.period ? `${s.expenseDonut.period} · ` : ""}ไม่รวมค่าจ้างพนักงาน
                  </p>
                </div>
              ) : s.usageDonut ? (
                /* Usage Donut Card — top 3 สินค้า */
                <div>
                  <div className="flex items-center gap-3">
                    <div className="w-[72px] h-[72px] flex-shrink-0">
                      <UsageDonutChart items={s.usageDonut.items} total={s.usageDonut.total} dark={dark} />
                    </div>
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      {s.usageDonut.items.map((it, ii) => (
                        <div key={ii} className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: dark ? USAGE_COLORS[ii]?.light : USAGE_COLORS[ii]?.stroke }}
                          />
                          <p className={`text-[10px] truncate flex-1 ${labelColor}`}>{it.label}</p>
                          <p className={`text-[10px] font-bold tabular-nums flex-shrink-0 ${dark ? "text-white" : "text-slate-700"}`}>
                            {it.count}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className={`text-[10px] mt-1.5 ${subColor}`}>
                    {s.usageDonut.period ? `${s.usageDonut.period} · ` : ""}ทั้งหมด {s.usageDonut.total.toLocaleString("th-TH")} รายการ
                  </p>
                </div>
              ) : s.donut ? (
                /* Donut Card (Financial / Sales) */
                <div>
                  <div className="flex items-center gap-3">
                    {/* Donut */}
                    <div className="w-[72px] h-[72px] flex-shrink-0">
                      <DonutChart cost={s.donut.cost} profit={s.donut.profit} dark={dark} />
                    </div>
                    {/* Legend — รายได้ / ต้นทุน / กำไร */}
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <div>
                        <p className={`text-[10px] ${labelColor}`}>{s.donut.revenueLabel || "รายได้"}</p>
                        <p className={`text-xs font-bold ${dark ? "text-white" : "text-indigo-700"} tabular-nums`}>
                          {fmtFull(s.donut.revenue)}
                        </p>
                      </div>
                      <div>
                        <p className={`text-[10px] ${labelColor}`}>{s.donut.costLabel || "ต้นทุน"}</p>
                        <p className={`text-xs font-bold ${dark ? "text-rose-300" : "text-rose-600"} tabular-nums`}>
                          {fmtFull(s.donut.cost)}
                        </p>
                      </div>
                      <div>
                        <p className={`text-[10px] ${labelColor}`}>{s.donut.profitLabel || "กำไร"}</p>
                        <p className={`text-xs font-bold ${dark ? "text-emerald-300" : (s.donut.profit < 0 ? "text-rose-600" : "text-emerald-700")} tabular-nums`}>
                          {fmtFull(s.donut.profit)}
                        </p>
                      </div>
                    </div>
                  </div>
                  {s.donut.period && (
                    <p className={`text-[10px] mt-1.5 ${subColor}`}>{s.donut.period}</p>
                  )}
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
