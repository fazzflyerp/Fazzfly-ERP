"use client";

import Image from 'next/image';

export default function ProblemsSection() {
  const problems = [
    {
      title: "ระบบไม่เชื่อมต่อกัน",
      description: "ข้อมูลจากฝ่ายขายไม่ถึงบัญชี บัญชีไม่รู้ยอดจริง สต็อกไม่อัปเดตทันเวลา"
    },
    {
      title: "ใช้ EXCEL หลายไฟล์ยุ่งยาก",
      description: "ไฟล์เวอร์ชันซ้ำ ข้อมูลผิดพลาด และต้องตามแก้ทุกเดือน"
    },
    {
      title: "เสียเวลาป้อนงานซ้ำซ้อน",
      description: "กรอกข้อมูลซ้ำในหลายระบบ หรือใช้เอกสารแมนนวลที่หายง่าย"
    },
    {
      title: "ขาดภาพรวมของธุรกิจ",
      description: "ไม่มี Dashboard กลางที่เห็นรายได้ กำไร และสต็อกแบบเรียลไทม์"
    }
  ];

  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 py-20 overflow-hidden pt-20">
      {/* Background image - ใช้ Image component ของ Next.js */}
      <Image
        src="/problemsection-bg.jpg"
        alt="Hero background"
        fill
        priority
        quality={100}
        className="object-cover object-center"
        style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
      />
      {/* Decorative Dots */}
      <div className="absolute top-20 left-10 w-2 h-2 bg-white/30 rounded-full"></div>
      <div className="absolute top-32 left-24 w-3 h-3 bg-white/20 rounded-full"></div>
      <div className="absolute bottom-40 right-16 w-2 h-2 bg-blue-300/40 rounded-full"></div>

      <div className="max-w-7xl mx-auto w-full relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left Side - Text and Cards */}
          <div>
            <h2 className="text-4xl md:text-5xl font-semibold font-medium text-black mb-6 leading-tight font-thai">
              เหนื่อยไหมกับการจัดการ
              <br />
              <span className="text-black">ธุรกิจที่กระจัดระจาย?</span>
            </h2>
            <p className="text-xl text-black mb-12 font-medium leading-relaxed drop-shadow-md">
              ในยุคที่ข้อมูลไหลเร็วกว่าเดิม ธุรกิจที่ยังใช้ระบบแยกส่วน <br />
              หรือทำงานแบบแมนนวล <br />
              จะสูญเสียเวลา ความแม่นยำ และโอกาสในการเติบโตไปอย่างเงียบๆ
            </p>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {problems.map((problem, index) => (
                <div
                  key={index}
                  className="group bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 border border-white/50"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 text-base mb-2 group-hover:text-blue-600 transition-colors">
                        {problem.title}
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {problem.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Button */}
            <button className="mt-10 px-12 py-5 bg-blue-600 hover:bg-blue-400 text-white rounded-full font-bold text-lg transition-all duration-300 hover:scale-105 shadow-2xl hover:shadow-3xl group">
              <span className="flex items-center gap-2">
                รับคำปรึกษาฟรี
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </button>
          </div>

          {/* Right Side - Image */}
          <div className="hidden lg:flex relative items-center justify-center">
            <div className="relative">
              {/* Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/30 to-blue-600/30 blur-3xl rounded-3xl"></div>

              {/* Image Container */}
              <div className="relative rounded-3xl overflow-hidden shadow-2xl max-w-md border-4 border-white/20">
                <Image
                  src="/Pic1.jpg"
                  alt="Business person"
                  width={400}
                  height={500}
                  className="w-full h-auto object-cover"
                />

                {/* Floating Elements */}
                <div className="absolute top-8 right-8 w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-400 rounded-2xl opacity-80 transform -rotate-12 animate-pulse shadow-lg"></div>
                <div className="absolute bottom-12 left-8 w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl opacity-70 transform rotate-45 animate-pulse shadow-lg" style={{ animationDelay: '0.5s' }}></div>

                {/* Geometric Shapes */}
                <div className="absolute top-20 -left-6 w-20 h-20 border-4 border-white/40 rounded-full"></div>
                <div className="absolute bottom-32 -right-8 w-24 h-24 border-4 border-cyan-300/40 rounded-2xl transform rotate-12"></div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}