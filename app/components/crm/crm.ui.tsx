// app/components/crm/crm.ui.tsx
"use client";
import React from "react";

// ─── Input atoms ──────────────────────────────────────────────────────────────
const inputCls = "w-full rounded-xl border border-pink-200 bg-white px-3 py-2.5 text-sm text-slate-700 placeholder-pink-300 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-all";

export const Inp = (p: React.InputHTMLAttributes<HTMLInputElement>) =>
  <input {...p} className={`${inputCls} ${p.className ?? ""}`}/>;

export const Sel = ({ children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) =>
  <select {...p} className={inputCls}>{children}</select>;

export const Txt = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) =>
  <textarea {...p} className={`${inputCls} resize-none`}/>;

// ─── Form field wrapper ───────────────────────────────────────────────────────
export const FL = ({ label, children, full = false }: { label: string; children: React.ReactNode; full?: boolean }) => (
  <div className={full ? "col-span-2" : ""}>
    <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-1.5">{label}</p>
    {children}
  </div>
);

// ─── Status badge ─────────────────────────────────────────────────────────────
export const Badge = ({ label, bg, text }: { label: string; bg: string; text: string }) => (
  <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full ${bg} ${text}`}>{label}</span>
);

// ─── Modal ────────────────────────────────────────────────────────────────────
export const Modal = ({ onClose, children }: { onClose: () => void; children: React.ReactNode }) => (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
    <div className="absolute inset-0 backdrop-blur-sm" style={{ background: "rgba(253,242,248,0.75)" }} onClick={onClose}/>
    <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-3xl shadow-2xl shadow-pink-100 border border-pink-200 z-10">
      {children}
    </div>
  </div>
);

export const MHead = ({ title, onClose }: { title: string; onClose: () => void }) => (
  <div className="flex items-center justify-between px-6 py-4 border-b border-pink-200">
    <p className="text-base font-bold text-slate-800">{title}</p>
    <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>
  </div>
);

// ─── Buttons ──────────────────────────────────────────────────────────────────
export const BtnPrimary = ({ loading, children, className = "", ...p }: {
  loading?: boolean; children: React.ReactNode; className?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button {...p} disabled={loading || p.disabled}
    className={`flex items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-all shadow-md shadow-pink-200 hover:shadow-lg hover:shadow-pink-300 hover:-translate-y-0.5 disabled:opacity-50 ${className}`}
    style={{ background: "#e11d48" }}>
    {loading
      ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>กำลังบันทึก...</>
      : children}
  </button>
);

export const BtnSecondary = ({ children, className = "", ...p }: {
  children: React.ReactNode; className?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button {...p} className={`flex items-center justify-center gap-2 rounded-xl text-sm font-semibold bg-rose-100 hover:bg-rose-200 text-rose-700 border border-rose-200 transition-all ${className}`}>
    {children}
  </button>
);

// ─── SVG icon ─────────────────────────────────────────────────────────────────
export const Ic = ({ d, cls = "w-5 h-5" }: { d: string; cls?: string }) => (
  <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
  </svg>
);

export const IC = {
  cal:    "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  users:  "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  course: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  follow: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  plus:   "M12 4v16m8-8H4",
  edit:   "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z",
  phone:  "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z",
  warn:   "M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0",
  chL:    "M15 19l-7-7 7-7",
  chR:    "M9 5l7 7-7 7",
  check:  "M5 13l4 4L19 7",
  clock:  "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0",
  person: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
};