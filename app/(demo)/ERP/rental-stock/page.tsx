"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import QuickNavDemo, { QuickNavDemoTrigger } from "@/app/components/QuickNavDemo";

interface ConfigField {
  fieldName: string;
  order: number | null;
}

interface CatalogItem {
  name: string;
  size: string;
  status: "available" | "rented";
  rowIndex?: number;
  custName: string;
  custPhone: string;
  returnDeadline: string;
  price: string;
  receiptId: string;
  txStatus: string;
}

function getVal(row: any[], colIdx: number | null): string {
  if (colIdx == null || colIdx < 0) return "";
  return (row[colIdx] ?? "").toString().trim();
}

function findField(fields: ConfigField[], ...names: string[]): number | null {
  const f = fields.find((f) => names.includes(f.fieldName.toLowerCase()));
  return f?.order != null ? f.order - 1 : null;
}

function findFieldLike(fields: ConfigField[], ...patterns: string[]): number | null {
  const f = fields.find((f) => patterns.some((p) => f.fieldName.toLowerCase().includes(p)));
  return f?.order != null ? f.order - 1 : null;
}

const RETURNED_VALUES = new Set(["คืนแล้ว", "returned", "คืน"]);
function isReturned(s: string) {
  return RETURNED_VALUES.has(s.trim().toLowerCase());
}

