"use client";

import Image from 'next/image';

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 py-20 overflow-hidden pt-20">
      {/* Background */}
      <Image
        src="/hero-bg.jpg"
        alt="Hero background"
        fill
        priority
        quality={100}
        className="object-cover object-center"
        style={{ transform: "translateZ(0)" }}
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/20 z-[1]" />

      {/* Content */}
      <div className="relative z-10 text-center max-w-5xl">
        {/* MAIN TITLE */}
        <h1
          className="text-5xl md:text-7xl lg:text-6xl font-black tracking-wider text-white mb-12 leading-tight font-eng"
          style={{
            textShadow:
              "0 6px 25px rgba(0,0,0,0.6), 2px 2px 0px rgba(255,255,255,0.2)",
            fontWeight: 100,
            letterSpacing: "0.05em",
            WebkitTextStroke: "1px rgba(255,255,255,0.5)",
          }}
        >
          <br />
          <br />
          FLY YOUR BUSINESS WITH
          <br />
          <span className="block mt-4">INTELLIGENT ERP</span>
        </h1>

        {/* SUBTEXT THAI 1 */}
        <p
          className="text-xl md:text-3xl text-white/95 mb-4 font-thai"
          style={{
            textShadow: "0 3px 15px rgba(0,0,0,0.5)",
            letterSpacing: "0.02em",
          }}
        >
          ไม่ต้องใช้หลายโปรแกรมอีกต่อไป บริหารยอดขาย
        </p>

        {/* SUBTEXT THAI 2 */}
        <p
          className="text-xl md:text-3xl text-white/95 mb-16 font-thai"
          style={{
            textShadow: "0 3px 15px rgba(0,0,0,0.5)",
            letterSpacing: "0.02em",
          }}
        >
          บัญชี สต็อก และทีมงานครบ จบในที่เดียว
        </p>

        {/* CTA BUTTON */}
        <button
          className="px-14 py-5 bg-white/30 backdrop-blur-lg border-2 border-white text-white rounded-full font-bold text-xl hover:bg-white/40 transition-all duration-300 transform hover:scale-110 shadow-2xl font-thai"
          style={{
            textShadow: "0 2px 8px rgba(0,0,0,0.3)",
            letterSpacing: "0.05em",
          }}
        >
          ทดลองใช้งานฟรี
        </button>
      </div>
    </section>
  );
}
