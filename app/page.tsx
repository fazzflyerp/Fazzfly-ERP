"use client";

import { useState } from "react";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const fcSubject = { fontFamily: "var(--font-fc-subject)" };
const fcMinimal = { fontFamily: "var(--font-fc-minimal)" };
const heroText = { color: "#524e4e" };

const navLinks = [
  { label: "WHY US", href: "#why-us" },
  { label: "CRM", href: "#crm" },
  { label: "ERP", href: "#erp" },
  { label: "CREATOR TOOLS", href: "#flynn" },
  { label: "DEEP ANALYTICS", href: "#analytics" },
  { label: "PRICING", href: "#pricing" },
];

/* ─────────────────────── HERO (รวม Navbar) ─────────────────────── */
function Hero() {
  const [open, setOpen] = useState(false);

  return (
    <section
      className="relative flex h-screen flex-col overflow-hidden"
      style={{ background: "linear-gradient(135deg, #ffd7d7 0%, #e8c8f8 55%, #c3a5ff 100%)" }}
    >
      {/* container ปักขวาล่าง — รูปชิดขอบขวาภายใน */}
      <div
        className="absolute bottom-0 right-0 hidden lg:block"
        style={{ width: "58vw", height: "85vh", overflow: "hidden" }}
      >
        <img
          src="/Hero.svg"
          alt="FAZZFLY Hero"
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            height: "100%",
            width: "auto",
          }}
        />
      </div>

      {/* ── Navbar ── */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-4 lg:px-12">
        <a href="/" className="flex items-center">
          <Image src="/NAVlogo.png" alt="FAZZFLY" width={500} height={160} className="h-40 w-auto" style={{ width: "auto" }} priority />
        </a>
        <div className="hidden items-center gap-8 lg:flex">
          {navLinks.map((l) => (
            <a key={l.label} href={l.href} className="font-medium tracking-wide text-gray-700 transition-colors hover:text-[#1DBCAA]" style={{ ...fcMinimal, fontSize: "22px", fontWeight: 700 }}>
              {l.label}
            </a>
          ))}
        </div>
        <a href="/login" className="hidden rounded-full bg-[#0b479c] px-6 py-2 font-semibold text-white shadow-lg transition-all hover:bg-[#0a3d85] lg:block" style={{ ...fcSubject, fontSize: "16px" }}>
          Launch App
        </a>
        <button className="lg:hidden" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          {open ? <X className="h-6 w-6 text-gray-700" /> : <Menu className="h-6 w-6 text-gray-700" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="relative z-10 mx-6 mt-2 flex flex-col gap-4 rounded-2xl bg-white/80 p-6 backdrop-blur-sm lg:hidden">
          {navLinks.map((l) => (
            <a key={l.label} href={l.href} className="font-medium tracking-wide text-gray-700 transition-colors hover:text-[#1DBCAA]" style={{ ...fcMinimal, fontSize: "22px", fontWeight: 700 }} onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <a href="/login" className="mt-2 rounded-full bg-[#0b479c] px-6 py-2 text-center font-semibold text-white" style={{ ...fcSubject, fontSize: "16px" }} onClick={() => setOpen(false)}>
            Launch App
          </a>
        </div>
      )}

      {/* ── Hero text — ซ้ายครึ่งจอ ── */}
      <div className="relative z-10 flex flex-1 flex-col justify-center space-y-6 px-6 pb-16 pt-8 lg:w-[52%] lg:px-16 lg:py-0">
        <h1 className="font-bold leading-tight" style={{ ...fcMinimal, ...heroText, fontSize: "clamp(40px, 5vw, 64px)" }}>
          Meet your All-in-One
          <br />
          Smart Business System
        </h1>
        <div className="space-y-1">
          <p style={{ ...fcSubject, ...heroText, fontSize: "clamp(18px, 2vw, 22px)" }}>ไม่ใช่แค่ระบบจัดการ</p>
          <p style={{ ...fcSubject, ...heroText, fontSize: "clamp(18px, 2vw, 22px)" }}>แต่คือพาร์ทเนอร์ที่พาธุรกิจคุณโตแบบก้าวกระโดด</p>
          <p className="italic" style={{ ...fcSubject, ...heroText, fontSize: "clamp(15px, 1.5vw, 18px)", marginTop: "8px" }}>เรียนรู้วันเดียว ใช้งานได้ทันที</p>
        </div>
        <div className="flex flex-wrap gap-4 pt-4">
          <a href="#register" className="rounded-full font-semibold transition-all hover:opacity-90" style={{ ...fcSubject, ...heroText, background: "#a8f0dc", fontSize: "16px", padding: "12px 32px" }}>ทดลองใช้ฟรี</a>
          <a href="#register" className="rounded-full border-2 border-slate-300 bg-white font-semibold text-gray-700 transition-all hover:bg-gray-50" style={{ ...fcSubject, fontSize: "16px", padding: "12px 32px" }}>สาธิตการใช้งาน</a>
        </div>
      </div>

      {/* รูป mobile */}
      <div className="relative h-64 w-full lg:hidden">
        <Image src="/Hero.svg" alt="FAZZFLY Hero" fill className="object-cover object-top" priority />
      </div>
    </section>
  );
}

/* ─────────────────────── WHY US ─────────────────────── */
function WhyUs() {
  return (
    <section id="why-us" className="px-6 py-16 lg:px-12 lg:py-24" style={{ background: "linear-gradient(180deg, #c3a5ff 0%, #ddd0ff 20%, #eee8ff 40%, #f5f0ff 60%, #fafbff 80%, #ffffff 100%)" }}>
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-16 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-[#E85A5A]" style={fcMinimal}>
            +เสียงจากผู้ใช้จริง
          </p>
          <h2 className="text-3xl font-bold text-gray-900 lg:text-5xl" style={fcMinimal}>
            ทำไมต้อง <span className="text-[#0b479c]">FAZZFLY</span>
          </h2>
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
          <p className="mb-6 text-lg font-bold uppercase tracking-widest text-[#0b479c]" style={fcMinimal}>
            DATA IS A POWER
          </p>
          <p className="mx-auto max-w-3xl text-xl font-medium text-gray-800 lg:text-2xl" style={fcSubject}>
            ไม่ใช่แค่ระบบจัดการ แต่คือพาร์ทเนอร์ที่พาธุรกิจคุณโตแบบก้าวกระโดด
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-base text-gray-600" style={fcSubject}>
            เพราะเราเชื่อว่าเจ้าของธุรกิจยุคใหม่ ต้องการความเร็ว ความแม่นยำ และความคุ้มค่า
            <br />
            จ่ายเท่าที่ใช้ ได้ในสิ่งที่ต้องการ ด้วย Flexible Personalize Choice
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

/* ─────────────────────── CRM ─────────────────────── */
function CRMSection() {
  return (
    <section id="crm" className="bg-[#f8ebff] px-6 py-16 lg:px-12 lg:py-24">
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

          {/* Right: crmpic */}
          <div className="flex justify-end pl-8">
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
    <section id="erp" className="px-6 py-16 lg:px-12 lg:py-24" style={{ background: "linear-gradient(135deg, #e8f0ff 0%, #f0f6ff 50%, #ffffff 100%)" }}>
      <div className="mx-auto max-w-7xl">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Left: erppic */}
          <div className="flex justify-start pr-8">
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
    <section id="flynn" className="bg-[#f8ebff] px-6 py-16 lg:px-12 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 text-center">
          <div className="mb-4 inline-block rounded-full bg-gradient-to-r from-purple-600 to-pink-500 px-4 py-1 text-sm font-semibold text-white" style={fcMinimal}>
            FAZZFLY FLYNN
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
    <section id="analytics" className="px-6 py-16 lg:px-12 lg:py-24" style={{ background: "linear-gradient(135deg,#fff0f6 0%,#fce4f0 30%,#f3e8ff 70%,#ede9fe 100%)" }}>
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
  const bundles = [
    {
      tag: "Standard Bundle",
      name: "CRM + ERP",
      price: "10,999",
      from: "20,000",
      highlight: true,
      extras: ["Complimentary Access Add-on (2,000 THB)", "Marketing Pack for Beginners (5,999 THB)"],
    },
    { tag: "Essentials Only", name: "CRM", price: "5,999", from: "8,000", highlight: false, extras: [] },
    { tag: "Essentials Only", name: "ERP", price: "8,999", from: "11,000", highlight: false, extras: [] },
  ];

  const subs = [
    { name: "CRM + ERP", price: "999" },
    { name: "CRM", price: "699" },
    { name: "ERP", price: "899" },
  ];

  return (
    <section id="pricing" className="bg-white py-24 px-8">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-4xl lg:text-5xl font-bold text-center text-gray-900 mb-16" style={fcMinimal}>
          Choose your plan
        </h2>

        <div className="grid lg:grid-cols-3 gap-6 mb-12 items-center">
          {bundles.map((b) => (
            <div
              key={b.name + b.tag}
              className={`rounded-3xl p-8 border-2 flex flex-col gap-4 ${
                b.highlight
                  ? "border-[#0b479c] bg-[#0b479c] text-white shadow-2xl shadow-blue-200 scale-105"
                  : "border-gray-100 bg-gray-50 text-gray-900"
              }`}
            >
              <p className={`text-xs font-bold tracking-widest uppercase ${b.highlight ? "text-blue-200" : "text-gray-400"}`} style={fcMinimal}>
                {b.tag}
              </p>
              <h3 className="text-2xl font-bold" style={fcMinimal}>{b.name}</h3>
              <div>
                <p className={`text-sm line-through ${b.highlight ? "text-blue-300" : "text-gray-400"}`} style={fcMinimal}>
                  FROM {b.from}
                </p>
                <p className="text-4xl font-bold" style={fcMinimal}>
                  {b.price} <span className="text-lg font-normal">THB</span>
                </p>
              </div>
              {b.extras.length > 0 && (
                <div className="mt-2 space-y-2">
                  <p className="text-xs font-bold text-yellow-300 uppercase tracking-wider" style={fcMinimal}>EXCLUSIVE OFFERS</p>
                  {b.extras.map((e) => (
                    <p key={e} className="text-xs text-blue-200" style={fcSubject}>✦ {e}</p>
                  ))}
                </div>
              )}
              <a
                href="#register"
                className={`mt-auto text-center py-3 rounded-full font-bold text-sm transition-all hover:scale-105 ${
                  b.highlight ? "bg-white text-[#0b479c]" : "bg-[#0b479c] text-white"
                }`}
                style={fcSubject}
              >
                เลือกแผนนี้
              </a>
            </div>
          ))}
        </div>

        <div className="bg-gray-50 rounded-3xl p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-6 text-center" style={fcMinimal}>Subscription</h3>
          <div className="grid md:grid-cols-3 gap-4">
            {subs.map((s) => (
              <div key={s.name} className="bg-white rounded-2xl p-6 text-center shadow-sm">
                <p className="text-sm text-gray-500 mb-1" style={fcSubject}>{s.name}</p>
                <p className="text-3xl font-bold text-[#0b479c]" style={fcMinimal}>{s.price}</p>
                <p className="text-xs text-gray-400" style={fcMinimal}>THB / MONTHLY</p>
              </div>
            ))}
          </div>
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
    systems: [] as string[],
    date: "",
    time: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const systems = [
    "FAZZFLY N: จัดการงานคนโปร",
    "FAZZFLY CRM",
    "FAZZFLY ERP",
    "Full Ecosystem: อยากลองระบบเชื่อมต่อกันทั้งหมด",
  ];

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

  return (
    <section id="register" className="bg-[#f8f8f8] py-24 px-8">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-3xl lg:text-4xl font-bold text-center text-gray-900 mb-2" style={fcMinimal}>
          สัมผัสความสะดวกที่ทำให้คุณ &ldquo;วางใจ&rdquo;
        </h2>
        <p className="text-center text-gray-500 mb-10" style={fcSubject}>
          กรอกข้อมูลสั้นๆ เพื่อให้เราเตรียม Ecosystem ที่เหมาะกับธุรกิจคุณที่สุด
        </p>

        <div className="bg-white rounded-3xl p-8 shadow-lg space-y-5">
          {[
            { label: "ชื่อ-นามสกุล", key: "name", placeholder: "กรอกชื่อ-นามสกุล" },
            { label: "ชื่อธุรกิจ / ชื่อแบรนด์ของคุณ", key: "business", placeholder: "กรอกชื่อธุรกิจ" },
            { label: "เบอร์โทรศัพท์", key: "phone", placeholder: "08X-XXX-XXXX" },
            { label: "Line ID", key: "lineId", placeholder: "@yourlineid" },
          ].map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5" style={fcSubject}>
                {field.label}
              </label>
              <input
                type="text"
                placeholder={field.placeholder}
                value={(form as unknown as Record<string, string>)[field.key]}
                onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0b479c] transition"
                style={fcSubject}
              />
            </div>
          ))}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2" style={fcSubject}>
              ประเภทธุรกิจของคุณ
            </label>
            <div className="space-y-2">
              {[
                "Creator / Freelancer: (เน้นจัดการงาน + เงิน + Deadline)",
                "Service Business / Clinic: (เน้นนัดหมาย + ข้อมูลลูกค้า + ยอดซื้อซ้ำ)",
                "Retail / Trading: (เน้นคุมสต็อก + บัญชีหลังบ้าน + กำไรสุทธิ)",
                "อื่นๆ",
              ].map((t) => (
                <label key={t} className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="businessType"
                    value={t}
                    checked={form.businessType === t}
                    onChange={() => setForm((f) => ({ ...f, businessType: t }))}
                    className="mt-0.5 accent-[#0b479c]"
                  />
                  <span className="text-sm text-gray-700" style={fcSubject}>{t}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2" style={fcSubject}>
              ระบบที่คุณสนใจทดลอง (เลือกได้มากกว่า 1)
            </label>
            <div className="space-y-2">
              {systems.map((s) => (
                <label key={s} className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.systems.includes(s)}
                    onChange={() => toggleSystem(s)}
                    className="mt-0.5 accent-[#0b479c]"
                  />
                  <span className="text-sm text-gray-700" style={fcSubject}>{s}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5" style={fcSubject}>
                📅 วันที่ต้องการนัด
              </label>
              <input
                type="date"
                value={form.date}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0b479c] transition"
                style={fcSubject}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5" style={fcSubject}>
                🕐 เวลา
              </label>
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0b479c] transition"
                style={fcSubject}
              />
            </div>
          </div>

          {errorMsg && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600" style={fcSubject}>
              {errorMsg}
            </p>
          )}

          {status === "success" ? (
            <div className="rounded-xl bg-green-50 px-6 py-5 text-center" style={fcSubject}>
              <p className="text-2xl mb-1">🎉</p>
              <p className="font-bold text-green-700">ส่งข้อมูลสำเร็จแล้ว!</p>
              <p className="text-sm text-green-600 mt-1">ทีมงานจะติดต่อกลับเร็วๆ นี้ครับ</p>
            </div>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={status === "loading"}
              className="w-full py-4 bg-[#0b479c] text-white font-bold rounded-xl hover:bg-[#0a3d85] transition-all hover:scale-[1.02] shadow-lg shadow-blue-200 text-base disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={fcSubject}
            >
              {status === "loading" ? "กำลังส่ง..." : "นัดหมายเวลาสาธิตการใช้งานจริง"}
            </button>
          )}

          <div className="flex flex-wrap justify-center gap-6 pt-2 text-xs text-gray-400" style={fcSubject}>
            {["ไม่ต้องใช้บัตรเครดิต", "ยกเลิกได้ทุกเมื่อ", "ข้อมูลปลอดภัย 100%"].map((t) => (
              <span key={t} className="flex items-center gap-1">
                <span className="text-green-500">✓</span> {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── FOOTER ─────────────────────── */
function Footer() {
  return (
    <footer className="bg-[#0b479c] text-blue-200 py-10 px-8 text-center">
      <Image src="/logo.png" alt="FAZZFLY" width={100} height={30} className="mx-auto mb-4 brightness-200" style={{ width: "auto" }} />
      <p className="text-sm" style={fcSubject}>© 2025 FAZZFLY. All rights reserved.</p>
    </footer>
  );
}

/* ─────────────────────── PAGE ─────────────────────── */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Hero />
      <WhyUs />
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
