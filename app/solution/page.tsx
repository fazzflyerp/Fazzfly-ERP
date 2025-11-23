"use client";

import Link from 'next/link';
import Navbar from '@/app/components/NavBar';
export default function SolutionSection() {
  const solutions = [
    {
      icon: (
        <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),

      title: "ACCOUNTING & FINANCE",
      description: "ดูงบการเงิน รายรับรายจ่าย และรายงานแบบอัตโนมัติ ครบทุกมิติ",
      color: "from-blue-500 to-cyan-500",
      features: ["งบการเงินอัตโนมัติ", "รายงานภาษี", "วิเคราะห์กระแสเงินสด"]
    },
    {
      icon: (
        <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      title: "INVENTORY MANAGEMENT",
      description: "คุมสต็อกทุกสาขาได้แบบเรียลไทม์ พร้อมแจ้งเตือนอัตโนมัติ",
      color: "from-cyan-500 to-teal-500",
      features: ["ติดตามสต็อกแบบเรียลไทม์", "แจ้งเตือนสินค้าใกล้หมด"]
    },
    {
      icon: (
        <svg
          className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24" >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9l1.5-4.5A2 2 0 016.4 3h11.2a2 2 0 011.9 1.5L21 9m-18 0h18m-18 0v9a2 2 0 002 2h5m11-11v9a2 2 0 01-2 2h-5m-6 0v-4a2 2 0 012-2h4a2 2 0 012 2v4" />
        </svg>
      ),
      title: "SALES & MARKETING",
      description: "บริหารทีมขายและการตลาด เห็นภาพรวมธุรกิจในที่เดียว",
      color: "from-teal-500 to-emerald-500",
      features: ["CRM ครบวงจร", "ติดตาม Lead", "วิเคราะห์ยอดขาย"]
    },
    {
      icon: (
        <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      title: "HUMAN RESOURCES",
      description: "จัดการพนักงาน ลางาน เงินเดือน และประเมินผลงานครบ",
      color: "from-emerald-500 to-green-500",
      features: ["บริหารทรัพยากรบุคคล", "คำนวณเงินเดือน", "จัดการวันลา"]
    },
    {
      icon: (
        <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      title: "ANALYTICS DASHBOARD",
      description: "ดูภาพรวมธุรกิจแบบเรียลไทม์ สรุปข้อมูลทุกระบบในแดชบอร์ดเดียว",
      color: "from-green-500 to-blue-500",
      features: ["Dashboard แบบเรียลไทม์", "รายงานเชิงลึก", "พยากรณ์ธุรกิจ"]
    }
  ];

  return (
    <section id="solution" className="relative min-h-screen py-20 px-4 md:px-6 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 overflow-hidden">
      <Navbar />

      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse delay-700"></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>

        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:72px_72px]"></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10 pt-32">
        {/* Header */}
        {/* Header */}
        <div className="text-center mb-20">
          <h2
            className="text-6xl md:text-5xl font-extrabold mb-8 bg-gradient-to-r from-white via-blue-100 to-cyan-200 bg-clip-text text-transparent leading-tight font-eng"
          >
            SOLUTION
          </h2>

          <p
            className="text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto leading-relaxed mb-4 font-thai"
          >
            จากความวุ่นวายสู่ระบบที่เชื่อมต่อครบทุกจุด
          </p>

          <p
            className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent font-thai"
          >
            เร็วกว่า แม่นกว่า เติบโตง่ายกว่า
          </p>
        </div>

        {/* Solutions Flow Diagram */}
        <div className="relative mb-16 py-5">
          {/* Decorative Background Circle */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-64 h-64 md:w-96 md:h-96 border-4 border-dashed border-blue-500/20 rounded-full"></div>

          {/* Solutions positioned along the flow */}
          <div className="relative space-y-12 md:space-y-20">
            {solutions.map((solution, index) => (
              <div
                key={index}
                className="relative"
              >
                {/* Connecting Line */}
                {index < solutions.length - 1 && (
                  <div className={`hidden md:block absolute ${index % 2 === 0 ? 'left-12 right-auto' : 'left-auto right-12'} top-full h-20 w-0.5`}>
                    <div className={`h-full w-full bg-gradient-to-b ${solution.color} opacity-30`}></div>
                    <div className={`absolute ${index % 2 === 0 ? 'left-0' : 'right-0'} top-0 w-3 h-3 -translate-x-1/2 bg-gradient-to-r ${solution.color} rounded-full animate-pulse`}></div>
                    <div className={`absolute ${index % 2 === 0 ? 'left-0' : 'right-0'} bottom-0 w-3 h-3 -translate-x-1/2 bg-gradient-to-r ${solution.color} rounded-full animate-pulse`} style={{ animationDelay: '0.5s' }}></div>
                  </div>
                )}

                <div
                  className={`flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-8 ${index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                    } animate-fade-in`}
                  style={{
                    animationDelay: `${index * 0.15}s`,
                  }}
                >
                  {/* Icon Circle with Connection Point */}
                  <div className="relative flex-shrink-0">
                    {/* Glow effect */}
                    <div className={`absolute -inset-4 bg-gradient-to-r ${solution.color} opacity-20 rounded-full blur-2xl animate-pulse`}></div>

                    {/* Icon container */}
                    <div className={`relative w-20 h-20 md:w-28 md:h-28 bg-gradient-to-br ${solution.color} rounded-full flex items-center justify-center text-3xl md:text-5xl shadow-2xl border-4 border-white/20 hover:scale-110 transition-transform duration-300 cursor-pointer`}>
                      {solution.icon}
                    </div>
                  </div>

                  {/* Content Card */}
                  <div className="group flex-1 w-full max-w-2xl">
                    <div className={`relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 hover:bg-white/10 transition-all duration-500 hover:scale-[1.02] hover:border-white/20 hover:shadow-2xl ${index % 2 === 0 ? 'hover:shadow-blue-500/20' : 'hover:shadow-cyan-500/20'
                      }`}>
                      {/* Gradient overlay on hover */}
                      <div className={`absolute inset-0 bg-gradient-to-r ${solution.color} opacity-0 group-hover:opacity-5 rounded-3xl transition-opacity duration-500`}></div>

                      <div className="relative">
                        {/* Title */}
                        <h3
                          className="text-xl md:text-2xl lg:text-3xl font-bold text-white mb-3 leading-tight"
                          style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
                        >
                          {solution.title}
                        </h3>

                        {/* Description */}
                        <p
                          className="text-slate-300 text-sm md:text-base mb-5 leading-relaxed"
                          style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
                        >
                          {solution.description}
                        </p>

                        {/* Features - Horizontal Pills */}
                        <div className="flex flex-wrap gap-2">
                          {solution.features.map((feature, idx) => (
                            <div
                              key={idx}
                              className={`group/pill relative overflow-hidden px-4 py-2 bg-white/5 backdrop-blur-sm rounded-full text-xs md:text-sm text-white border border-white/10 hover:border-white/30 transition-all duration-300 cursor-default`}
                            >
                              <div className={`absolute inset-0 bg-gradient-to-r ${solution.color} opacity-0 group-hover/pill:opacity-20 transition-opacity duration-300`}></div>
                              <span className="relative" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
                                {feature}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Hover indicator */}
                      <div className={`absolute ${index % 2 === 0 ? 'right-4 md:right-6' : 'left-4 md:left-6'} bottom-4 md:bottom-6 opacity-0 group-hover:opacity-100 transform ${index % 2 === 0 ? 'translate-x-2 group-hover:translate-x-0' : '-translate-x-2 group-hover:translate-x-0'} transition-all duration-300`}>
                        <svg className="w-5 h-5 md:w-6 md:h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={index % 2 === 0 ? "M13 7l5 5m0 0l-5 5m5-5H6" : "M11 17l-5-5m0 0l5-5m-5 5h12"} />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {/* ===================== 1) เชื่อมต่ออัตโนมัติ ===================== */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-center hover:bg-white/10 hover:border-white/20 transition-all duration-300 group">
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-300">
              {/* 🔗 Icon: Connection / Sync */}
              <svg className="w-12 h-12 mx-auto text-white-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>

            <h4 className="text-xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
              เชื่อมต่ออัตโนมัติ
            </h4>
            <p className="text-slate-400 text-sm" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
              ข้อมูลซิงค์แบบเรียลไทม์<br />ไม่ต้องกรอกซ้ำ
            </p>
          </div>

          {/* ===================== 2) ปลอดภัยสูงสุด ===================== */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-center hover:bg-white/10 hover:border-white/20 transition-all duration-300 group">
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-300">
              {/* 🔒 Icon: Lock */}
              <svg className="w-10 h-10 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M16 10V7a4 4 0 10-8 0v3M5 10h14v10H5V10z" />
              </svg>
            </div>

            <h4 className="text-xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
              ปลอดภัยสูงสุด
            </h4>
            <p className="text-slate-400 text-sm" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
              เข้ารหัสทุกการเชื่อมต่อ<br />มาตรฐาน Enterprise
            </p>
          </div>

          {/* ===================== 3) ใช้งานได้ทุกที่ ===================== */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-center hover:bg-white/10 hover:border-white/20 transition-all duration-300 group">
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-300">
              {/* 📱 Icon: Devices */}
              <svg className="w-12 h-12 mx-auto text-white-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>

            <h4 className="text-xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
              ใช้งานได้ทุกที่
            </h4>
            <p className="text-slate-400 text-sm" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
              รองรับทุกอุปกรณ์<br />PC, Tablet, Mobile
            </p>
          </div>
        </div>
        {/* CTA Section */}
        <div className="text-center mb-32">
          <div className="inline-flex flex-col items-center gap-6">
            <p className="text-slate-300 text-lg" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
              พร้อมเริ่มต้นแล้วหรือยัง?
            </p>
            <Link href="#pricing">
              <button
                className="group relative px-12 py-5 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-500 bg-size-200 bg-pos-0 hover:bg-pos-100 text-white text-xl font-bold rounded-full shadow-2xl shadow-blue-500/50 transition-all duration-500 hover:scale-105 hover:shadow-cyan-500/50"
                style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif', backgroundSize: '200% 100%' }}
              >
                <span className="relative z-10">เริ่มใช้งานฟรี</span>
                <div className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>
            </Link>
            <p className="text-slate-500 text-sm" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
              ไม่ต้องใช้บัตรเครดิต • ใช้งานได้ทันที • ยกเลิกได้ตลอดเวลา
            </p>
          </div>
        </div>

        {/* The Smarter Way Section */}
        <div className="mb-20">
          {/* Section Header */}
          <div className="text-center mb-16 space-y-6">
            <h2
              className="text-6xl md:text-5xl font-extrabold mb-8 bg-gradient-to-r from-white via-blue-100 to-cyan-200 bg-clip-text text-transparent leading-tight font-eng"
            >
              <span className="text-blue-400">The Smarter Way</span>{' '}
              <span className="text-white">to Run Your Business</span>
            </h2>

            <div className="max-w-4xl mx-auto">
              <p
                className="text-lg md:text-xl text-slate-300 leading-relaxed"
                style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
              >
                <span className="font-bold text-blue-400">FAZZFLY</span> ไม่ได้เป็นแค่ระบบ ERP แต่คือ{' '}
                <span className="font-bold text-white">"เครื่องยนต์ขับเคลื่อนธุรกิจ"</span>
                <br />
                ที่ช่วยให้ทีมทำงานเร็วขึ้น ฉลาดขึ้น และแม่นยำกว่าที่เคย.
              </p>
            </div>
          </div>
          {/* Why Choose FAZZFLY Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1: ให้ระบบทำงานแทนคุณ */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 opacity-0 group-hover:opacity-20 rounded-3xl blur-xl transition-opacity duration-500"></div>
              <div className="relative h-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 hover:bg-white/10 transition-all duration-500 hover:scale-[1.02] hover:border-white/20">
                <div className="mb-6">
                  <div className="inline-flex p-4 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl shadow-lg">
                    <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white mb-4" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
                  ให้ระบบทำงานแทนคุณ
                </h3>
                <p className="text-slate-300 leading-relaxed" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
                  เปลี่ยนงานซ้ำซากให้กลายเป็นระบบอัตโนมัติที่ไม่ต้องคอยตาม ไม่ว่าจะเป็นการอัปเดตสต็อก, ออกใบแจ้งหนี้, หรือรายงานยอดขาย ทุกอย่างเกิดขึ้นอัตโนมัติแบบเรียลไทม์ ลดข้อผิดพลาด เพิ่มความเร็ว และประหยัดเวลาของทีมคุณในทุกวัน.
                </p>
              </div>
            </div>

            {/* Card 2: ตัดสินใจเร็วขึ้นจากข้อมูลจริง */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-teal-500 opacity-0 group-hover:opacity-20 rounded-3xl blur-xl transition-opacity duration-500"></div>
              <div className="relative h-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 hover:bg-white/10 transition-all duration-500 hover:scale-[1.02] hover:border-white/20">
                <div className="mb-6">
                  <div className="inline-flex p-4 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-2xl shadow-lg">
                    <svg
                      className="w-10 h-10"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      {/* จอคอม */}
                      <rect x="3" y="4" width="18" height="12" rx="2" ry="2" />

                      {/* ขาตั้ง */}
                      <path d="M8 20h8M12 16v4" />

                      {/* Line chart เท่านั้น - ชัดเจน */}
                      <path d="M7 12l3-3 3 2 4-4" strokeWidth="2" />
                      <circle cx="7" cy="12" r="1" fill="currentColor" />
                      <circle cx="10" cy="9" r="1" fill="currentColor" />
                      <circle cx="13" cy="11" r="1" fill="currentColor" />
                      <circle cx="17" cy="7" r="1" fill="currentColor" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white mb-4" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
                  ตัดสินใจเร็วขึ้น<br />จากข้อมูลจริง
                </h3>
                <p className="text-slate-300 leading-relaxed" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
                  ด้วย DASHBOARD แบบเรียลไทม์ที่รวมข้อมูลทุกแผนกไว้ในที่เดียว คุณไม่ต้องรอรายงานสิ้นเดือนหรือเปิดสิบไฟล์ EXCEL เพื่อดูยอดอีกต่อไป. ทุกตัวเลข ทุกกราฟ และทุกเทรนด์อยู่ตรงหน้า พร้อมให้คุณวิเคราะห์และตัดสินใจได้อย่างมั่นใจ
                </p>
              </div>
            </div>

            {/* Card 3: ลดต้นทุน เพิ่มเวลาให้ทีม */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-teal-500 to-emerald-500 opacity-0 group-hover:opacity-20 rounded-3xl blur-xl transition-opacity duration-500"></div>
              <div className="relative h-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 hover:bg-white/10 transition-all duration-500 hover:scale-[1.02] hover:border-white/20">
                <div className="mb-6">
                  <div className="inline-flex p-4 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-2xl shadow-lg">
                    <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white mb-4" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
                  ลดต้นทุน<br />เพิ่มเวลาให้ทีม
                </h3>
                <p className="text-slate-300 leading-relaxed" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
                  FAZZFLY ช่วยลดภาระงานเอกสาร ประสานงานเร็วขึ้น และลดความซ้ำซ้อนระหว่างแผนก เมื่อทีมไม่ต้องทำงานซ้ำ ระบบจะทำแทนอย่างมีประสิทธิภาพ ส่งผลให้ต้นทุนลดลง แต่ประสิทธิผลสูงขึ้นอย่างเห็นได้ชัด
                </p>
              </div>
            </div>

            {/* Card 4: เติบโตอย่างมีระบบ */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-green-500 opacity-0 group-hover:opacity-20 rounded-3xl blur-xl transition-opacity duration-500"></div>
              <div className="relative h-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 hover:bg-white/10 transition-all duration-500 hover:scale-[1.02] hover:border-white/20">
                <div className="mb-6">
                  <div className="inline-flex p-4 bg-gradient-to-br from-emerald-500 to-green-500 rounded-2xl shadow-lg">
                    <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white mb-4" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
                  เติบโตอย่างมีระบบ
                </h3>
                <p className="text-slate-300 leading-relaxed" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
                  FAZZFLY ช่วยให้ธุรกิจของคุณเติบโตอย่างมีโครงสร้าง รองรับการขยายทีม การเพิ่มยอดขาย และการบริหารหลายแผนก โดยไม่ต้องเพิ่มความซับซ้อนในการจัดการ
                </p>
              </div>
            </div>

            {/* Card 5: ทีมแข็งแกร่ง เพราะระบบแข็งแรง */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-blue-500 opacity-0 group-hover:opacity-20 rounded-3xl blur-xl transition-opacity duration-500"></div>
              <div className="relative h-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 hover:bg-white/10 transition-all duration-500 hover:scale-[1.02] hover:border-white/20">
                <div className="mb-6">
                  <div className="inline-flex p-4 bg-gradient-to-br from-green-500 to-blue-500 rounded-2xl shadow-lg">
                    <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white mb-4" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
                  ทีมแข็งแกร่ง<br />เพราะระบบแข็งแรง
                </h3>
                <p className="text-slate-300 leading-relaxed" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
                  FAZZFLY ทำให้ทีมของคุณทำงานร่วมกันได้อย่างราบรื่น ทุกแผนกรู้ข้อมูลตรงกัน ไม่ต้องสื่อสารซ้ำซ้อน งานเร็วขึ้น ความเข้าใจมากขึ้น และพนักงานมีเวลาทำสิ่งที่มีคุณค่าจริง ๆ
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(1.1); }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes dash {
          to {
            stroke-dashoffset: -100;
          }
        }
        .animate-pulse {
          animation: pulse 4s ease-in-out infinite;
        }
        .animate-fade-in {
          opacity: 0;
          animation: fadeIn 0.8s ease-out forwards;
        }
        .animate-dash {
          animation: dash 20s linear infinite;
        }
        .delay-700 {
          animation-delay: 0.7s;
        }
        .delay-1000 {
          animation-delay: 1s;
        }
        .bg-pos-0 {
          background-position: 0% 50%;
        }
        .bg-pos-100 {
          background-position: 100% 50%;
        }
        .bg-size-200 {
          background-size: 200% 100%;
        }
      `}</style>
    </section>
  );
}