function parseDeadline(v: string): Date | null {
  if (!v) return null;
  const parts = v.split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts.map(Number);
    if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y < 100 ? y + 2500 - 543 : y, m - 1, d);
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function deadlineBadge(deadline: string): { label: string; cls: string } {
  const d = parseDeadline(deadline);
  if (!d) return { label: "", cls: "" };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.floor((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0)   return { label: `เกินกำหนด ${-diff} วัน`, cls: "bg-red-500/20 text-red-300 border-red-500/30" };
  if (diff === 0) return { label: "คืนวันนี้",              cls: "bg-amber-500/20 text-amber-300 border-amber-500/30" };
  if (diff <= 2)  return { label: `อีก ${diff} วัน`,       cls: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" };
  return { label: `อีก ${diff} วัน`, cls: "bg-slate-500/10 text-slate-400 border-slate-500/20" };
}

function RentalStockPage() {
  const { status } = useSession();
  const router     = useRouter();
  const params     = useSearchParams();

  const spreadsheetId = params.get("spreadsheetId") || "";

  const [navOpen,      setNavOpen]      = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [tab,          setTab]          = useState<"rented" | "available">("rented");
  const [returning,    setReturning]    = useState<number | null>(null);
  const [search,       setSearch]       = useState("");
  const [sheetName,    setSheetName]    = useState("");
  const [statusColIdx, setStatusColIdx] = useState<number | null>(null);
  const [catalog,      setCatalog]      = useState<CatalogItem[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status !== "authenticated" || !spreadsheetId) return;
    // guard: type 1 ไม่มีสิทธิ์เข้าหน้านี้
    fetch("/api/user/modules-demo").then((r) => r.json()).then((mods) => {
      if ((mods.clientType || 1) !== 2) { router.replace("/ERP/home"); return; }
      loadAll();
    }).catch(() => loadAll()); // ถ้า API fail → ให้โหลดต่อ
  }, [status, spreadsheetId]);

  const loadAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      // 1. lookup → sheetName, configName, catalogName
      const lRes = await fetch(`/api/receipt/lookup?spreadsheetId=${spreadsheetId}`);
      if (!lRes.ok) throw new Error((await lRes.json().catch(() => ({}))).error || "ไม่พบ config");
      const meta = await lRes.json();

      const catalogName: string = meta.catalogName || "Helper_P";
      setSheetName(meta.sheetName);

      // 2. receipt/config → column indices
      const cfgRes  = await fetch(`/api/receipt/config?spreadsheetId=${encodeURIComponent(spreadsheetId)}&configName=${encodeURIComponent(meta.configName)}`);
      const cfgData = cfgRes.ok ? await cfgRes.json() : { fields: [] };
      const fields: ConfigField[] = cfgData.fields || [];

      const productIdx  = findField(fields, "product", "costume", "item") ?? findFieldLike(fields, "product", "costume", "ชุด");
      const statusIdx   = findField(fields, "status") ?? findFieldLike(fields, "status", "สถานะ");
      const custNameIdx = findFieldLike(fields, "cust_name") ?? findFieldLike(fields, "name", "ชื่อ");
      const custPhoneIdx= findFieldLike(fields, "cust_phone") ?? findFieldLike(fields, "phone", "tel");
      const deadlineIdx = findField(fields, "return_deadline") ?? findFieldLike(fields, "deadline", "return");
      const priceIdx    = findField(fields, "totalprice", "price_after_discount") ?? findFieldLike(fields, "totalprice", "price_after");
      const receiptIdx  = findField(fields, "receipt_id", "receipt_no") ?? findFieldLike(fields, "receipt_id", "receipt_no");

      if (statusIdx != null) setStatusColIdx(statusIdx);

      // 3. catalog (Helper_P) + transactions in parallel
      const [catRes, txRes] = await Promise.all([
        fetch(`/api/rental/catalog?spreadsheetId=${encodeURIComponent(spreadsheetId)}&catalogName=${encodeURIComponent(catalogName)}`),
        fetch(`/api/receipt/transactions?spreadsheetId=${encodeURIComponent(spreadsheetId)}&sheetName=${encodeURIComponent(meta.sheetName)}`),
      ]);

      const catalogItems: { name: string; size: string }[] =
        catRes.ok ? ((await catRes.json()).items ?? []) : [];

      const txData = txRes.ok ? await txRes.json() : { transactions: [] };

      // 4. build active rental queue map: name.toLowerCase() → [txInfo, ...]
      type TxInfo = { rowIndex: number; custName: string; custPhone: string; returnDeadline: string; price: string; receiptId: string; txStatus: string };
      const activeMap = new Map<string, TxInfo[]>();

      for (const tx of (txData.transactions || []) as { rowIndex: number; data: any[] }[]) {
        const product = getVal(tx.data, productIdx);
        if (!product) continue;
        const st = getVal(tx.data, statusIdx);
        if (isReturned(st)) continue;

        const key = product.toLowerCase();
        if (!activeMap.has(key)) activeMap.set(key, []);
        activeMap.get(key)!.push({
          rowIndex:       tx.rowIndex,
          custName:       getVal(tx.data, custNameIdx),
          custPhone:      getVal(tx.data, custPhoneIdx),
          returnDeadline: getVal(tx.data, deadlineIdx),
          price:          getVal(tx.data, priceIdx),
          receiptId:      getVal(tx.data, receiptIdx),
          txStatus:       st,
        });
      }

      // 5. map 1:1 — each catalog row = 1 physical costume
      const items: CatalogItem[] = catalogItems.map(({ name, size }) => {
        const key   = name.toLowerCase();
        const queue = activeMap.get(key);
        if (queue && queue.length > 0) {
          return { name, size, status: "rented" as const, ...queue.shift()! };
        }
        return { name, size, status: "available" as const, custName: "", custPhone: "", returnDeadline: "", price: "", receiptId: "", txStatus: "" };
      });

      setCatalog(items);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [spreadsheetId]);

  const handleReturn = async (item: CatalogItem) => {
    if (statusColIdx == null || item.rowIndex == null) return;
    setReturning(item.rowIndex);
    try {
      const res = await fetch("/api/rental/return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spreadsheetId, sheetName, rowIndex: item.rowIndex, statusColIdx }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "เกิดข้อผิดพลาด");
      await loadAll();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setReturning(null);
    }
  };

  const q              = search.toLowerCase();
  const rentedItems    = catalog.filter((i) => i.status === "rented");
  const availableItems = catalog.filter((i) => i.status === "available");
  const filteredRented = rentedItems.filter((i) =>
    !q || i.name.toLowerCase().includes(q) || i.custName.toLowerCase().includes(q) || i.receiptId.toLowerCase().includes(q)
  );
  const filteredAvail  = availableItems.filter((i) =>
    !q || i.name.toLowerCase().includes(q) || i.size.toLowerCase().includes(q)
  );

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20" />
            <div className="absolute inset-0 rounded-full border-t-2 border-emerald-400 animate-spin" />
          </div>
          <p className="text-slate-400 text-sm tracking-widest uppercase animate-pulse">Loading</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] relative">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-600/6 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-teal-600/5 blur-[100px]" />
      </div>

      <QuickNavDemo isOpen={navOpen} onClose={() => setNavOpen(false)} />

      {/* Top bar */}
      <div className="relative z-20 bg-white/[0.02] backdrop-blur-xl border-b border-white/5 sticky top-0">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-14 gap-3">
            <QuickNavDemoTrigger onClick={() => setNavOpen(true)} />
            <button onClick={() => router.back()}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors shrink-0">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-400 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30 shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">สต็อคชุด</h1>
              <p className="text-[10px] text-slate-500">ว่าง / กำลังเช่า · {catalog.length} ชุดทั้งหมด</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">
                ว่าง {availableItems.length} | เช่า {rentedItems.length}
              </span>
              <button onClick={loadAll}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 px-4 sm:px-6 lg:px-8 py-6 max-w-4xl mx-auto">

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Search */}
        <div className="mb-5 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อชุด ไซส์ หรือชื่อลูกค้า..."
            className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {(["rented", "available"] as const).map((t) => {
            const isActive = tab === t;
            const count    = t === "rented" ? filteredRented.length : filteredAvail.length;
            const label    = t === "rented" ? "กำลังเช่าอยู่" : "ว่าง";
            return (
              <button key={t} onClick={() => setTab(t)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                  isActive
                    ? t === "rented"
                      ? "bg-orange-500/20 text-orange-300 border-orange-500/30"
                      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : "bg-white/5 text-slate-400 border-white/10 hover:border-white/20"
                }`}>
                {t === "rented"
                  ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                }
                {label}
                <span className={`text-[11px] px-1.5 py-0.5 rounded-md ${
                  isActive
                    ? t === "rented" ? "bg-orange-500/30" : "bg-emerald-500/30"
                    : "bg-white/10"
                }`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* ── กำลังเช่าอยู่ ── */}
        {tab === "rented" && (
          <div className="space-y-3">
            {filteredRented.length === 0 ? (
              <div className="bg-white/[0.03] rounded-2xl border border-white/10 py-16 text-center text-slate-500 text-sm">
                {rentedItems.length === 0 ? "ไม่มีชุดที่กำลังเช่าอยู่ 🎉" : "ไม่พบรายการที่ค้นหา"}
              </div>
            ) : (
              filteredRented.map((item, i) => {
                const badge  = deadlineBadge(item.returnDeadline);
                const isLate = badge.label.startsWith("เกิน");
                return (
                  <div key={`rented-${i}`}
                    className={`bg-white/[0.03] rounded-2xl border transition-all ${isLate ? "border-red-500/30" : "border-white/10"}`}>
                    <div className="px-5 py-4 flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isLate ? "bg-red-500/20" : "bg-orange-500/10"}`}>
                        <svg className={`w-5 h-5 ${isLate ? "text-red-400" : "text-orange-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white">{item.name}</span>
                          {item.size && (
                            <span className="text-[10px] text-slate-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md">
                              {item.size}
                            </span>
                          )}
                          {item.receiptId && <span className="text-[10px] text-slate-500 font-mono">{item.receiptId}</span>}
                          {badge.label && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border ${badge.cls}`}>
                              {badge.label}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-slate-400 flex flex-wrap gap-x-3 gap-y-0.5">
                          {item.custName       && <span>👤 {item.custName}</span>}
                          {item.custPhone      && <span>📞 {item.custPhone}</span>}
                          {item.returnDeadline && <span>📅 คืน {item.returnDeadline}</span>}
                          {item.price          && <span>💰 {item.price} ฿</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleReturn(item)}
                        disabled={returning === item.rowIndex}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/25 rounded-xl transition-all disabled:opacity-50 disabled:cursor-wait"
                      >
                        {returning === item.rowIndex ? (
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        รับคืน
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── ว่าง ── */}
        {tab === "available" && (
          <div className="bg-white/[0.04] rounded-2xl border border-white/10 overflow-hidden">
            {filteredAvail.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm">
                {availableItems.length === 0 ? "ชุดทุกตัวถูกเช่าอยู่หมดแล้ว" : "ไม่พบรายการที่ค้นหา"}
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {filteredAvail.map((item, i) => (
                  <div key={`avail-${i}`} className="px-5 py-3.5 flex items-center gap-4">
                    <div className="w-8 h-8 bg-emerald-500/10 rounded-xl flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">{item.name}</div>
                      {item.size && (
                        <div className="text-xs text-slate-500 mt-0.5">{item.size}</div>
                      )}
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                      ว่าง
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RentalStockWrapper() {
  return (
    <Suspense>
      <RentalStockPage />
    </Suspense>
  );
}
