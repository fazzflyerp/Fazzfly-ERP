"use client";

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import HeroSection from "@/app/components/HeroSection";
import NavBar from "@/app/components/NavBar";
import ProblemSection from "@/app/components/ProblenSection";
import DesktopMobile from "@/app/components/Desktop-Mobile";
import Footer from "@/app/components/footer";


export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0);
  const [isStatsVisible, setIsStatsVisible] = useState(false);
  const [isCtaVisible, setIsCtaVisible] = useState(false);
  
  const statsRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const statsObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsStatsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    const ctaObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsCtaVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    if (statsRef.current) {
      statsObserver.observe(statsRef.current);
    }

    if (ctaRef.current) {
      ctaObserver.observe(ctaRef.current);
    }

    return () => {
      if (statsRef.current) {
        statsObserver.unobserve(statsRef.current);
      }
      if (ctaRef.current) {
        ctaObserver.unobserve(ctaRef.current);
      }
    };
  }, []);

  const features = [
    {
      icon: (
        <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      title: "Real-time Analytics",
      description: "ติดตามข้อมูลแบบเรียลไทม์ ตัดสินใจได้ทันที"
    },
    {
      icon: (
        <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
      title: "Enterprise Security",
      description: "ความปลอดภัยระดับธนาคาร เข้ารหัส End-to-End"
    },
    {
      icon: (
        <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
      ),
      title: "Cloud Native",
      description: "เข้าถึงได้ทุกที่ ทุกเวลา ผ่านอุปกรณ์ใดก็ได้"
    },
    {
      icon: (
        <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      title: "Google Sheets Integration",
      description: "เชื่อมต่อโดยตรงกับ Google Sheets ไม่ต้อง sync"
    }
  ];

  const stats = [
    { value: "10K+", label: "Active" },
    { value: "99.9%", label: "Uptime" },
    { value: "50M+", label: "Transactions" },
    { value: "24/7", label: "Support" }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <NavBar />

      {/* Hero Section - ใช้ Component */}
      <HeroSection />

      {/* Problems Section */}
      <ProblemSection />

      {/* Stats Section */}
      <section 
        ref={statsRef}
        className="relative min-h-screen flex items-center justify-center px-6 py-20 overflow-hidden"
      >
        {/* Background - Pure Image Only */}
        <Image
          src="/bg3.jpg"
          alt="Hero background"
          fill
          priority
          quality={100}
          className="object-cover object-center"
          style={{ transform: "translateZ(0)" }}
        />

        {/* Subtle Decorative Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-400/10 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-7xl mx-auto relative z-10 w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Left Content */}
            <div className="space-y-10">
              <div className="space-y-6">
                <h1 
                  className={`text-5xl lg:text-7xl font-semibold text-white leading-tight font-noto transition-all duration-1000 ${
                    isStatsVisible 
                      ? 'opacity-100 translate-y-0' 
                      : 'opacity-0 translate-y-10'
                  }`}
                >
                  ไฟล์ข้อมูลยุ่งเหยิง?
                  <br />
                  <span className="text-6xl lg:text-5xl">ย้ายค้ายมา</span>

                  {/* FAZ */}
                  <span className="text-[#0a4b97] drop-shadow-[0_0_30px_rgba(255,255,255,0.9)]">
                    {" "}FAZ
                  </span>

                  {/* ZF */}
                  <span className="text-blue-600 drop-shadow-[0_0_30px_rgba(255,255,255,0.9)]">
                    ZF
                  </span>

                  {/* LY */}
                  <span className="text-cyan-300 drop-shadow-[0_0_30px_rgba(255,255,255,0.9)]">
                    LY
                  </span>
                </h1>
              </div>

              {/* Feature Buttons with Staggered Animation */}
              <div className="flex flex-col gap-4 max-w-md">
                {[
                  "ไม่ต้องปวดหัวกับ Excel",
                  "ปรึกษาฟรี!",
                  "บริการดูแล 24 ชั่วโมง"
                ].map((text, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-4 px-6 py-4 bg-blue-600 hover:bg-cyan-500 rounded-full shadow-xl hover:shadow-2xl transition-all duration-700 hover:scale-105 ${
                      isStatsVisible 
                        ? 'opacity-100 translate-x-0' 
                        : 'opacity-0 -translate-x-10'
                    }`}
                    style={{ transitionDelay: `${200 + index * 150}ms` }}
                  >
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-7 h-7 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-xl font-bold text-white font-noto">
                      {text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Side - Device Mockup with Animation */}
            <div className="relative flex items-center justify-center lg:justify-end w-full">
              <div 
                className={`relative w-full max-w-2xl transition-all duration-1200 ${
                  isStatsVisible 
                    ? 'opacity-100 scale-100 translate-x-0' 
                    : 'opacity-0 scale-90 translate-x-20'
                }`}
                style={{ transitionDelay: '600ms' }}
              >
                {/* Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-400/30 to-purple-400/30 rounded-[3rem] blur-3xl"></div>

                {/* Tablet Mockup */}
                <div className="relative">
                  <Image
                    src="/Fix IPAD_Small.png"
                    alt="Fazzfly Dashboard on Tablet"
                    width={1200}
                    height={900}
                    quality={100}
                    className="object-contain drop-shadow-2xl w-full h-auto relative z-10"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Desktop Mobile Section */}
      <DesktopMobile />

      {/* CTA Section */}
      <section 
        ref={ctaRef}
        className="relative min-h-screen flex items-center justify-center px-6 py-20 overflow-hidden"
      >
        {/* Background - Pure Image Only */}
        <Image
          src="/4.jpg"
          alt="Hero background"
          fill
          priority
          quality={100}
          className="object-cover object-center"
          style={{ transform: "translateZ(0)" }}
        />
        
        <div className="max-w-5xl mx-auto text-center relative z-10 px-4">
          {/* Headline with Darker Block Background */}
          <div 
            className={`inline-block mb-8 transition-all duration-1000 ${
              isCtaVisible 
                ? 'opacity-100 scale-100 translate-y-0' 
                : 'opacity-0 scale-95 translate-y-10'
            }`}
          >
            <div className="bg-gradient-to-br from-blue-600/40 via-blue-700/40 to-purple-600/40 backdrop-blur-xl rounded-3xl px-12 py-8 shadow-xl border border-white/30">
              <h2
                className="text-5xl md:text-6xl font-semibold text-white leading-tight drop-shadow-lg"
                style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
              >
                พร้อมเปลี่ยนแปลง
                <br />
                <span className="bg-gradient-to-r from-cyan-200 via-blue-100 to-purple-200 bg-clip-text text-transparent inline-block mt-2">
                  ธุรกิจของคุณแล้วหรือยัง?
                </span>
              </h2>
            </div>
          </div>

          {/* Subheadline */}
          <p
            className={`text-xl md:text-2xl text-white font-light leading-relaxed mb-12 max-w-3xl mx-auto drop-shadow-md transition-all duration-1000 ${
              isCtaVisible 
                ? 'opacity-100 translate-y-0' 
                : 'opacity-0 translate-y-10'
            }`}
            style={{ 
              fontFamily: 'var(--font-noto-sans-thai), sans-serif',
              transitionDelay: '200ms'
            }}
          >
            เริ่มต้นฟรี ไม่ต้องใช้บัตรเครดิต ยกเลิกได้ทุกเมื่อ
          </p>

          {/* CTA Button */}
          <div
            className={`transition-all duration-1000 ${
              isCtaVisible 
                ? 'opacity-100 translate-y-0' 
                : 'opacity-0 translate-y-10'
            }`}
            style={{ transitionDelay: '400ms' }}
          >
            <Link href="/login">
              <button
                className="group relative px-14 py-7 bg-gradient-to-r from-white to-blue-50 text-blue-700 rounded-2xl font-bold text-xl shadow-2xl shadow-blue-900/30 hover:shadow-blue-800/60 transition-all duration-300 hover:scale-105 hover:-translate-y-1 overflow-hidden"
                style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
              >
                {/* Shine effect */}
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></span>

                <span className="relative flex items-center justify-center gap-3">
                  เริ่มต้นใช้งานเลย
                  <svg
                    className="w-6 h-6 group-hover:translate-x-2 transition-transform duration-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </button>
            </Link>
          </div>

          {/* Trust Badges */}
          <div
            className={`mt-10 flex flex-wrap items-center justify-center gap-6 md:gap-8 text-white text-sm md:text-base drop-shadow-md transition-all duration-1000 ${
              isCtaVisible 
                ? 'opacity-100 translate-y-0' 
                : 'opacity-0 translate-y-10'
            }`}
            style={{ 
              fontFamily: 'var(--font-noto-sans-thai), sans-serif',
              transitionDelay: '600ms'
            }}
          >
            {[
              "ไม่มีค่าใช้จ่ายแอบแฝง",
              "ยกเลิกได้ทุกเมื่อ",
              "ปลอดภัย 100%"
            ].map((text, index) => (
              <div 
                key={index}
                className="flex items-center gap-2"
                style={{ 
                  transitionDelay: `${600 + index * 100}ms`,
                  opacity: isCtaVisible ? 1 : 0,
                  transform: isCtaVisible ? 'translateY(0)' : 'translateY(10px)',
                  transition: 'all 1s ease-out'
                }}
              >
                <svg className="w-5 h-5 text-green-300" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />

      <style jsx>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
      `}</style>
    </div>
  );
}