"use client";

import Image from 'next/image';

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 py-20 overflow-hidden pt-20">
      {/* Background image - ใช้ Image component ของ Next.js */}
      <Image
        src="/hero-bg.jpg"
        alt="Hero background"
        fill
        priority
        quality={100}
        className="object-cover object-center"
        style={{
          transform: 'translateZ(0)',
        }}
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/20 z-[1]" />

      {/* Content */}
      <div className="relative z-10 text-center max-w-5xl">
        <h1
          className="text-5xl md:text-7xl lg:text-6xl font-black tracking-wider text-white mb-12 leading-tight"
          style={{
            fontFamily: 'var(--font-orbitron), sans-serif',
            textShadow: '0 6px 25px rgba(0,0,0,0.6), 2px 2px 0px rgba(255,255,255,0.2)',
            fontWeight: 900,
            letterSpacing: '0.05em',
            WebkitTextStroke: '1px rgba(255,255,255,0.5)',
          }}
        ><br />
        <br />
        
          FLY YOUR BUSINESS WITH
          <br />
          <span className="block mt-4">INTELLIGENT ERP</span>
        </h1>

        <p
          className="text-xl md:text-3xl text-white/95 mb-4 font-bold"
          style={{
            textShadow: '0 3px 15px rgba(0,0,0,0.5)',
            letterSpacing: '0.02em',
            fontFamily: 'var(--font-noto-sans-thai), sans-serif',
          }}
        >
          ไม่ต้องใช้หลายโปรแกรมอีกต่อไป บริหารยอดขาย
        </p>

        <p
          className="text-xl md:text-3xl text-white/95 mb-16 font-bold"
          style={{
            textShadow: '0 3px 15px rgba(0,0,0,0.5)',
            letterSpacing: '0.02em',
            fontFamily: 'var(--font-noto-sans-thai), sans-serif',
          }}
        >
          บัญชี สต็อก และทีมงานครบ จบในที่เดียว
        </p>

        <button
          className="px-14 py-5 bg-white/30 backdrop-blur-lg border-2 border-white text-white rounded-full font-bold text-xl hover:bg-white/40 transition-all duration-300 transform hover:scale-110 shadow-2xl"
          style={{
            textShadow: '0 2px 8px rgba(0,0,0,0.3)',
            letterSpacing: '0.05em',
            fontFamily: 'var(--font-noto-sans-thai), sans-serif',
          }}
        >
          ทดลองใช้งานฟรี
        </button>
      </div>
    </section>
  );
}