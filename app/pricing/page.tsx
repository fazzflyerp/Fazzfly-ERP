"use client";

import Link from 'next/link';
import Navbar from '@/app/components/NavBar';

export default function PricingSection() {
  const plans = [
    {
      name: "FREE PLAN",
      price: "0",
      period: "THB",
      color: "from-[#25242e] to-slate-800",
      borderColor: "border-slate-600",
      textColor: "text-white",
      buttonText: "ลงทะเบียนใช้งานฟรี",
      buttonStyle: "border-2 border-white text-white hover:bg-white/20",
      subtitle: "ตลอดชีพ",
      description: "เหมาะสำหรับผู้ที่ต้องการทดลองใช้งานระบบก่อนตัดสินใจ พร้อมฟีเจอร์พื้นฐานที่จำเป็นของ Mini ERP",
      features: [
        "โมดูลพื้นฐาน 3 รายการ (Purchase, Usage, Inventory) พร้อม Dashboard เบื้องต้น",
        "ใช้งานบน Google Workspace ได้ทันที",
        "จัดเก็บข้อมูลบน Google Drive",
        "ไม่มีค่าบริการรายเดือน"
      ]
    },
    {
      name: "DELUXE PLAN",
      price: "5,999",
      period: "THB",
      originalPrice: "20,000 THB",
      color: "from-[#25242e] to-slate-800",
      borderColor: "border-[#1373d8]",
      textColor: "text-cyan-300",
      highlight: true,
      badge: "BEST OFFER",
      buttonText: "เริ่มต้นใช้งาน",
      buttonStyle: "border-2 border-white text-white hover:bg-white/20",
      subtitle: "จ่ายค่าติดตั้งครั้งเดียว ไม่รวมภาษี",
      subscription: "Subscription",
      subscriptionPrice: "299",
      subscriptionPeriod: "THB/MONTH",
      description: "เหมาะสำหรับธุรกิจที่ต้องการระบบ ERP ที่ครบกว่า ใช้งานง่ายกว่า และสามารถใช้งานจริงในองค์กร รองรับ Web App + Google Login และ Dashboard แบบเต็มระบบ",
      features: [
        "โมดูลทั้งหมด 7+1 รายการ (Sales, Purchase, Inventory, HR Payroll, Expense, Usage, Finance + Webapp Dashboard)",
        "ใช้งานผ่าน Web App พร้อมระบบ Google Login รองรับทั้งคอมพิวเตอร์และมือถือ",
        "Web App ที่รองรับ Google Login",
        "Dashboard ระดับองค์กร พร้อมรายงานเชิงลึก",
        "รองรับการทำงานร่วมกับ Google Workspace",
        "บันทึกค่าใช้จ่ายและคำนวณกำไรสุทธิแบบเรียลไทม์",
        "บริการหลังการขายครบวงจร พร้อมปรับระบบให้เข้ากับธุรกิจของคุณ",
        "คู่มือการใช้งาน + สอนระบบผ่าน Google Meet",
        "มีทีม Support  1 เดือนแรกฟรี"
      ]
    },
    {
      name: "ENTRY PLAN",
      price: "5,999",
      period: "THB",
      originalPrice: "12,000 THB",
      color: "from-[#25242e] to-slate-800",
      borderColor: "border-slate-600",
      textColor: "text-[#0363d4]",
      buttonText: "เริ่มต้นใช้งาน",
      buttonStyle: "border-2 border-white text-white hover:bg-white/20",
      subtitle: "ไม่รวมภาษี",
      description: "เหมาะสำหรับธุรกิจขนาดเล็กถึงขนาดกลางที่ต้องการระบบบริหารจัดการที่ใช้งานง่าย ครบทุกฟังก์ชันซื้อขาดครั้งเดียว ไม่ต้องจ่ายรายเดือนได้ระบบพร้อมใช้ระดับมืออาชีพ",
      features: [
        "โมดูลทั้งหมด 6+1 รายการ (Sales, Purchase, Inventory, Expense, Usage, Finance + Google sheets Dashboard)",
        "Dashboard สำหรับผู้บริหาร (ดูย้อนหลังได้สูงสุด 1 ปี)",
        "เชื่อมต่อกับ Google Workspace อย่างเต็มรูปแบบ",
        "บันทึกค่าใช้จ่ายและคำนวณกำไรสุทธิแบบเรียลไทม์",
        "บริการหลังการขายครบวงจร พร้อมปรับระบบให้เข้ากับธุรกิจของคุณ",
        "คู่มือการใช้งาน + สอนระบบผ่าน Google Meet",
        "มีทีม Support  1 เดือนแรกฟรี"
      ]
    }
  ];

  return (
    <section id="pricing" className="relative min-h-screen py-20 px-4 md:px-6 bg-gradient-to-br from-slate-700 via-slate-600 to-orange-300 overflow-hidden">
      <Navbar />
      
      <div className="max-w-6xl mx-auto relative z-10 pt-32">
        <div className="text-center mb-12">
          <h2 
            className="text-5xl md:text-6xl font-bold text-white mb-4"
            style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
          >
            ขับเคลื่อนวิสัยทัศน์ของคุณ
          </h2>
          <h3 
            className="text-4xl md:text-5xl font-bold mb-6"
            style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
          >
            ด้วยพลังของ <span className="text-[#0a4b97] border-">FAZ</span>
            <span className="text-[#0791ed] border-">ZF</span>
            <span className="text-cyan-300 border-">LY</span>
          </h3>

          <p 
            className="text-white text-base inline-block px-6 py-2 rounded"
            style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
          >
            Supscription ครั้งเดียว สามารถใช้งานได้ทุก Platfrom
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative rounded-2xl ${
                plan.highlight 
                  ? 'ring-4 ring-[#1373d8]' 
                  : ''
              }`}
            >
              <div className={`relative bg-gradient-to-br ${plan.color} rounded-2xl border-1 ${plan.borderColor} h-full overflow-hidden`}>
                
                {/* Best Offer Header - ด้านบนสุด */}
                {plan.badge && (
                  <div className="bg-[#1373d8] text-white py-2 text-center text-2xl rounded-t-2xl">
                    {plan.badge}
                  </div>
                )}

                {/* Header Section */}
                <div className="text-center p-6 pb-4">
                  <h3 
                    className={`text-3xl  ${plan.textColor} mb-3`}
                    style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
                  >
                    {plan.name}
                  </h3>
                  
                  {plan.originalPrice && (
                    <div className="text-slate-300 line-through text-2xl mb-1">
                      {plan.originalPrice}
                    </div>
                  )}
                  <div className="flex items-baseline justify-center gap-2 mb-1">
                    <span className={`text-5xl ${plan.textColor}`}>{plan.price}</span>
                    <span className="text-lg text-slate-200">{plan.period}</span>
                  </div>
                  <div className="text-slate-300 text-sm mb-3">{plan.subtitle}</div>

                  {plan.subscription && (
                    <div className="mb-3">
                      <div className="text-sm text-slate-200 mb-1">{plan.subscription}</div>
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-2xl text-cyan-300">{plan.subscriptionPrice}</span>
                        <span className="text-xs text-slate-300">{plan.subscriptionPeriod}</span>
                      </div>
                    </div>
                  )}

                  <button
                    className={`w-full px-6 py-2.5 rounded-full font-semibold text-sm transition-all ${plan.buttonStyle}`}
                    style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
                  >
                    {plan.buttonText}
                  </button>
                </div>

                {/* Description Section */}
                <div className="px-6 py-4 border-y border-slate-500/30">
                  <p 
                    className="text-slate-200 text-md leading-relaxed"
                    style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
                  >
                    {plan.description}
                  </p>
                </div>

                {/* Features Section */}
                <div className="p-6 space-y-2.5">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span 
                        className="text-slate-200 text-md leading-snug"
                        style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
                      >
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center p-8 bg-slate-800/70 rounded-xl backdrop-blur-sm mb-12">
          <p 
            className="text-slate-200 text-base mb-5"
            style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
          >
            ลูกค้าที่เคยใช้ <span className="font-">ENTRY PLAN</span> สามารถ อัปเกรดเป็น <span className="font text-cyan-400">DELUXE PLAN</span> ได้ทันที
            โดยไม่ต้องชำระค่า <span className="font-">SETUP</span> ระบบซ้ำ  เพียงจ่ายค่ารายเดือน <span className="font- text-cyan-400">299</span> บาท เท่านั้น
          </p>
          <button className="px-10 py-3.5 bg-cyan-500 text-white rounded-full font-semibold text-base hover:bg-cyan-600 transition-all">
            UPGRADE NOW
          </button>
        </div>

        <div className="backdrop-blur-xl rounded-3xl overflow-hidden border-4 border-purple-500 shadow-2xl mb-10 max-w-6xl mx-auto">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-slate-800/95 to-slate-700/95">
                  <th 
                    className="text-left p-8 text-white font-semibold text-2xl border-r border-purple-500/50"
                    style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
                  >
                    ตารางเปรียบเทียบ<br/>Package
                  </th>
                  <th className="text-center p-8 border-r border-purple-500/50 relative">
                    <div className="text-white font-semibold text-3xl mb-4" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
                      FREE PLAN
                    </div>
                    <button className="px-8 py-3 border-2 border-white text-white rounded-full text-base font-semibold hover:bg-white/20 transition-all">
                      เริ่มต้นใช้งาน
                    </button>
                  </th>
                  <th className="text-center p-8 border-r border-purple-500/50 bg-gradient-to-b from-blue-600/30 to-cyan-600/30 relative">
                    <div className="absolute -top-0 left-1/2 transform -translate-x-1/2 text-white px-5 py-2 rounded-full text-sm font- ">
                      BEST OFFER
                    </div>
                    <div className="text-white font-semibold text-3xl mb-4 mt-2" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
                      DELUXE PLAN
                    </div>
                    <button className="px-8 py-3 border-2 border-white text-white rounded-full text-base font-semibold hover:bg-white/20 transition-all">
                      เริ่มต้นใช้งาน
                    </button>
                  </th>
                  <th className="text-center p-8 relative">
                    <div className="text-white font-semibold text-3xl mb-4" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
                      ENTRY PLAN
                    </div>
                    <button className="px-8 py-3 border-2 border-white text-white rounded-full text-base font-semibold hover:bg-white/20 transition-all">
                      เริ่มต้นใช้งาน
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="text-lg">
                <tr className="border-t-4 border-b border-purple-500/50 bg-slate-800/80">
                  <td className="p-6 text-white font- border-r border-purple-500/50" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
                    Feature หลัก
                  </td>
                  <td className="p-6 text-center text-white text-2xl font- border-r border-purple-500/50">
                    3
                  </td>
                  <td className="p-6 text-center text-white text-2xl font- border-r border-purple-500/50 bg-blue-900/20">
                    7+1+WebApp
                  </td>
                  <td className="p-6 text-center text-white text-2xl font-">
                    6+1
                  </td>
                </tr>

                <tr className="border-b border-purple-500/50 bg-slate-800/60 hover:bg-slate-700/60 transition-colors">
                  <td className="p-6 text-white border-r border-purple-500/50" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
                    ระบบเชื่อมโยงข้อมูลอัตโนมัติ
                  </td>
                  <td className="p-6 text-center border-r border-purple-500/50">
                    <div className="flex flex-col items-center gap-1">
                      <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-white/60" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>(เบื้องต้น)</span>
                    </div>
                  </td>
                  <td className="p-6 text-center border-r border-purple-500/50 bg-blue-900/10">
                    <svg className="w-8 h-8 text-cyan-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </td>
                  <td className="p-6 text-center">
                    <svg className="w-8 h-8 text-cyan-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </td>
                </tr>

                <tr className="border-b border-purple-500/50 bg-slate-800/40 hover:bg-slate-700/60 transition-colors">
                  <td className="p-6 text-white border-r border-purple-500/50" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
                    Dashboard รวม KPI
                  </td>
                  <td className="p-6 text-center border-r border-purple-500/50">
                    <div className="flex flex-col items-center gap-1">
                      <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-white/60" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>(เบื้องต้น)</span>
                    </div>
                  </td>
                  <td className="p-6 text-center border-r border-purple-500/50 bg-blue-900/10">
                    <div className="flex flex-col items-center gap-1">
                      <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-white/80" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>(เต็มรูปแบบ)</span>
                    </div>
                  </td>
                  <td className="p-6 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <svg className="w-8 h-8 text-cyan-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-white/80" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>(ย้อนหลังสูงสุด1เดือน)</span>
                    </div>
                  </td>
                </tr>

                <tr className="border-b border-purple-500/50 bg-slate-800/60 hover:bg-slate-700/60 transition-colors">
                  <td className="p-6 text-white border-r border-purple-500/50" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
                    ใบเสร็จ และ สลิป
                  </td>
                  <td className="p-6 text-center border-r border-purple-500/50">
                    <svg className="w-8 h-8 text-red-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </td>
                  <td className="p-6 text-center border-r border-purple-500/50 bg-blue-900/10">
                    <svg className="w-8 h-8 text-cyan-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </td>
                  <td className="p-6 text-center">
                    <svg className="w-8 h-8 text-cyan-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </td>
                </tr>

                <tr className="border-b border-purple-500/50 bg-slate-800/40 hover:bg-slate-700/60 transition-colors">
                  <td className="p-6 text-white border-r border-purple-500/50" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
                    ระบบ Archive ข้อมูล
                  </td>
                  <td className="p-6 text-center border-r border-purple-500/50">
                    <svg className="w-8 h-8 text-red-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </td>
                  <td className="p-6 text-center border-r border-purple-500/50 bg-blue-900/10">
                    <svg className="w-8 h-8 text-cyan-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </td>
                  <td className="p-6 text-center">
                    <svg className="w-8 h-8 text-cyan-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </td>
                </tr>

                <tr className="border-b border-purple-500/50 bg-slate-800/60 hover:bg-slate-700/60 transition-colors">
                  <td className="p-6 text-white border-r border-purple-500/50" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
                    HR Payroll Module
                  </td>
                  <td className="p-6 text-center border-r border-purple-500/50">
                    <svg className="w-8 h-8 text-red-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </td>
                  <td className="p-6 text-center border-r border-purple-500/50 bg-blue-900/10">
                    <svg className="w-8 h-8 text-cyan-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </td>
                  <td className="p-6 text-center">
                    <svg className="w-8 h-8 text-red-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </td>
                </tr>

                <tr className="border-b border-purple-500/50 bg-slate-800/40 hover:bg-slate-700/60 transition-colors">
                  <td className="p-6 text-white border-r border-purple-500/50" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
                    ใช้งานผ่าน Mobile App
                  </td>
                  <td className="p-6 text-center border-r border-purple-500/50">
                    <svg className="w-8 h-8 text-red-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </td>
                  <td className="p-6 text-center border-r border-purple-500/50 bg-blue-900/10">
                    <svg className="w-8 h-8 text-cyan-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </td>
                  <td className="p-6 text-center">
                    <svg className="w-8 h-8 text-red-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </td>
                </tr>

                <tr className="border-b border-purple-500/50 bg-slate-800/60 hover:bg-slate-700/60 transition-colors">
                  <td className="p-6 text-white border-r border-purple-500/50" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
                    Web App Cloud
                  </td>
                  <td className="p-6 text-center border-r border-purple-500/50">
                    <svg className="w-8 h-8 text-red-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </td>
                  <td className="p-6 text-center border-r border-purple-500/50 bg-blue-900/10">
                    <svg className="w-8 h-8 text-cyan-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </td>
                  <td className="p-6 text-center">
                    <svg className="w-8 h-8 text-red-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </td>
                </tr>

                <tr className="bg-slate-800/40">
                  <td className="p-6 text-white border-r border-purple-500/50" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
                    Support
                  </td>
                  <td className="p-6 text-center border-r border-purple-500/50">
                    <svg className="w-8 h-8 text-red-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </td>
                  <td className="p-6 text-center border-r border-purple-500/50 bg-blue-900/10">
                    <span className="text-white font- text-xl" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>1 เดือน</span>
                  </td>
                  <td className="p-6 text-center">
                    <span className="text-white font- text-xl" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>1เดือน</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="text-center max-w-4xl mx-auto">
          <div className="bg-slate-800/70 backdrop-blur-xl rounded-2xl p-8 border border-slate-500/50 shadow-xl flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1 text-left">
              <h4 
                className="text-2xl font- text-white mb-3"
                style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
              >
                ปรึกษาฟรี ไม่มีค่าใช้จ่าย
              </h4>
              <p 
                className="text-white/80 text-base"
                style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
              >
                พูดคุยกับทีมงานของเรา และหาแพ็คเกจที่เหมาะกับธุรกิจคุณ
              </p>
            </div>
            <Link href="/contact">
              <button className="px-10 py-4 bg-white text-blue-600 rounded-full font-bold text-base hover:shadow-xl transition-all whitespace-nowrap">
                ติดต่อเรา
              </button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}