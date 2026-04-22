/**
 * Sales Ranking Component with Customer Detail Modal
 * Location: app/components/dashboards/sales/SalesRanking.tsx
 */

"use client";
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { normalizeDate } from "./salesUtils";

interface RankingRow {
  cust_name: string;
  count: number;
  total_sales: number;
  profit: number;
}

interface SalesRankingProps {
  rankingTableData: RankingRow[];
  allData: any[];
}

function formatMoney(val: any): string {
  const n = typeof val === "number" ? val : parseFloat(String(val || "0").replace(/,/g, ""));
  if (isNaN(n)) return "฿0";
  return "฿" + n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDate(raw: any): string {
  if (!raw) return "-";
  const n = normalizeDate(String(raw));
  if (!n) return String(raw);
  const [y, m, d] = n.split("-");
  return `${d}/${m}/${y}`;
}

export default function SalesRanking({ rankingTableData, allData }: SalesRankingProps) {
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (rankingTableData.length === 0) return null;

  const customerTxns = selectedCustomer
    ? allData
        .filter((r) => String(r.cust_name || "").trim() === selectedCustomer)
        .sort((a, b) => {
          const da = normalizeDate(String(a.date || a.วันที่ || "")) || "";
          const db = normalizeDate(String(b.date || b.วันที่ || "")) || "";
          return db.localeCompare(da); // newest first
        })
    : [];

  // detect field names from first row
  const dateField = allData.length > 0
    ? Object.keys(allData[0]).find((k) => {
        const kl = k.toLowerCase();
        return kl === "date" || kl === "วันที่" || kl.includes("date");
      }) || "date"
    : "date";

  const programField = allData.length > 0
    ? Object.keys(allData[0]).find((k) => {
        const kl = k.toLowerCase();
        return kl === "program" || kl === "บริการ" || kl === "service" || kl.includes("program");
      }) || "program"
    : "program";

  const salesField  = "total_sales";
  const profitField = "profit";
  const costField   = "cost";

  const txnTotal  = customerTxns.reduce((s, r) => s + (parseFloat(String(r[salesField]  || 0).replace(/,/g, "")) || 0), 0);
  const txnProfit = customerTxns.reduce((s, r) => s + (parseFloat(String(r[profitField] || 0).replace(/,/g, "")) || 0), 0);

  return (
    <>
      <div className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-slate-200 shadow-sm">
        <h3 className="text-base lg:text-lg font-bold text-slate-800 mb-4 lg:mb-6 flex items-center gap-2">
          <span className="text-lg lg:text-2xl">🏆</span>
          <span>Customers Leaderboard</span>
          <span className="text-xs font-normal text-slate-400 ml-1">คลิกเพื่อดูรายการ</span>
        </h3>

        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-300 bg-slate-50">
                <th className="px-4 py-3 text-center font-bold text-slate-700 w-16">ลำดับ</th>
                <th className="px-4 py-3 text-left font-bold text-slate-700">ชื่อลูกค้า</th>
                <th className="px-4 py-3 text-right font-bold text-slate-700">จำนวนครั้ง</th>
                <th className="px-4 py-3 text-right font-bold text-slate-700">ยอดรวม</th>
                <th className="px-4 py-3 text-right font-bold text-slate-700">กำไร</th>
              </tr>
            </thead>
            <tbody>
              {rankingTableData.map((row, idx) => (
                <tr
                  key={idx}
                  onClick={() => setSelectedCustomer(row.cust_name)}
                  className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-center font-bold text-slate-800 text-lg">
                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                  </td>
                  <td className="px-4 py-3 font-semibold text-blue-600 underline decoration-dotted">
                    {row.cust_name}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                      {row.count} ครั้ง
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatMoney(row.total_sales)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-600">{formatMoney(row.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-3">
          {rankingTableData.map((row, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedCustomer(row.cust_name)}
              className={`rounded-lg p-3 border-2 cursor-pointer active:scale-95 transition-all ${idx < 3 ? "bg-yellow-50 border-yellow-200" : "bg-white border-slate-200"}`}
            >
              <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold w-8 h-8 flex items-center justify-center rounded-full ${idx === 0 ? "bg-yellow-400 text-white" : idx === 1 ? "bg-gray-300 text-white" : idx === 2 ? "bg-orange-400 text-white" : "bg-slate-100 text-slate-700"}`}>
                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                  </span>
                  <div>
                    <p className="font-bold text-blue-600 text-sm underline decoration-dotted">{row.cust_name}</p>
                    <p className="text-xs text-slate-500">{row.count} ครั้ง • กดดูรายการ</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-2 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-600 mb-1">ยอดรวม</p>
                  <p className="font-bold text-slate-800 text-sm">{formatMoney(row.total_sales)}</p>
                </div>
                <div className="text-center p-2 bg-green-50 rounded-lg">
                  <p className="text-xs text-slate-600 mb-1">กำไร</p>
                  <p className="font-bold text-green-600 text-sm">{formatMoney(row.profit)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Customer Detail Modal */}
      {selectedCustomer && mounted && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-black/50"
          style={{ zIndex: 9999 }}
          onClick={() => setSelectedCustomer(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800">{selectedCustomer}</h2>
                <p className="text-sm text-slate-500 mt-0.5">ประวัติการใช้บริการ — {customerTxns.length} รายการ</p>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Summary */}
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex gap-6">
              <div>
                <p className="text-xs text-slate-500">ยอดรวมทั้งหมด</p>
                <p className="text-lg font-bold text-slate-800">{formatMoney(txnTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">กำไรรวม</p>
                <p className="text-lg font-bold text-green-600">{formatMoney(txnProfit)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">จำนวนครั้ง</p>
                <p className="text-lg font-bold text-blue-600">{customerTxns.length} ครั้ง</p>
              </div>
            </div>

            {/* Transaction List */}
            <div className="overflow-y-auto flex-1 p-5">
              {customerTxns.length === 0 ? (
                <p className="text-center text-slate-400 py-10">ไม่พบรายการ</p>
              ) : (
                <div className="space-y-2">
                  {customerTxns.map((txn, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {i + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 text-sm truncate">
                            {String(txn[programField] || "-").trim()}
                          </p>
                          <p className="text-xs text-slate-400">{formatDate(txn[dateField])}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="font-semibold text-slate-800 text-sm">{formatMoney(txn[salesField])}</p>
                        <p className="text-xs text-green-600">{formatMoney(txn[profitField])}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
