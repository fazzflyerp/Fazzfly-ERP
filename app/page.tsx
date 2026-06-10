"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const fcSubject = { fontFamily: "var(--font-fc-subject)" };
const fcMinimal = { fontFamily: "var(--font-fc-minimal)" };

const navLinks = [
  { label: "WHY US", href: "#why-us" },
  { label: "CRM", href: "#crm" },
  { label: "ERP", href: "#erp" },
  { label: "CREATOR TOOLS", href: "#flynn" },
  { label: "DEEP ANALYTICS", href: "#analytics" },
  { label: "PRICING", href: "#pricing" },
];

/* ─────────────────────── HERO (รวม Navbar) ─────────────────────── */
function DashboardMockup() {
  const barHeights = [120, 55, 95, 48, 150, 70, 110, 58, 160, 88];
  return (
    <div className="rounded-[28px] border border-[#eee7fb] bg-white/88 p-6 shadow-2xl" style={{ backdropFilter: "blur(2px)" }}>
      <div className="grid gap-5" style={{ gridTemplateColumns: "180px 1fr" }}>
        {/* Sidebar */}
        <div className="border-r border-[#eee7fb] pr-4">
          <div className="mb-5 text-lg font-extrabold text-[#2563ff]" style={fcMinimal}>FAZZFLY</div>
          {["Dashboard","CRM","Appointment","Sale","Stock","Finance","Expense","Member","Report","Setting"].map((item) => (
            <div key={item} className={`mb-1.5 rounded-xl px-3 py-2 text-xs font-bold ${item === "Dashboard" ? "bg-[#f0e7ff] text-[#7c3aed]" : "text-[#334155]"}`} style={fcMinimal}>
              {item}
            </div>
          ))}
        </div>

        {/* Main */}
        <div className="min-w-0">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-base font-extrabold text-[#0f172a]" style={fcMinimal}>Dashboard</span>
            <span className="text-xs font-bold text-[#334155]" style={fcMinimal}>Fazzfly Clinic</span>
          </div>

          {/* KPI Cards */}
          <div className="mb-3 grid grid-cols-2 gap-2.5">
            {[
              { label: "ยอดขายรวม", val: "2,450,000", up: true, pct: "+12.4%" },
              { label: "ต้นทุนรวม",  val: "890,000",   up: false, pct: "-3.2%" },
              { label: "กำไรรวม",    val: "1,560,000", up: true, pct: "+18.7%" },
              { label: "จำนวนลูกค้า",val: "1,284",     up: true, pct: "+8.1%" },
            ].map((k) => (
              <div key={k.label} className="rounded-2xl border border-[#eee7fb] bg-white p-3 shadow-sm">
                <p className="text-[10px] font-semibold text-[#64748b]" style={fcMinimal}>{k.label}</p>
                <p className="my-1 text-sm font-extrabold text-[#0f172a]" style={fcMinimal}>{k.val}</p>
                <span className={`text-[10px] font-extrabold ${k.up ? "text-[#16a34a]" : "text-[#ef4444]"}`}>{k.pct}</span>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div className="mb-3 grid gap-2.5" style={{ gridTemplateColumns: "1.3fr 0.7fr" }}>
            {/* Bar chart */}
            <div className="rounded-2xl border border-[#eee7fb] bg-white p-3 shadow-sm">
              <p className="mb-2 text-[10px] font-bold text-[#334155]" style={fcMinimal}>ยอดขาย vs กำไร</p>
              <div className="flex items-end gap-1.5" style={{ height: 70 }}>
                {barHeights.map((h, i) => (
                  <div key={i} className="flex-1 rounded-t" style={{ height: `${h * 70 / 160}px`, background: i % 2 === 0 ? "#2563ff" : "#ff3ea5" }} />
                ))}
              </div>
            </div>
            {/* Donut */}
            <div className="rounded-2xl border border-[#eee7fb] bg-white p-3 shadow-sm">
              <p className="mb-2 text-[10px] font-bold text-[#334155]" style={fcMinimal}>สัดส่วนลูกค้า</p>
              <div className="mx-auto rounded-full" style={{ width: 64, height: 64, background: "conic-gradient(#2563ff 0 45%,#ff3ea5 45% 70%,#8b5cf6 70% 90%,#e9d5ff 90%)", position: "relative" }}>
                <div className="absolute rounded-full bg-white" style={{ inset: 16 }} />
              </div>
            </div>
          </div>

          {/* Mini row */}
          <div className="grid grid-cols-2 gap-2">
            {[["นัดหมายวันนี้","23"], ["Follow Up","18"], ["Stock Alert","7"], ["คอร์สหมดอายุ","12"]].map(([l, v]) => (
              <div key={l} className="rounded-xl border border-[#eee7fb] bg-white p-2.5 shadow-sm">
                <p className="text-[10px] text-[#64748b]" style={fcMinimal}>{l}</p>
                <p className="text-sm font-extrabold text-[#0f172a]" style={fcMinimal}>{v} รายการ</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* ── Sticky Navbar ── */}
      <nav
        className={`fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 transition-all duration-300 lg:px-14 ${
          scrolled ? "py-2 backdrop-blur-xl" : "bg-transparent py-0"
        }`}
        style={scrolled ? {
          background: "linear-gradient(to bottom, rgba(255,255,255,0.88) 60%, rgba(255,255,255,0))",
        } : undefined}
      >
        <a href="/" className="flex items-center">
          <Image
            src="/NAVlogo.png"
            alt="FAZZFLY"
            width={500}
            height={160}
            className={`w-auto transition-all duration-300 ${scrolled ? "h-16" : "h-24"}`}
            style={{ width: "auto" }}
            priority
          />
        </a>
        <div className="hidden items-center gap-8 lg:flex">
          {navLinks.map((l) => (
            <a key={l.label} href={l.href} className="font-bold tracking-wide text-gray-700 transition-colors hover:text-[#ff3ea5]" style={{ ...fcMinimal, fontSize: "16px" }}>
              {l.label}
            </a>
          ))}
        </div>
        <a href="/login" className="hidden rounded-full px-6 py-2 font-semibold text-white shadow-lg transition-all hover:opacity-90 lg:block" style={{ ...fcSubject, fontSize: "16px", background: "linear-gradient(90deg,#ff2f9f,#8b5cf6,#2563ff)" }}>
          Launch App
        </a>
        <button className="lg:hidden" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          {open ? <X className="h-6 w-6 text-gray-700" /> : <Menu className="h-6 w-6 text-gray-700" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div
          className={`fixed inset-x-4 z-40 flex flex-col gap-4 rounded-2xl bg-white/95 p-6 shadow-xl backdrop-blur-md lg:hidden transition-all duration-300 ${
            scrolled ? "top-[72px]" : "top-24"
          }`}
        >
          {navLinks.map((l) => (
            <a key={l.label} href={l.href} className="font-bold text-gray-700 transition-colors hover:text-[#ff3ea5]" style={{ ...fcMinimal, fontSize: "18px" }} onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <a href="/login" className="mt-2 rounded-full py-3 text-center font-semibold text-white transition-all hover:opacity-90" style={{ ...fcSubject, fontSize: "16px", background: "linear-gradient(90deg,#ff2f9f,#8b5cf6,#2563ff)" }} onClick={() => setOpen(false)}>
            Launch App
          </a>
        </div>
      )}

      {/* ── Hero section ── */}
      <section
        className="relative overflow-hidden"
        style={{
          background: `
            radial-gradient(circle at 92% 8%, rgba(255,47,159,.18), transparent 28%),
            radial-gradient(circle at 5% 85%, rgba(139,92,246,.13), transparent 28%),
            linear-gradient(135deg, #fff 0%, #fbf8ff 55%, #f4edff 100%)
          `,
        }}
      >
      {/* ── Hero body ── */}
      <div className="mx-auto max-w-[1800px] px-6 pt-24 lg:px-14 lg:pt-20">
        <div
          className="flex flex-col items-center gap-10 py-10 text-center lg:grid lg:items-center lg:gap-12 lg:py-16 lg:text-left"
          style={{ gridTemplateColumns: "0.85fr 1.15fr" }}
        >
          {/* Top / Left */}
          <div className="w-full">
            <h1 className="mb-5 leading-[1.12]" style={{ ...fcMinimal, color: "#081633" }}>
              <span className="block font-semibold" style={{ fontSize: "clamp(28px, 3.5vw, 56px)", letterSpacing: "-1px", color: "#081633" }}>Meet your</span>
              <span className="block font-extrabold" style={{ fontSize: "clamp(28px, 3.5vw, 56px)", letterSpacing: "-1px", background: "linear-gradient(90deg,#ff2f9f,#8b5cf6,#2563ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>All-in-One</span>
              <span className="block font-extrabold" style={{ fontSize: "clamp(28px, 3.5vw, 56px)", letterSpacing: "-1px" }}>Smart Business System</span>
            </h1>

            <p className="mb-8 font-semibold leading-relaxed text-[#334155]" style={{ ...fcSubject, fontSize: "clamp(15px, 1.8vw, 22px)" }}>
              ไม่ใช่แค่ระบบจัดการ<br />
              แต่คือพาร์ทเนอร์ที่พาธุรกิจคุณโตแบบก้าวกระโดด<br />
              <span style={{ background: "linear-gradient(90deg,#ff2f9f,#8b5cf6,#2563ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                เรียนรู้วันเดียว ใช้งานได้ทันที
              </span>
            </p>

            {/* Buttons */}
            <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:justify-center lg:justify-start">
              <a href="#register" className="w-full rounded-2xl font-extrabold text-white shadow-xl transition-all hover:opacity-90 sm:w-auto" style={{ ...fcSubject, fontSize: "17px", padding: "15px 32px", background: "linear-gradient(90deg,#ff2f9f,#8b5cf6,#2563ff)", boxShadow: "0 18px 40px rgba(139,92,246,.28)" }}>
                ทดลองใช้งานฟรี →
              </a>
              <a href="#why-us" className="w-full rounded-2xl border border-[#eee7fb] bg-white font-extrabold text-[#6d28d9] shadow-md transition-all hover:bg-[#fbf7ff] sm:w-auto" style={{ ...fcSubject, fontSize: "17px", padding: "15px 32px" }}>
                ▷ สาธิตการใช้งาน
              </a>
            </div>

            {/* Feature icons */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:gap-5">
              {[
                {
                  svg: <svg className="h-6 w-6 text-[#ff3ea5]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5.356-3.712M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a4 4 0 015.356-3.712M7 20v-2c0-.656.126-1.283.356-1.857m0 0A5.002 5.002 0 0112 13a5.002 5.002 0 014.644 3.143M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
                  title: "จัดการทุกอย่าง\nในที่เดียว", sub: "รวมทุกฟังก์ชันที่ธุรกิจต้องใช้",
                },
                {
                  svg: <svg className="h-6 w-6 text-[#8b5cf6]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
                  title: "ข้อมูลชัดเจน\nตัดสินใจไว", sub: "Dashboard เรียลไทม์",
                },
                {
                  svg: <svg className="h-6 w-6 text-[#2563ff]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
                  title: "ยืดหยุ่น ปรับได้\nตามธุรกิจ", sub: "รองรับทุกขนาดธุรกิจ",
                },
                {
                  svg: <svg className="h-6 w-6 text-[#ff3ea5]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
                  title: "ปลอดภัย มั่นใจ", sub: "ข้อมูลปลอดภัย 100%",
                },
              ].map((f, i) => (
                <div key={i} className="flex flex-col items-center text-center lg:text-left lg:items-start">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl shadow-md" style={{ background: "linear-gradient(135deg,#ffe1f2,#eef2ff)", boxShadow: "0 12px 28px rgba(139,92,246,.14)" }}>
                    {f.svg}
                  </div>
                  <p className="mb-1 text-xs font-extrabold text-[#0f172a] whitespace-pre-line" style={fcMinimal}>{f.title}</p>
                  <p className="text-[11px] leading-snug text-[#64748b]" style={fcSubject}>{f.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Dashboard Mockup (desktop only) */}
          <div className="hidden lg:block">
            <DashboardMockup />
          </div>
        </div>
      </div>
    </section>
    </>
  );
}

/* ─────────────────────── WHY US ─────────────────────── */
function WhyUs() {
  const grad = "linear-gradient(90deg,#ff2f9f,#8b5cf6,#2563ff)";
  return (
    <section
      id="why-us"
      className="px-6 py-16 lg:px-12 lg:py-24"
      style={{
        background: `
          radial-gradient(circle at 90% 10%, rgba(255,47,159,.10), transparent 30%),
          radial-gradient(circle at 6%  88%, rgba(139,92,246,.09), transparent 30%),
          #fafafa
        `,
      }}
    >
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-extrabold uppercase tracking-[.2em] text-[#94a3b8]" style={fcMinimal}>
            +เสียงจากผู้ใช้จริง
          </p>
          <h2 className="font-extrabold text-[#081633]" style={{ ...fcMinimal, fontSize: "clamp(28px,3.5vw,46px)" }}>
            ทำไมต้อง{" "}
            <span style={{ background: grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>FAZZFLY</span>
          </h2>
          <div className="mx-auto mt-4 h-1 w-14 rounded-full" style={{ background: grad }} />
        </div>

        {/* Video Section */}
        <div className="mb-16">
          <div className="relative mx-auto aspect-video max-w-4xl overflow-hidden rounded-3xl bg-gradient-to-br from-gray-800 to-gray-900 shadow-2xl">
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm transition-transform hover:scale-110">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-lg">
                  <svg className="ml-1 h-8 w-8 text-[#0b479c]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
              <p className="text-lg font-medium text-white/80" style={fcSubject}>Video Coming Soon</p>
            </div>
            <div className="absolute left-4 top-4 h-2 w-2 rounded-full bg-red-500" />
            <div className="absolute left-8 top-4 h-2 w-2 rounded-full bg-yellow-500" />
            <div className="absolute left-12 top-4 h-2 w-2 rounded-full bg-green-500" />
          </div>
        </div>

        {/* DATA IS A POWER */}
        <div className="mb-12 text-center">
          <p className="mb-6 text-xs font-extrabold uppercase tracking-[.2em] text-[#0b479c]" style={fcMinimal}>
            DATA IS A POWER
          </p>
          <p className="mx-auto max-w-3xl font-extrabold text-[#081633]" style={{ ...fcMinimal, fontSize: "clamp(24px,3vw,40px)" }}>
            ไม่ใช่แค่ระบบจัดการ แต่คือพาร์ทเนอร์ที่พาธุรกิจคุณโตแบบก้าวกระโดด
          </p>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[#64748b]" style={fcSubject}>
            เพราะเราเชื่อว่าเจ้าของธุรกิจยุคใหม่ ต้องการความเร็ว ความแม่นยำ และความคุ้มค่า
            <br />
            จ่ายเท่าที่ใช้ ได้ในสิ่งที่ต้องการ ด้วย <span className="font-bold text-[#334155]">Flexible Personalize Choice</span>
          </p>
        </div>

        {/* Bottom 2 columns */}
        <div className="mt-16 grid gap-10 md:grid-cols-2">
          {/* Col 1: pic1 + DATA IS A POWER text */}
          <div className="flex flex-col gap-5">
            <Image
              src="/whyuspic1.svg"
              alt="Why FAZZFLY 1"
              width={800}
              height={500}
              className="w-full h-auto object-cover"
            />
            <div className="space-y-2 px-2">
              <p className="text-2xl font-bold tracking-widest text-[#0b479c]" style={fcMinimal}>DATA IS A POWER</p>
              <p className="text-sm leading-relaxed text-gray-600" style={fcSubject}>
                เหมาะกับเจ้าของธุรกิจที่ต้องการขยายกิจการในอนาคต หรือต้องทำธุรกิจอื่นเพิ่ม
                เพราะข้อมูลคือสิ่งที่แพงที่สุดในโลกนี้
              </p>
            </div>
          </div>

          {/* Col 2: pic2 + bullet points */}
          <div className="flex flex-col gap-5">
            <Image
              src="/whyuspic2.svg"
              alt="Why FAZZFLY 2"
              width={800}
              height={500}
              className="w-full h-auto object-cover"
            />
            <div className="space-y-4 px-2">
              {[
                { bold: "ธุรกิจรันต่อได้ แม้คุณไม่อยู่:", text: "ข้อมูลเป๊ะ 100% ตั้งแต่หน้าบ้านยันกำไรสุทธิ" },
                { bold: "เลิกจด เลิกถาม:", text: 'รวมข้อมูล "หน้าบ้าน + หลังบ้าน" ไว้ที่เดียว ไม่ต้องเปิดหลายแอป' },
                { bold: "กำไรจริง Real-time:", text: "หักต้นทุน/ค่าคอมฯ ให้อัตโนมัติ รู้ยอดเงินเข้ากระเป๋าทันที" },
                { bold: "อ่านเกมขาด:", text: "เห็นกราฟวิเคราะห์ชัดเจน ปิดรอยรั่วธุรกิจได้แม่นยำ" },
                { bold: "คุมได้ทั่วโลก:", text: "ข้อมูลอัปเดตวินาทีต่อวินาที เหมือนนั่งเฝ้าร้านด้วยตัวเอง" },
              ].map((b, i) => (
                <div key={i} className="flex gap-3">
                  <span className="mt-1 h-5 w-5 flex-shrink-0 rounded-full bg-[#0b479c] flex items-center justify-center">
                    <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <p className="text-sm leading-relaxed text-gray-700" style={fcSubject}>
                    <span className="font-bold text-gray-900">{b.bold}</span> {b.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── SOLUTION ─────────────────────── */
function ClinicMockup() {
  return (
    <div className="relative w-full" style={{ maxWidth: 420 }}>
      {/* iMac frame */}
      <div className="rounded-2xl border border-[#e8e0ff] bg-white shadow-2xl overflow-hidden" style={{ boxShadow: "0 24px 60px rgba(139,92,246,.15)" }}>
        {/* Screen bar */}
        <div className="flex items-center gap-1.5 bg-[#f8f4ff] px-3 py-2 border-b border-[#e8e0ff]">
          <div className="h-2 w-2 rounded-full bg-red-400"/><div className="h-2 w-2 rounded-full bg-yellow-400"/><div className="h-2 w-2 rounded-full bg-green-400"/>
          <span className="ml-2 text-[10px] text-[#94a3b8]" style={fcMinimal}>FAZZFLY — Dashboard</span>
        </div>
        {/* Dashboard content */}
        <div className="grid gap-0" style={{ gridTemplateColumns: "90px 1fr" }}>
          {/* Sidebar */}
          <div className="border-r border-[#f0e8ff] bg-white p-2">
            <p className="mb-2 text-[9px] font-extrabold text-[#2563ff]" style={fcMinimal}>FAZZFLY</p>
            {["Dashboard","CRM","Appoint","Sale","Stock","Finance"].map((m, i) => (
              <div key={m} className={`mb-1 rounded-lg px-2 py-1 text-[9px] font-bold ${i === 0 ? "bg-[#f0e7ff] text-[#7c3aed]" : "text-[#334155]"}`} style={fcMinimal}>{m}</div>
            ))}
          </div>
          {/* Main */}
          <div className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-[#081633]" style={fcMinimal}>Dashboard</span>
              <span className="rounded-full bg-[#f0e7ff] px-2 py-0.5 text-[8px] font-bold text-[#7c3aed]" style={fcMinimal}>Live</span>
            </div>
            <div className="mb-2 grid grid-cols-3 gap-1.5">
              {[["1,234,000","ยอดขาย","#ff3ea5"],["324","ลูกค้า","#8b5cf6"],["641,200","กำไร","#16a34a"]].map(([v,l,c]) => (
                <div key={l} className="rounded-xl border border-[#f0e8ff] bg-white p-1.5 text-center shadow-sm">
                  <p className="text-[8px] text-[#94a3b8]" style={fcMinimal}>{l}</p>
                  <p className="text-[10px] font-extrabold" style={{ ...fcMinimal, color: c }}>{v}</p>
                </div>
              ))}
            </div>
            {/* Mini bar chart */}
            <div className="rounded-xl border border-[#f0e8ff] bg-white p-2 shadow-sm">
              <p className="mb-1 text-[8px] font-bold text-[#334155]" style={fcMinimal}>ยอดขายรายเดือน</p>
              <div className="flex items-end gap-1" style={{ height: 40 }}>
                {[55,70,45,85,60,95,75,100,80,90].map((h,i) => (
                  <div key={i} className="flex-1 rounded-t" style={{ height: `${h*40/100}px`, background: i%2===0?"#ff3ea5":"#8b5cf6", opacity: 0.75 }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* iMac stand */}
      <div className="mx-auto mt-0 h-4 w-16 rounded-b-lg bg-[#e8e0ff]" />
      <div className="mx-auto h-2 w-24 rounded-b-xl bg-[#d8d0f0]" />
    </div>
  );
}

function PhoneMockup() {
  return (
    <div className="relative mx-auto" style={{ width: 200 }}>
      <div className="rounded-[32px] border-4 border-[#1a1a2e] bg-[#1a1a2e] shadow-2xl overflow-hidden" style={{ boxShadow: "0 30px 70px rgba(26,26,46,.35)" }}>
        {/* Status bar */}
        <div className="flex items-center justify-between bg-[#1a1a2e] px-4 py-1.5">
          <span className="text-[9px] font-bold text-white">9:41</span>
          <div className="flex gap-1">
            <div className="h-1.5 w-3 rounded-sm bg-white opacity-80"/>
            <div className="h-1.5 w-1.5 rounded-full bg-white opacity-80"/>
          </div>
        </div>
        {/* LINE header */}
        <div className="flex items-center gap-2 bg-[#06C755] px-3 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#8b5cf6] text-xs font-extrabold text-white" style={fcMinimal}>F</div>
          <div>
            <p className="text-[10px] font-extrabold text-white" style={fcMinimal}>เลขาฟลินน์</p>
            <p className="text-[8px] text-green-100" style={fcMinimal}>ออนไลน์</p>
          </div>
        </div>
        {/* Chat */}
        <div className="bg-[#f5f5f5] p-2 space-y-2" style={{ minHeight: 220 }}>
          {/* Received */}
          <div className="flex gap-1.5">
            <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#8b5cf6] text-[7px] font-bold text-white">F</div>
            <div className="rounded-2xl rounded-tl-none bg-white px-2.5 py-1.5 shadow-sm" style={{ maxWidth: 130 }}>
              <p className="text-[9px] leading-relaxed text-[#334155]" style={fcSubject}>สวัสดีค่ะ! ฉันคือ เลขาฟลินน์ เลขาส่วนตัวของคุณ พร้อมช่วยเหลือการงานให้คุณทุกวัน 🌟</p>
            </div>
          </div>
          {/* File */}
          <div className="flex justify-end">
            <div className="rounded-2xl rounded-tr-none bg-[#06C755] px-2.5 py-1.5">
              <div className="flex items-center gap-1.5">
                <div className="flex h-5 w-5 items-center justify-center rounded bg-white/20">
                  <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/></svg>
                </div>
                <p className="text-[9px] font-bold text-white">Quotation_001.pdf</p>
              </div>
            </div>
          </div>
          {/* Received 2 */}
          <div className="flex gap-1.5">
            <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#8b5cf6] text-[7px] font-bold text-white">F</div>
            <div className="rounded-2xl rounded-tl-none bg-white px-2.5 py-1.5 shadow-sm">
              <p className="text-[9px] text-[#334155]" style={fcSubject}>นี่คือใบเสนอราคา ✅<br/>ส่งให้ลูกค้าได้เลยนะคะ</p>
            </div>
          </div>
          {/* CTA button */}
          <div className="mt-2 rounded-xl bg-[#8b5cf6] px-3 py-1.5 text-center">
            <p className="text-[9px] font-extrabold text-white" style={fcMinimal}>รับใบเสนอราคาแล้ว ✓</p>
          </div>
        </div>
        {/* Input bar */}
        <div className="flex items-center gap-1.5 bg-white px-2 py-1.5 border-t border-gray-100">
          <div className="flex-1 rounded-full bg-[#f5f5f5] px-2 py-1">
            <p className="text-[8px] text-[#94a3b8]" style={fcSubject}>พิมพ์ข้อความ...</p>
          </div>
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#06C755]">
            <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function SolutionSection() {
  const grad = "linear-gradient(90deg,#ff2f9f,#8b5cf6,#2563ff)";

  const check = (color: string) => (
    <svg className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color }} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>
  );

  return (
    <section
      className="relative overflow-hidden px-6 py-20 lg:px-14 lg:py-28"
      style={{
        background: `
          radial-gradient(circle at 92% 8%,  rgba(255,47,159,.10), transparent 30%),
          radial-gradient(circle at 6%  92%, rgba(139,92,246,.09), transparent 30%),
          #fafafa
        `,
      }}
    >
      {/* ── Header ── */}
      <div className="mb-16 text-center">
        <p className="mb-3 text-xs font-extrabold uppercase tracking-[.2em] text-[#94a3b8]" style={fcMinimal}>Solutions</p>
        <h2 className="font-extrabold text-[#081633]" style={{ ...fcMinimal, fontSize: "clamp(28px,3.5vw,46px)" }}>
          เลือกโซลูชันที่ใช่{" "}
          <span style={{ background: grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            สำหรับคุณ
          </span>
        </h2>
        <div className="mx-auto mt-4 h-1 w-14 rounded-full" style={{ background: grad }} />
      </div>

      {/* ── Cards grid ── */}
      <div className="mx-auto grid max-w-5xl items-stretch gap-7 lg:grid-cols-2">

        {/* ── Card 1: FAZZFLY Clinic OS ── */}
        <div className="flex flex-col overflow-hidden rounded-3xl border border-[#f5eeff] bg-white shadow-xl" style={{ boxShadow: "0 20px 56px rgba(255,47,159,.09)" }}>
          {/* Mockup area */}
          <div
            className="flex items-center justify-center overflow-hidden px-6"
            style={{ background: "linear-gradient(160deg,#fff5fb 0%,#f8f0ff 100%)", height: 320 }}
          >
            <ClinicMockup />
          </div>

          {/* Content */}
          <div className="flex flex-1 flex-col p-8">
            {/* Tag */}
            <span className="mb-5 inline-block self-start rounded-full bg-[#fff0f6] px-3 py-1 text-xs font-extrabold text-[#ff3ea5]" style={fcMinimal}>
              🏥 สำหรับคลินิก
            </span>

            {/* Name */}
            <h3 className="mb-3 text-3xl font-extrabold leading-tight" style={{ ...fcMinimal, background: "linear-gradient(90deg,#ff2f9f,#e879f9)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              FAZZFLY Clinic OS
            </h3>
            <p className="mb-6 text-sm leading-relaxed text-[#64748b]" style={fcSubject}>
              ระบบบริหารคลินิกครบวงจร จัดการทุกอย่างในที่เดียว ตั้งแต่ลูกค้า นัดหมาย สต็อก จนถึงการเงิน
            </p>

            {/* Feature list */}
            <ul className="mb-6 space-y-3">
              {["บริหารลูกค้า (CRM)","จัดการคิวและนัดหมาย","สต็อกสินค้าและคลังยา","การเงินและบัญชี","แดชบอร์ดวิเคราะห์ธุรกิจ"].map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm font-semibold text-[#334155]" style={fcSubject}>
                  {check("#ff3ea5")}{item}
                </li>
              ))}
            </ul>

            {/* เหมาะสำหรับ */}
            <div className="mb-7 rounded-2xl p-4" style={{ background: "linear-gradient(135deg,#fff5fb,#fdf0ff)" }}>
              <p className="mb-3 text-xs font-extrabold uppercase tracking-widest text-[#94a3b8]" style={fcMinimal}>เหมาะสำหรับ</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: <svg className="h-5 w-5 text-[#ff3ea5]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>, label: "คลินิกเสริมฯ" },
                  { icon: <svg className="h-5 w-5 text-[#ff3ea5]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>, label: "ร้านขายยา" },
                  { icon: <svg className="h-5 w-5 text-[#ff3ea5]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>, label: "สถานพยาบาล" },
                ].map((t) => (
                  <div key={t.label} className="flex flex-col items-center gap-1.5 rounded-xl bg-white py-2 shadow-sm">
                    {t.icon}
                    <span className="text-[10px] font-bold text-[#64748b]" style={fcMinimal}>{t.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Buttons — pushed to bottom */}
            <div className="mt-auto flex flex-wrap gap-3">
              <a href="#register" className="flex-1 rounded-2xl py-3 text-center text-sm font-extrabold text-white transition-all hover:opacity-90" style={{ ...fcSubject, background: "linear-gradient(90deg,#ff2f9f,#e879f9)", minWidth: 140 }}>
                ทดลองใช้ฟรี
              </a>
              <a href="#register" className="flex flex-1 items-center justify-center gap-1 rounded-2xl border border-[#ffd6ea] py-3 text-sm font-extrabold text-[#ff3ea5] transition-all hover:bg-[#fff0f6]" style={{ ...fcSubject, minWidth: 120 }}>
                ดู Demo →
              </a>
            </div>
          </div>
        </div>

        {/* ── Card 2: เลขาฟลินน์ ── */}
        <div className="flex flex-col overflow-hidden rounded-3xl border border-[#ede9ff] bg-white shadow-xl" style={{ boxShadow: "0 20px 56px rgba(139,92,246,.09)" }}>
          {/* Mockup area */}
          <div
            className="flex items-start justify-center overflow-hidden px-6 pt-6"
            style={{ background: "linear-gradient(160deg,#f5f0ff 0%,#eef2ff 100%)", height: 320 }}
          >
            <div style={{ transform: "scale(0.82)", transformOrigin: "top center" }}>
              <PhoneMockup />
            </div>
          </div>

          {/* Content */}
          <div className="flex flex-1 flex-col p-8">
            {/* Tag */}
            <span className="mb-5 inline-block self-start rounded-full bg-[#f5f0ff] px-3 py-1 text-xs font-extrabold text-[#8b5cf6]" style={fcMinimal}>
              ✨ สำหรับฟรีแลนซ์ &amp; ครีเอเตอร์
            </span>

            {/* Name */}
            <h3 className="mb-3 text-3xl font-extrabold leading-tight" style={{ ...fcMinimal, background: "linear-gradient(90deg,#8b5cf6,#6366f1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              เลขาฟลินน์
            </h3>
            <p className="mb-6 text-sm leading-relaxed text-[#64748b]" style={fcSubject}>
              เลขาส่วนตัว AI ใน LINE ช่วยจัดการงาน แชทลูกค้า และออกเอกสารแทนคุณ ตลอด 24 ชั่วโมง
            </p>

            {/* Feature list */}
            <ul className="mb-6 space-y-3">
              {["ตอบแชทลูกค้า 24/7","ออกใบเสนอราคาใน 30 วินาที","ติดตามงาน & แจ้งเตือน","สรุปรายได้และลูกหนี้","เชื่อมต่อกับเครื่องมือที่คุณใช้"].map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm font-semibold text-[#334155]" style={fcSubject}>
                  {check("#8b5cf6")}{item}
                </li>
              ))}
            </ul>

            {/* เหมาะสำหรับ */}
            <div className="mb-7 rounded-2xl p-4" style={{ background: "linear-gradient(135deg,#f8f4ff,#eef2ff)" }}>
              <p className="mb-3 text-xs font-extrabold uppercase tracking-widest text-[#94a3b8]" style={fcMinimal}>เหมาะสำหรับ</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: <svg className="h-5 w-5 text-[#8b5cf6]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>, label: "ฟรีแลนซ์" },
                  { icon: <svg className="h-5 w-5 text-[#8b5cf6]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.362a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>, label: "ครีเอเตอร์" },
                  { icon: <svg className="h-5 w-5 text-[#8b5cf6]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>, label: "Influencer" },
                ].map((t) => (
                  <div key={t.label} className="flex flex-col items-center gap-1.5 rounded-xl bg-white py-2 shadow-sm">
                    {t.icon}
                    <span className="text-[10px] font-bold text-[#64748b]" style={fcMinimal}>{t.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Buttons — pushed to bottom */}
            <div className="mt-auto flex flex-wrap gap-3">
              <a href="https://line.me/R/ti/p/@334ltpct" target="_blank" rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-extrabold text-white transition-all hover:opacity-90"
                style={{ ...fcSubject, background: "linear-gradient(90deg,#8b5cf6,#6366f1)", minWidth: 140 }}>
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
                ทักหาเลขาฟลินน์เลย
              </a>
              <a href="#register" className="flex flex-1 items-center justify-center gap-1 rounded-2xl border border-[#ddd6fe] py-3 text-sm font-extrabold text-[#8b5cf6] transition-all hover:bg-[#f5f0ff]" style={{ ...fcSubject, minWidth: 120 }}>
                ดูรายละเอียด →
              </a>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

/* ─────────────────────── CRM ─────────────────────── */
function CRMSection() {
  return (
    <section id="crm" className="px-6 py-16 lg:px-12 lg:py-24" style={{ background: "radial-gradient(circle at 6% 8%, rgba(255,47,159,.09), transparent 30%), radial-gradient(circle at 94% 90%, rgba(139,92,246,.08), transparent 30%), #fff" }}>
      <div className="mx-auto max-w-7xl">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Left: text + cards */}
          <div>
            <div className="mb-4 inline-block rounded-full bg-purple-600 px-4 py-1 text-sm font-semibold text-white" style={fcMinimal}>
              FAZZFLY CRM
            </div>
            <h2 className="mb-6 text-3xl font-bold text-gray-900 lg:text-4xl" style={fcMinimal}>
              มัดใจให้ติดหนึบ เปลี่ยนลูกค้าขาจร เป็นยอดขายถาวร
            </h2>
            <p className="mb-4 text-lg text-gray-700" style={fcSubject}>จำไม่ได้ว่าลูกค้ามาล่าสุดเมื่อไหร่?</p>
            <p className="mb-8 text-base text-gray-600" style={fcSubject}>
              FAZZFLY CRM ช่วยให้คุณเข้าถึง Insight ลูกค้าได้ทุกมิติ มัดใจได้ถูกจุด ติดตามเคสได้แม่นยำ
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { title: "Customer Insights", desc: "เข้าถึงข้อมูลลูกค้าทุกมิติ" },
                { title: "Sales Tracking", desc: "ติดตามยอดขายแบบ Real-time" },
                { title: "Smart Reminders", desc: "แจ้งเตือนติดตามลูกค้าอัตโนมัติ" },
                { title: "Analytics", desc: "วิเคราะห์พฤติกรรมลูกค้า" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4 rounded-xl bg-white p-5 shadow-sm">
                  <div className="rounded-lg bg-purple-100 p-3">
                    <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900" style={fcMinimal}>{item.title}</h3>
                    <p className="text-sm text-gray-600" style={fcSubject}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: crmpic (desktop only) */}
          <div className="hidden lg:flex justify-end pl-8">
            <Image
              src="/crmpic.svg"
              alt="FAZZFLY CRM"
              width={900}
              height={800}
              className="w-full h-auto object-contain object-right"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── ERP ─────────────────────── */
function ERPSection() {
  return (
    <section id="erp" className="px-6 py-16 lg:px-12 lg:py-24" style={{ background: "radial-gradient(circle at 92% 6%, rgba(139,92,246,.09), transparent 30%), radial-gradient(circle at 5% 92%, rgba(255,47,159,.08), transparent 30%), #fafafa" }}>
      <div className="mx-auto max-w-7xl">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Left: erppic (desktop only) */}
          <div className="hidden lg:flex justify-start pr-8">
            <Image
              src="/erppic.svg"
              alt="FAZZFLY ERP"
              width={900}
              height={800}
              className="w-full h-auto object-contain object-left"
            />
          </div>

          {/* Right: text + cards */}
          <div>
            <div className="mb-4 inline-block rounded-full bg-[#0b479c] px-4 py-1 text-sm font-semibold text-white" style={fcMinimal}>
              FAZZFLY ERP
            </div>
            <h2 className="mb-6 text-3xl font-bold text-gray-900 lg:text-4xl" style={fcMinimal}>
              เปลี่ยนความวุ่นวายหลังบ้าน ให้เป็นกำไรที่มองเห็นชัดเจน
            </h2>
            <p className="mb-8 text-base text-gray-600" style={fcSubject}>
              เพราะเราเข้าใจดีว่าหัวใจของธุรกิจยุคใหม่ ไม่ใช่แค่การทำงานหนัก แต่คือการมี &ldquo;ข้อมูล&rdquo; ที่แม่นยำ เพื่อใช้ตัดสินใจได้ทันที
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { title: "Inventory Management", desc: "คุมสต็อกแบบ Real-time" },
                { title: "Financial Reports", desc: "รายงานการเงินครบถ้วน" },
                { title: "Profit Tracking", desc: "ติดตามกำไรสุทธิ" },
                { title: "Cost Analysis", desc: "วิเคราะห์ต้นทุนอัตโนมัติ" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4 rounded-xl bg-[#f8f8f8] p-5">
                  <div className="rounded-lg bg-[#0b479c]/10 p-3">
                    <svg className="h-6 w-6 text-[#0b479c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900" style={fcMinimal}>{item.title}</h3>
                    <p className="text-sm text-gray-600" style={fcSubject}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── FLYNN ─────────────────────── */
function FlynnSection() {
  return (
    <section id="flynn" className="px-6 py-16 lg:px-12 lg:py-24" style={{ background: "radial-gradient(circle at 8% 10%, rgba(139,92,246,.09), transparent 30%), radial-gradient(circle at 92% 88%, rgba(255,47,159,.08), transparent 30%), #fff" }}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 text-center">
          <div className="mb-4 inline-block rounded-full bg-gradient-to-r from-purple-600 to-pink-500 px-4 py-1 text-sm font-semibold text-white" style={fcMinimal}>
            เลขาฟลินน์
          </div>
          <h2 className="text-3xl font-bold text-gray-900 lg:text-4xl" style={fcMinimal}>THE MANAGEMENT CREATOR TOOLS</h2>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Workflow Automation */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-4 w-fit rounded-lg bg-purple-100 p-3">
              <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <h3 className="mb-3 text-lg font-bold text-gray-900" style={fcMinimal}>Workflow Automation</h3>
            <p className="text-sm text-gray-600" style={fcSubject}>
              <strong>FLYNN AI (The Smart Importer):</strong> ฟีเจอร์ที่ว้าวที่สุด แค่ก๊อปปี้บรีฟงานยาวๆ จาก LINE, DM หรืออีเมลมาวางในแอป ระบบ AI จะดึงชื่อแบรนด์, ราคาจ้าง, วันส่งดราฟต์, และวันโพสต์มาลงตารางงานให้คุณอัตโนมัติ
            </p>
            <p className="mt-3 text-sm text-gray-600" style={fcSubject}>
              <strong>Centralized Pipeline:</strong> เห็นภาพรวมงานทั้งหมดตั้งแต่ &ldquo;ดีลอยู่&rdquo;, &ldquo;กำลังผลิต&rdquo;, &ldquo;รอตรวจ&rdquo; ไปจนถึง &ldquo;จบงาน&rdquo; ในหน้าเดียว
            </p>
          </div>

          {/* Financial Guardian */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-4 w-fit rounded-lg bg-green-100 p-3">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h3 className="mb-3 text-lg font-bold text-gray-900" style={fcMinimal}>Financial Guardian</h3>
            <p className="text-sm text-gray-600" style={fcSubject}>
              <strong>FLYNN-CashFlow:</strong> ติดตามทุกยอดรายได้ แยกชัดเจนว่าเงินก้อนไหน &ldquo;โอนแล้ว&rdquo; หรือ &ldquo;ยังค้างชำระ&rdquo; พร้อมระบบสรุปรายได้รายเดือน
            </p>
            <p className="mt-3 text-sm text-gray-600" style={fcSubject}>
              <strong>Automatic Invoicing:</strong> ออกใบแจ้งหนี้หรือลิงก์ทวงเงิน (N-Link) ที่ดูเป็นมืออาชีพ ส่งให้ลูกค้าได้ทันทีผ่านแชท
            </p>
          </div>

          {/* Smart Reminder */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-4 w-fit rounded-lg bg-orange-100 p-3">
              <svg className="h-6 w-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <h3 className="mb-3 text-lg font-bold text-gray-900" style={fcMinimal}>Smart Reminder</h3>
            <p className="text-sm text-gray-600" style={fcSubject}>
              <strong>FLYNN Nudge:</strong> ระบบแจ้งเตือนอัจฉริยะที่ไม่ใช่แค่เตือนตอนถึงเวลา แต่จะสะกิดคุณล่วงหน้าตาม &ldquo;ความยาก&rdquo; ของงาน เพื่อให้คุณมีเวลาปั่นดราฟต์ทัน และรักษาเครือข่ายความเชื่อใจกับเอเจนซีได้ 100%
            </p>
          </div>

          {/* Creator Insights */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-4 w-fit rounded-lg bg-blue-100 p-3">
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="mb-3 text-lg font-bold text-gray-900" style={fcMinimal}>Creator Insights</h3>
            <p className="text-sm text-gray-600" style={fcSubject}>
              <strong>Performance Tracking:</strong> ดูสถิติย้อนหลังได้ว่าแบรนด์ไหนจ้างคุณบ่อยที่สุด งานประเภทไหนที่คุณทำแล้วได้กำไรดีที่สุด เพื่อให้คุณเลือกรับงานในอนาคตได้อย่างแม่นยำ
            </p>
            <p className="mt-3 text-sm font-medium text-purple-600" style={fcSubject}>เก่งขึ้นด้วยดาต้า</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── DEEP ANALYTICS ─────────────────────── */
const CHART_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const salesChartData = CHART_MONTHS.map((m, i) => ({
  month: m,
  ยอดขาย: [820, 650, 910, 740, 1100, 980, 1200, 1050, 960, 1150, 1080, 1320][i],
  กำไร:   [310, 240, 380, 290, 450,  400, 510,  430,  395, 480,  440,  560][i],
}));

const expenseChartData = CHART_MONTHS.map((m, i) => ({
  month: m,
  เงินเดือน: [380, 390, 385, 400, 395, 410, 420, 415, 408, 425, 418, 430][i],
  ค่าดำเนินการ: [120, 145, 132, 160, 148, 175, 162, 188, 175, 192, 183, 205][i],
}));

const hrPieData = [
  { name: "พนักงานประจำ", value: 45, color: "#3b82f6" },
  { name: "Part-time",    value: 25, color: "#ec4899" },
  { name: "Freelance",    value: 20, color: "#a78bfa" },
  { name: "ฝึกงาน",      value: 10, color: "#f9a8d4" },
];

const accountChartData = CHART_MONTHS.map((m, i) => ({
  month: m,
  รายได้: [1200, 1400, 1300, 1600, 1550, 1800, 1700, 2000, 1900, 2200, 2100, 2400][i],
  ต้นทุน: [800,  900,  850,  1000, 950,  1100, 1050, 1150, 1080, 1200, 1150, 1300][i],
}));

const KPI_CARDS = [
  { label: "ยอดขายรวม (บาท)",   value: "2,450,000", avg: "204,167", max: "320,000", count: 12, bar: "bg-violet-500", iconBg: "bg-violet-500", accent: "text-violet-400", change: "+12.4", up: true,  icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { label: "ต้นทุน (บาท)",       value: "890,000",   avg: "74,167",  max: "120,000", count: 12, bar: "bg-rose-500",   iconBg: "bg-rose-500",   accent: "text-rose-400",   change: "-3.2",  up: false, icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
  { label: "กำไร (บาท)",         value: "1,560,000", avg: "130,000", max: "210,000", count: 12, bar: "bg-pink-500",   iconBg: "bg-pink-500",   accent: "text-pink-400",   change: "+18.7", up: true,  icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" },
  { label: "จำนวนลูกค้า",        value: "1,284",     avg: "107",     max: "180",     count: 12, bar: "bg-sky-500",   iconBg: "bg-sky-500",   accent: "text-sky-400",    change: "+8.1",  up: true,  icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
];

const tooltipStyle = {
  backgroundColor: "#1e293b",
  border: "1px solid #334155",
  borderRadius: "8px",
  color: "#f1f5f9",
  fontSize: "12px",
};

function AnalyticsSection() {
  const [activeTab, setActiveTab] = useState<"sales" | "hr" | "expense" | "account">("sales");

  const tabs = [
    { key: "sales"   as const, label: "ยอดขาย" },
    { key: "hr"      as const, label: "HR" },
    { key: "expense" as const, label: "รายจ่าย" },
    { key: "account" as const, label: "บัญชี" },
  ];

  return (
    <section id="analytics" className="px-6 py-16 lg:px-12 lg:py-24" style={{ background: "radial-gradient(circle at 90% 8%, rgba(255,47,159,.09), transparent 30%), radial-gradient(circle at 8% 90%, rgba(139,92,246,.09), transparent 30%), #fafafa" }}>
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-10 text-center">
          <p className="mb-2 text-sm text-pink-500" style={fcSubject}>เลิกใช้ความรู้สึก แล้วให้ Data นำทาง</p>
          <h2 className="text-4xl font-bold tracking-tight text-gray-900 lg:text-6xl" style={fcMinimal}>DEEP ANALYTICS</h2>
          <p className="mt-3 text-gray-500 text-sm" style={fcSubject}>สรุปทุก Insight ที่ธุรกิจต้องมี ครบจบใน Dashboard เดียว</p>
        </div>

        {/* Dashboard shell */}
        <div className="overflow-hidden rounded-2xl shadow-xl" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(236,72,153,0.15)", backdropFilter: "blur(12px)" }}>

          {/* Window chrome bar */}
          <div className="flex items-center gap-3 border-b border-pink-100 bg-white/80 px-5 py-3">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-red-400" />
              <div className="h-3 w-3 rounded-full bg-yellow-400" />
              <div className="h-3 w-3 rounded-full bg-green-400" />
            </div>
            <span className="ml-2 text-xs text-gray-500" style={fcMinimal}>FAZZFLY ERP — Dashboard Analytics</span>
            <div className="ml-auto flex items-center gap-2">
              <span className="rounded-full bg-pink-100 px-2.5 py-0.5 text-xs text-pink-600" style={fcMinimal}>Live</span>
              <span className="text-xs text-gray-400" style={fcSubject}>อัปเดตล่าสุด: วันนี้ 09:41</span>
            </div>
          </div>

          <div className="p-5 lg:p-6">

            {/* KPI Cards — เหมือน dashboard จริง */}
            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              {KPI_CARDS.map((k, i) => (
                <div key={i} className="relative overflow-hidden rounded-2xl border border-pink-100 bg-white p-4 shadow-md transition-all duration-300 hover:shadow-xl">
                  <div className={`absolute bottom-0 left-0 right-0 h-1.5 ${k.bar}`} />
                  <div className="mb-3 flex items-center justify-between">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${k.iconBg} shadow-md`}>
                      <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={k.icon} />
                      </svg>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${k.up ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`} style={fcMinimal}>
                      {k.up ? "▲" : "▼"} {k.change}%
                    </span>
                  </div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400" style={fcMinimal}>{k.label}</p>
                  <p className="mb-3 text-2xl font-bold text-gray-900" style={fcMinimal}>{k.value}</p>
                  <div className="border-t border-slate-100 pt-2.5 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400" style={fcSubject}>เฉลี่ย</span>
                      <span className={`font-semibold ${k.accent}`} style={fcSubject}>{k.avg}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400" style={fcSubject}>สูงสุด</span>
                      <span className="font-semibold text-slate-600" style={fcSubject}>{k.max}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400" style={fcSubject}>จำนวน</span>
                      <span className="font-semibold text-slate-600" style={fcSubject}>{k.count} รายการ</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Tab buttons */}
            <div className="mb-4 flex flex-wrap gap-2">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`rounded-lg px-5 py-2 text-sm font-semibold transition-all duration-300 ${
                    activeTab === t.key
                      ? "bg-gradient-to-r from-pink-500 to-violet-500 text-white shadow-lg shadow-pink-200"
                      : "bg-white text-slate-600 border border-slate-200 hover:border-pink-300"
                  }`}
                  style={fcMinimal}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Chart panel */}
            <div className="rounded-xl border border-pink-100 bg-white/60 p-4 lg:p-6">

              {/* ── ยอดขาย: Grouped Bar ── */}
              {activeTab === "sales" && (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-800" style={fcMinimal}>ยอดขาย vs กำไร รายเดือน</p>
                    <div className="flex gap-4 text-xs" style={fcSubject}>
                      <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-400" /> ยอดขาย</span>
                      <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-pink-400" /> กำไร</span>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={salesChartData} barGap={4} barCategoryGap="25%">
                      <defs>
                        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#60a5fa" />
                          <stop offset="100%" stopColor="#3b82f6" />
                        </linearGradient>
                        <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f472b6" />
                          <stop offset="100%" stopColor="#ec4899" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v) => `฿${Number(v).toLocaleString()}`} />
                      <Bar dataKey="ยอดขาย" fill="url(#salesGrad)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="กำไร"   fill="url(#profitGrad)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* ── HR: Donut + legend ── */}
              {activeTab === "hr" && (
                <div className="flex flex-col items-center gap-6 lg:flex-row">
                  <div className="flex-shrink-0">
                    <p className="mb-4 text-sm font-bold text-gray-800" style={fcMinimal}>สัดส่วนบุคลากร</p>
                    <ResponsiveContainer width={220} height={220}>
                      <PieChart>
                        <Pie data={hrPieData} cx="50%" cy="50%" innerRadius={65} outerRadius={100} dataKey="value" paddingAngle={3}>
                          {hrPieData.map((d, i) => (
                            <Cell key={i} fill={d.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${Number(v)}%`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                    {hrPieData.map((d, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-xl border border-pink-100 bg-white p-4">
                        <div className="h-10 w-10 flex-shrink-0 rounded-lg flex items-center justify-center" style={{ background: d.color + "33" }}>
                          <div className="h-4 w-4 rounded-full" style={{ background: d.color }} />
                        </div>
                        <div>
                          <p className="text-xs text-slate-400" style={fcSubject}>{d.name}</p>
                          <p className="text-lg font-bold text-gray-800" style={fcMinimal}>{d.value}%</p>
                          <p className="text-xs text-slate-500" style={fcSubject}>{Math.round(d.value * 2)} คน</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── รายจ่าย: Stacked Area ── */}
              {activeTab === "expense" && (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-800" style={fcMinimal}>รายจ่ายรายเดือน</p>
                    <div className="flex gap-4 text-xs" style={fcSubject}>
                      <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-pink-400" /> เงินเดือน</span>
                      <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-violet-400" /> ค่าดำเนินการ</span>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={expenseChartData}>
                      <defs>
                        <linearGradient id="salGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ec4899" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#ec4899" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="opGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v) => `฿${Number(v).toLocaleString()}`} />
                      <Area type="monotone" dataKey="เงินเดือน"     stroke="#ec4899" strokeWidth={2.5} fill="url(#salGrad)" dot={{ r: 4, fill: "#ec4899" }} activeDot={{ r: 7 }} />
                      <Area type="monotone" dataKey="ค่าดำเนินการ" stroke="#a78bfa" strokeWidth={2.5} fill="url(#opGrad)"  dot={{ r: 4, fill: "#a78bfa" }} activeDot={{ r: 7 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* ── บัญชี: 2-line ── */}
              {activeTab === "account" && (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-800" style={fcMinimal}>รายได้ vs ต้นทุน</p>
                    <div className="flex gap-4 text-xs" style={fcSubject}>
                      <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-400" /> รายได้</span>
                      <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-pink-400" /> ต้นทุน</span>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={accountChartData}>
                      <defs>
                        <linearGradient id="incAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v) => `฿${Number(v).toLocaleString()}`} />
                      <Legend wrapperStyle={{ display: "none" }} />
                      <Line type="monotone" dataKey="รายได้" stroke="#60a5fa" strokeWidth={2.5} dot={{ r: 4, fill: "#60a5fa" }} activeDot={{ r: 7 }} />
                      <Line type="monotone" dataKey="ต้นทุน" stroke="#f472b6" strokeWidth={2.5} strokeDasharray="6 3" dot={{ r: 4, fill: "#f472b6" }} activeDot={{ r: 7 }} />
                    </LineChart>
                  </ResponsiveContainer>

                  {/* Summary row เหมือน dashboard จริง */}
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {[
                      { label: "รายได้รวม",  value: "฿24.4M", color: "text-blue-400" },
                      { label: "ต้นทุนรวม",  value: "฿12.9M", color: "text-pink-400" },
                      { label: "กำไรสุทธิ",  value: "฿11.5M", color: "text-emerald-400" },
                    ].map((s, i) => (
                      <div key={i} className="rounded-lg border border-pink-100 bg-white p-3 text-center">
                        <p className="text-xs text-slate-400" style={fcSubject}>{s.label}</p>
                        <p className={`text-base font-bold ${s.color}`} style={fcMinimal}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── PRICING ─────────────────────── */
function PricingSection() {
  const grad = "linear-gradient(90deg,#ff2f9f,#8b5cf6,#2563ff)";

  const subItems = [
    {
      name: "CRM + ERP", price: "999",
      icon: <svg className="h-5 w-5 text-[#ff3ea5]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>,
      iconBg: "#fff0f6",
    },
    {
      name: "CRM", price: "699",
      icon: <svg className="h-5 w-5 text-[#6366f1]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5.356-3.712M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a4 4 0 015.356-3.712M7 20v-2c0-.656.126-1.283.356-1.857m0 0A5.002 5.002 0 0112 13a5.002 5.002 0 014.644 3.143M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
      iconBg: "#eff0ff",
    },
    {
      name: "ERP", price: "899",
      icon: <svg className="h-5 w-5 text-[#38bdf8]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
      iconBg: "#f0f9ff",
    },
  ];

  return (
    <section
      id="pricing"
      className="relative overflow-hidden px-6 py-20 text-center lg:px-14 lg:py-28"
      style={{
        background: `
          radial-gradient(circle at 92% 5%, rgba(255,47,159,.22), transparent 30%),
          radial-gradient(circle at 5% 90%, rgba(139,92,246,.15), transparent 30%),
          #fff
        `,
      }}
    >
      <div className="relative mx-auto max-w-6xl">

        {/* Logo text */}
        <p className="mb-2 text-2xl font-extrabold" style={{ ...fcMinimal, background: grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          FAZZFLY
        </p>

        {/* Title */}
        <h2 className="mb-3 font-extrabold tracking-tight text-[#081633]" style={{ ...fcMinimal, fontSize: "clamp(40px,5vw,72px)", letterSpacing: "-2px" }}>
          Choose your plan
        </h2>
        <p className="mb-14 font-semibold text-[#64748b]" style={{ ...fcSubject, fontSize: "clamp(15px,1.5vw,20px)" }}>
          เลือกแผนที่ใช่ สำหรับธุรกิจของคุณ
        </p>

        {/* Cards: 2-col on mobile (subscription full-width), 3-col on desktop */}
        <div className="grid grid-cols-2 items-stretch gap-4 lg:gap-8 lg:[grid-template-columns:1fr_1fr_1.2fr]">

          {/* ── Col 1: Standard Bundle ── */}
          <div className="flex flex-col items-center rounded-[32px] border border-[#f0e8ff] bg-white px-7 py-8 text-center shadow-lg lg:px-8 lg:py-10" style={{ boxShadow: "0 24px 60px rgba(139,92,246,.10)" }}>
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "linear-gradient(135deg,#ffe0f0,#f0e0ff)" }}>
              <svg className="h-7 w-7 text-[#ff3ea5]" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 22V12h6v10"/>
              </svg>
            </div>
            <p className="mb-1 text-lg font-extrabold text-[#081633]" style={fcMinimal}>Standard Bundle</p>
            <p className="mb-6 text-2xl font-extrabold" style={{ ...fcMinimal, background: grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              CRM + ERP
            </p>
            <p className="text-6xl font-extrabold leading-none text-[#ff3ea5]" style={fcMinimal}>10,999</p>
            <p className="mb-4 mt-1 text-sm font-bold text-[#64748b]" style={fcMinimal}>THB / MONTH</p>
            <div className="mb-8 w-full rounded-2xl bg-[#f8f4ff] px-6 py-4">
              <p className="text-sm font-semibold text-[#94a3b8]" style={fcMinimal}>จาก</p>
              <p className="text-4xl font-extrabold text-[#ff3ea5] line-through" style={fcMinimal}>12,999</p>
            </div>
            <a href="#register" className="w-full rounded-2xl py-4 text-center text-base font-extrabold text-white transition-all hover:opacity-90" style={{ ...fcSubject, background: grad }}>
              เลือกแผนนี้ →
            </a>
          </div>

          {/* ── Col 2: Essentials Only ── */}
          <div className="flex flex-col items-center rounded-[32px] border border-[#f0e8ff] bg-white px-7 py-8 text-center shadow-lg lg:px-8 lg:py-10" style={{ boxShadow: "0 24px 60px rgba(139,92,246,.10)" }}>
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "linear-gradient(135deg,#ede9ff,#e8e0ff)" }}>
              <svg className="h-7 w-7 text-[#8b5cf6]" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
              </svg>
            </div>
            <p className="mb-1 text-lg font-extrabold text-[#081633]" style={fcMinimal}>Essentials Only</p>
            <div className="flex flex-1 flex-col items-center justify-center w-full">
              <p className="mb-3 text-2xl font-extrabold text-[#ff3ea5]" style={fcMinimal}>CRM</p>
              <p className="text-5xl font-extrabold leading-none text-[#8b5cf6]" style={fcMinimal}>5,999</p>
              <div className="mt-2 rounded-xl bg-[#f8f4ff] px-4 py-1.5">
                <p className="text-sm font-semibold text-[#94a3b8]" style={fcMinimal}>จาก <span className="line-through">7,999</span></p>
              </div>
            </div>
            <hr className="my-4 w-full border-[#f0e8ff]" />
            <div className="flex flex-1 flex-col items-center justify-center w-full">
              <p className="mb-1 text-sm font-extrabold text-[#64748b]" style={fcMinimal}>Essentials Only</p>
              <p className="mb-3 text-2xl font-extrabold text-[#ff3ea5]" style={fcMinimal}>ERP</p>
              <p className="text-5xl font-extrabold leading-none text-[#8b5cf6]" style={fcMinimal}>8,999</p>
              <div className="mt-2 mb-2 rounded-xl bg-[#f8f4ff] px-4 py-1.5">
                <p className="text-sm font-semibold text-[#94a3b8]" style={fcMinimal}>FROM <span className="line-through">10,999</span></p>
              </div>
            </div>
            <a href="#register" className="w-full rounded-2xl py-4 text-center text-base font-extrabold text-white transition-all hover:opacity-90" style={{ ...fcSubject, background: "linear-gradient(90deg,#8b5cf6,#6366f1)" }}>
              เลือกแผนนี้ →
            </a>
          </div>

          {/* ── Col 3: Subscription ── */}
          <div className="col-span-2 rounded-[32px] border border-[#f0e8ff] bg-white px-7 py-8 text-left shadow-lg lg:col-span-1 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:shadow-none">
            <div className="mb-2 border-l-4 border-[#ff3ea5] pl-4">
              <h3 className="text-3xl font-extrabold text-[#081633]" style={fcMinimal}>Subscription</h3>
              <p className="text-sm text-[#64748b]" style={fcSubject}>เลือกเฉพาะระบบที่คุณต้องการ</p>
            </div>
            <div className="mt-6 flex flex-col gap-4 lg:h-[calc(100%-80px)]">
              {subItems.map((s) => (
                <div key={s.name} className="flex flex-1 items-center justify-between rounded-2xl border border-[#f0e8ff] bg-white px-5 py-4 shadow-md" style={{ boxShadow: "0 12px 30px rgba(139,92,246,.08)" }}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: s.iconBg }}>
                      {s.icon}
                    </div>
                    <span className="text-xl font-extrabold text-[#081633] lg:text-2xl" style={fcMinimal}>{s.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-extrabold text-[#ff3ea5] lg:text-sm" style={fcMinimal}>MONTHLY</p>
                    <p className="text-3xl font-extrabold text-[#081633] lg:text-4xl" style={fcMinimal}>
                      {s.price} <span className="text-sm font-bold text-[#64748b]">THB</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Trust bar */}
        <div className="mx-auto mt-10 flex flex-col items-center gap-4 rounded-3xl border border-[#eee7fb] bg-white px-6 py-5 shadow-md sm:flex-row sm:flex-wrap sm:justify-center sm:gap-6 sm:rounded-full sm:px-8 sm:py-4 lg:mt-14" style={{ maxWidth: 860 }}>
          {[
            { icon: <svg className="h-4 w-4 text-[#8b5cf6]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>, text: "ปลอดภัย มั่นใจ ด้วยระบบมาตรฐานสากล" },
            { icon: <svg className="h-4 w-4 text-[#2563ff]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>, text: "อัปเดตฟีเจอร์ใหม่ไม่จำกัด" },
            { icon: <svg className="h-4 w-4 text-[#ff3ea5]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"/></svg>, text: "ทีมซัพพอร์ตดูแลอย่างใกล้ชิด" },
          ].map((t, i) => (
            <span key={i} className="flex items-center gap-2 text-sm font-semibold text-[#334155]" style={fcSubject}>
              {t.icon}{t.text}
            </span>
          ))}
        </div>

      </div>
    </section>
  );
}

/* ─────────────────────── REGISTER FORM ─────────────────────── */
function RegisterSection() {
  const [form, setForm] = useState({
    name: "",
    business: "",
    phone: "",
    lineId: "",
    businessType: "",
    businessTypeOther: "",
    systems: [] as string[],
    date: "",
    time: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");


  const toggleSystem = (s: string) =>
    setForm((f) => ({
      ...f,
      systems: f.systems.includes(s) ? f.systems.filter((x) => x !== s) : [...f.systems, s],
    }));

  const handleSubmit = async () => {
    if (!form.name || !form.phone) {
      setErrorMsg("กรุณากรอกชื่อและเบอร์โทรศัพท์");
      return;
    }
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "เกิดข้อผิดพลาด");
      }
      setStatus("success");
    } catch (e: unknown) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "เกิดข้อผิดพลาด กรุณาลองใหม่");
    }
  };

  const grad = "linear-gradient(90deg,#ff2f9f,#8b5cf6,#2563ff)";

  const bizTypes = [
    {
      value: "Creator / Freelancer",
      label: "Creator / Freelancer",
      sub: "เน้นจัดการงาน + เงิน + Deadline",
      icon: <svg className="h-6 w-6 text-[#ff3ea5]" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>,
      iconBg: "#fff0f6",
    },
    {
      value: "Service Business / Clinic",
      label: "Service Business / Clinic",
      sub: "เน้นนัดหมาย + ข้อมูลลูกค้า + ยอดซื้อซ้ำ",
      icon: <svg className="h-6 w-6 text-[#8b5cf6]" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>,
      iconBg: "#f5f0ff",
    },
    {
      value: "Retail / Trading",
      label: "Retail / Trading",
      sub: "เน้นคุมสต็อก + บัญชีหลังบ้าน + กำไรสุทธิ",
      icon: <svg className="h-6 w-6 text-[#2563ff]" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>,
      iconBg: "#eff6ff",
    },
    {
      value: "อื่นๆ",
      label: "อื่นๆ",
      sub: "โปรดระบุ",
      icon: <svg className="h-6 w-6 text-[#64748b]" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"/></svg>,
      iconBg: "#f8fafc",
    },
  ];

  const sysOptions = [
    { value: "FAZZFLY N: จัดการงานคนโปร", label: "เลขาฟลินน์", sub: "เลขาที่ช่วยคุณให้พ้นความวุ่นวาย" },
    { value: "FAZZFLY CRM",               label: "FAZZFLY CRM", sub: "บริหารลูกค้าและทีมขาย" },
    { value: "FAZZFLY ERP",               label: "FAZZFLY ERP", sub: "จัดการหลังบ้านครบวงจร" },
    { value: "Full Ecosystem: อยากลองระบบเชื่อมต่อกันทั้งหมด", label: "Full Ecosystem", sub: "อยากลองระบบเชื่อมต่อกันทั้งหมด" },
  ];

  return (
    <section
      id="register"
      className="relative overflow-hidden px-6 py-20 lg:px-14 lg:py-28"
      style={{
        background: `
          radial-gradient(circle at 8% 10%, rgba(255,47,159,.14), transparent 30%),
          radial-gradient(circle at 95% 90%, rgba(139,92,246,.12), transparent 30%),
          linear-gradient(135deg,#fff 0%,#fbf8ff 55%,#f4edff 100%)
        `,
      }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.6fr]">

          {/* ── Left panel ── */}
          <div className="lg:pt-4">
            <p className="mb-4 text-xl font-extrabold" style={{ ...fcMinimal, background: grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              FAZZFLY
            </p>
            <h2 className="mb-4 font-extrabold leading-tight text-[#081633]" style={{ ...fcMinimal, fontSize: "clamp(32px,3.5vw,48px)" }}>
              สัมผัสความสะดวก<br />
              ที่ทำให้คุณ{" "}
              <span style={{ background: grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                &ldquo;วางใจ&rdquo;
              </span>
            </h2>
            <p className="mb-10 text-base leading-relaxed text-[#64748b]" style={fcSubject}>
              กรอกข้อมูลสั้นๆ เพื่อให้เราเตรียม Ecosystem<br />ที่เหมาะกับธุรกิจคุณที่สุด
            </p>

            <div className="mb-10 grid grid-cols-3 gap-3">
              {[
                { icon: <svg className="h-5 w-5 text-[#ff3ea5]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>, iconBg: "#fff0f6", title: "ไม่ต้องใช้บัตรเครดิต", sub: "ทดลองใช้งานได้ทันที" },
                { icon: <svg className="h-5 w-5 text-[#8b5cf6]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"/></svg>, iconBg: "#f5f0ff", title: "ยกเลิกได้ทุกเมื่อ", sub: "ไม่มีผูกมัด" },
                { icon: <svg className="h-5 w-5 text-[#2563ff]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>, iconBg: "#eff6ff", title: "ข้อมูลปลอดภัย 100%", sub: "เราปกป้องข้อมูลของคุณ" },
              ].map((t, i) => (
                <div key={i} className="flex flex-col items-center gap-2 rounded-2xl border border-[#f0e8ff] bg-white/70 p-3 text-center">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: t.iconBg }}>
                    {t.icon}
                  </div>
                  <p className="text-xs font-extrabold leading-tight text-[#081633]" style={fcMinimal}>{t.title}</p>
                  <p className="text-[10px] leading-tight text-[#64748b]" style={fcSubject}>{t.sub}</p>
                </div>
              ))}
            </div>

            {/* Mini dashboard mockup */}
            <div className="hidden rounded-2xl border border-[#eee7fb] bg-white p-5 shadow-lg lg:block" style={{ boxShadow: "0 20px 50px rgba(139,92,246,.10)" }}>
              <div className="mb-3 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-red-400" /><div className="h-2 w-2 rounded-full bg-yellow-400" /><div className="h-2 w-2 rounded-full bg-green-400" />
                <span className="ml-1 text-xs text-[#94a3b8]" style={fcMinimal}>FAZZFLY Dashboard</span>
              </div>
              <div className="mb-3 rounded-xl bg-[#f8f4ff] p-3">
                <p className="text-xs font-bold text-[#64748b]" style={fcMinimal}>ยอดขายรวม</p>
                <p className="text-2xl font-extrabold text-[#081633]" style={fcMinimal}>฿128,500</p>
                <p className="text-xs font-bold text-[#16a34a]" style={fcMinimal}>↑ +12.5%</p>
              </div>
              <div className="flex items-end gap-1.5" style={{ height: 48 }}>
                {[30, 50, 38, 65, 45, 80, 60, 90, 70, 100].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t" style={{ height: `${h * 48 / 100}px`, background: i % 2 === 0 ? "#ff3ea5" : "#8b5cf6", opacity: 0.8 }} />
                ))}
              </div>
            </div>
          </div>

          {/* ── Right panel: Form ── */}
          <div className="rounded-3xl border border-[#eee7fb] bg-white p-8 shadow-2xl" style={{ boxShadow: "0 30px 80px rgba(139,92,246,.10)" }}>

            {/* Row 1: ชื่อ + ธุรกิจ */}
            <div className="mb-5 grid grid-cols-2 gap-4">
              {[
                { label: "ชื่อ-นามสกุล", key: "name", placeholder: "กรอกชื่อ-นามสกุล", icon: <svg className="h-4 w-4 text-[#94a3b8]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg> },
                { label: "ชื่อธุรกิจ / ชื่อแบรนด์ของคุณ", key: "business", placeholder: "กรอกชื่อธุรกิจ", icon: <svg className="h-4 w-4 text-[#94a3b8]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg> },
              ].map((f) => (
                <div key={f.key}>
                  <label className="mb-1.5 block text-xs font-bold text-[#334155]" style={fcMinimal}>{f.label}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2">{f.icon}</span>
                    <input type="text" placeholder={f.placeholder} value={(form as any)[f.key]}
                      onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full rounded-xl border border-[#e8e0ff] py-3 pl-9 pr-4 text-sm font-semibold text-[#0f172a] outline-none transition placeholder:font-normal placeholder:text-[#94a3b8] focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#8b5cf6]/20"
                      style={fcSubject} />
                  </div>
                </div>
              ))}
            </div>

            {/* Row 2: เบอร์ + Line ID */}
            <div className="mb-5 grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#334155]" style={fcMinimal}>เบอร์โทรศัพท์</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2">
                    <svg className="h-4 w-4 text-[#94a3b8]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                  </span>
                  <input type="text" placeholder="08X-XXX-XXXX" value={form.phone}
                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full rounded-xl border border-[#e8e0ff] py-3 pl-9 pr-4 text-sm font-semibold text-[#0f172a] outline-none transition placeholder:font-normal placeholder:text-[#94a3b8] focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#8b5cf6]/20"
                    style={fcSubject} />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#334155]" style={fcMinimal}>Line ID</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2">
                    <svg className="h-4 w-4 text-[#94a3b8]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                  </span>
                  <input type="text" placeholder="@yourlineid" value={form.lineId}
                    onChange={(e) => setForm((p) => ({ ...p, lineId: e.target.value }))}
                    className="w-full rounded-xl border border-[#e8e0ff] py-3 pl-9 pr-4 text-sm font-semibold text-[#0f172a] outline-none transition placeholder:font-normal placeholder:text-[#94a3b8] focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#8b5cf6]/20"
                    style={fcSubject} />
                </div>
                <p className="mt-1 text-[10px] text-[#94a3b8]" style={fcSubject}>เพื่อรับสิทธิ์คู่มือการใช้งานและโปรโมชั่น</p>
              </div>
            </div>

            {/* ประเภทธุรกิจ */}
            <div className="mb-5">
              <label className="mb-3 block text-xs font-bold text-[#334155]" style={fcMinimal}>ประเภทธุรกิจของคุณ</label>
              <div className="grid grid-cols-4 gap-2">
                {bizTypes.map((b) => {
                  const active = form.businessType === b.value;
                  return (
                    <button key={b.value} type="button" onClick={() => setForm((p) => ({ ...p, businessType: b.value }))}
                      className="flex flex-col items-center rounded-2xl border p-3 text-center transition-all"
                      style={{ borderColor: active ? "#8b5cf6" : "#e8e0ff", background: active ? "#f5f0ff" : "#fff", boxShadow: active ? "0 0 0 2px #8b5cf640" : "none" }}>
                      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: active ? "#ede9ff" : b.iconBg }}>
                        {b.icon}
                      </div>
                      <p className="text-[10px] font-extrabold leading-tight text-[#081633]" style={fcMinimal}>{b.label}</p>
                      <p className="mt-0.5 text-[9px] leading-tight text-[#94a3b8]" style={fcSubject}>{b.sub}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* อื่นๆ — text input */}
            {form.businessType === "อื่นๆ" && (
              <div className="mb-5">
                <label className="mb-1.5 block text-xs font-bold text-[#334155]" style={fcMinimal}>โปรดระบุประเภทธุรกิจ</label>
                <input
                  type="text"
                  placeholder="กรอกประเภทธุรกิจของคุณ"
                  value={form.businessTypeOther}
                  onChange={(e) => setForm((p) => ({ ...p, businessTypeOther: e.target.value }))}
                  className="w-full rounded-xl border border-[#8b5cf6] px-4 py-3 text-sm font-semibold text-[#0f172a] outline-none transition placeholder:font-normal placeholder:text-[#94a3b8] focus:ring-2 focus:ring-[#8b5cf6]/20"
                  style={fcSubject}
                  autoFocus
                />
              </div>
            )}

            {/* ระบบที่สนใจ */}
            <div className="mb-5">
              <label className="mb-3 block text-xs font-bold text-[#334155]" style={fcMinimal}>ระบบที่คุณสนใจทดลอง (เลือกได้มากกว่า 1)</label>
              <div className="grid grid-cols-4 gap-2">
                {sysOptions.map((s) => {
                  const checked = form.systems.includes(s.value);
                  return (
                    <button key={s.value} type="button" onClick={() => toggleSystem(s.value)}
                      className="flex flex-col rounded-xl border p-3 text-left transition-all"
                      style={{ borderColor: checked ? "#8b5cf6" : "#e8e0ff", background: checked ? "#f5f0ff" : "#fff" }}>
                      <div className="mb-1 flex h-4 w-4 items-center justify-center rounded" style={{ border: `2px solid ${checked ? "#8b5cf6" : "#cbd5e1"}`, background: checked ? "#8b5cf6" : "transparent" }}>
                        {checked && <svg className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                      </div>
                      <p className="text-[10px] font-extrabold text-[#081633]" style={fcMinimal}>{s.label}</p>
                      <p className="mt-0.5 text-[9px] leading-tight text-[#94a3b8]" style={fcSubject}>{s.sub}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* วันที่ + เวลา */}
            <div className="mb-6 grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-[#334155]" style={fcMinimal}>
                  <svg className="h-3.5 w-3.5 text-[#8b5cf6]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  วันที่ต้องการสาธิต
                </label>
                <input type="date" value={form.date} min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                  className="w-full rounded-xl border border-[#e8e0ff] px-4 py-3 text-sm font-semibold text-[#0f172a] outline-none transition focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#8b5cf6]/20"
                  style={fcSubject} />
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-[#334155]" style={fcMinimal}>
                  <svg className="h-3.5 w-3.5 text-[#8b5cf6]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  เวลา
                </label>
                <input type="time" value={form.time}
                  onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
                  className="w-full rounded-xl border border-[#e8e0ff] px-4 py-3 text-sm font-semibold text-[#0f172a] outline-none transition focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#8b5cf6]/20"
                  style={fcSubject} />
              </div>
            </div>

            {errorMsg && (
              <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-500" style={fcSubject}>{errorMsg}</p>
            )}

            {status === "success" ? (
              <div className="rounded-2xl px-6 py-8 text-center" style={{ background: "linear-gradient(135deg,#f0fdf4,#dcfce7)" }}>
                <svg className="mx-auto mb-3 h-12 w-12 text-green-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <p className="text-lg font-extrabold text-green-700" style={fcMinimal}>ส่งข้อมูลสำเร็จแล้ว!</p>
                <p className="mt-1 text-sm text-green-600" style={fcSubject}>ทีมงานจะติดต่อกลับเร็วๆ นี้ครับ</p>
              </div>
            ) : (
              <button onClick={handleSubmit} disabled={status === "loading"}
                className="w-full rounded-2xl py-4 text-base font-extrabold text-white transition-all hover:opacity-90 disabled:opacity-60"
                style={{ ...fcSubject, background: grad, boxShadow: "0 12px 35px rgba(139,92,246,.30)" }}>
                {status === "loading" ? "กำลังส่ง..." : "นัดหมายเวลาสาธิตการใช้งานจริง →"}
              </button>
            )}
          </div>

        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── FOOTER ─────────────────────── */
function Footer() {
  return (
    <footer className="bg-[#0b1f4a] px-8 pt-16 pb-8 text-blue-200">
      <div className="mx-auto max-w-6xl">

        {/* top grid */}
        <div className="grid gap-12 border-b border-white/10 pb-12 lg:grid-cols-3">

          {/* col 1: brand */}
          <div className="lg:col-span-1">
            <Image src="/logo.png" alt="FAZZFLY" width={160} height={50} className="mb-4 brightness-200" style={{ width: "auto" }} />
            <p className="mb-1 text-base font-bold text-white" style={fcMinimal}>
              ระบบจัดการธุรกิจและคลินิกครบวงจร
            </p>
            <p className="text-sm leading-relaxed text-blue-300" style={fcSubject}>
              ช่วยให้ธุรกิจคุณโตไวขึ้น ทำงานน้อยลง<br />
              และไม่เสียลูกค้าอีกต่อไป
            </p>

            {/* social icons */}
            <div className="mt-6 flex gap-3">
              {/* LINE */}
              <a
                href="https://line.me/R/ti/p/@334ltpct?oat_content=url&ts=05231621"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#06C755] transition-opacity hover:opacity-80"
                title="LINE OA"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                </svg>
              </a>

              {/* Email */}
              <a
                href="mailto:fazzflyerp@gmail.com"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-opacity hover:opacity-80"
                title="Email"
              >
                <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </a>

              {/* Phone */}
              <a
                href="tel:0624126191"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-opacity hover:opacity-80"
                title="โทร"
              >
                <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </a>
            </div>
          </div>

          {/* col 2: nav links */}
          <div>
            <p className="mb-5 text-sm font-bold uppercase tracking-widest text-white" style={fcMinimal}>เมนู</p>
            <ul className="space-y-3">
              {[
                { label: "ทำไมต้อง FAZZFLY", href: "#why-us" },
                { label: "FAZZFLY CRM", href: "#crm" },
                { label: "FAZZFLY ERP", href: "#erp" },
                { label: "Creator Tools", href: "#flynn" },
                { label: "Deep Analytics", href: "#analytics" },
                { label: "ราคา", href: "#pricing" },
                { label: "ขอทดลองใช้ฟรี", href: "#register" },
              ].map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="text-sm text-blue-300 transition-colors hover:text-white" style={fcSubject}>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* col 3: company info */}
          <div>
            <p className="mb-5 text-sm font-bold uppercase tracking-widest text-white" style={fcMinimal}>ติดต่อเรา</p>
            <div className="space-y-4 text-sm text-blue-300" style={fcSubject}>
              <div>
                <p className="font-semibold text-white">บริษัท โคตรทรัพย์ซิสเต็ม 78 จำกัด</p>
                <p className="text-xs text-blue-400">KHOTSUB SYSTEM 78 CO., LTD.</p>
              </div>
              <div className="flex gap-2">
                <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <p className="leading-relaxed">
                  48/1 แกรนด์ บางกอก บูเลอวาร์ด สาทร<br />
                  ถนนกัลปพฤกษ์ แขวงบางแค เขตบางแค<br />
                  กรุงเทพมหานคร 10160
                </p>
              </div>
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 flex-shrink-0 text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 6.75z" />
                </svg>
                <a href="tel:0624126191" className="hover:text-white transition-colors">062-412-6191</a>
              </div>
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 flex-shrink-0 text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <a href="mailto:fazzflyerp@gmail.com" className="hover:text-white transition-colors">fazzflyerp@gmail.com</a>
              </div>
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="h-4 w-4 flex-shrink-0 fill-[#06C755]">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                </svg>
                <a
                  href="https://line.me/R/ti/p/@334ltpct?oat_content=url&ts=05231621"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  LINE OA: @FAZZFLY
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* bottom bar */}
        <div className="pt-8 text-center text-xs text-blue-400" style={fcSubject}>
          © 2026 KHOTSUB SYSTEM 78 CO., LTD. All rights reserved.
        </div>

      </div>
    </footer>
  );
}

/* ─────────────────────── PAGE ─────────────────────── */
export default function LandingPage() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const el = document.querySelector(hash);
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Hero />
      <WhyUs />
      <SolutionSection />
      <CRMSection />
      <ERPSection />
      <FlynnSection />
      <AnalyticsSection />
      <PricingSection />
      <RegisterSection />
      <Footer />
    </div>
  );
}
