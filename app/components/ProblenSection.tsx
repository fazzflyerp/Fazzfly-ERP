"use client";

import Image from 'next/image';

export default function ProblemsSection() {
  const problems = [
    {
      icon: (
        <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      title: "ระบบไม่เชื่อม ต่อกัน",
      description: "ข้อมูลอากาศ่ายหายไปตลอด บัญชี ไม่รู้จัดจัง สต็อกไม่อัคเดต"
    },
    {
      icon: (
        <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: "ใช้ EXCEL หลาย ไฟล์อนลับสน",
      description: "ไฟล์เอกสารซ้ำ ข้อมูลผิดพลาด และต้องจำแม่นทักเดือน"
    },
    {
      icon: (
        <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      title: "เสียเวลาป้อน งานซ้ำซ้อน",
      description: "กรอกข้อมูลซ้ำในหลายระบบ หรือใช้เอกสารแบบสิ่งห่างๆ"
    },
    {
      icon: (
        <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      title: "ขาดความรวม ของธุรกิจ",
      description: "ไม่มี DASHBOARD กลางที่เห็นรายได้ ทำให้ และสต็อกแบบเรียลไทม์"
    }
  ];

  return (
    <section
      className="relative py-20 px-6 min-h-screen flex items-center bg-gradient-to-r from-blue-300 to-cyan-200"
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/5" />

      <div className="max-w-7xl mx-auto w-full relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Side - Text and Cards */}
          <div>
            <h2
              className="text-3xl md:text-5xl font-black text-slate-900 mb-6 leading-tight"
              style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
            >
              เหนื่อยไหมกับการจัดการ
              <br />
              ธุรกิจที่กระจัดระจาย?
            </h2>

            <p
              className="text-lg text-slate-800 mb-12 font-semibold leading-relaxed"
              style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
            >
              ในยุคที่อีเมลร่วมกว่าเดิน ธุรกิจคีขาชั้นใช้ระบบแยกส่วน
              <br />
              หรือทำงานแบบแนนวล
              <br />
              อะสุสเสียเอลา ความแม่นยำ และโอกาสในการเติบโตไปอย่างเบียม ๆ
            </p>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {problems.map((problem, index) => (
                <div
                  key={index}
                  className="bg-white rounded-3xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300"
                >
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      {problem.icon}
                    </div>
                    <div>
                      <h3
                        className="font-bold text-slate-900 text-sm mb-2"
                        style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
                      >
                        {problem.title}
                      </h3>
                      <p
                        className="text-xs text-slate-600"
                        style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
                      >
                        {problem.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Button */}
            <button
              className="mt-8 px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold text-lg transition-all duration-300 hover:scale-105 shadow-lg"
              style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
            >
              รับคำปรึกษาฟรี »
            </button>
          </div>

          {/* Right Side - Image (Hidden on Mobile) */}
          <div className="hidden lg:flex relative items-center justify-center">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl max-w-sm">
              <Image
                src="/Pic1.jpg"
                alt="Business person"
                width={350}
                height={450}
                className="w-full h-auto object-cover"
              />

              {/* Puzzle piece decoration */}
              <div className="absolute top-8 right-8 w-16 h-16 border-4 border-purple-400 rounded-lg opacity-50 transform -rotate-12"></div>
              <div className="absolute top-12 right-24 w-12 h-12 border-4 border-purple-300 rounded-lg opacity-40 transform rotate-45"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}