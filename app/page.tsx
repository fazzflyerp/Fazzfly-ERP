"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import HeroSection from "@/app/components/HeroSection";
import NavBar from "@/app/components/NavBar";
import ProblemSection from "@/app/components/ProblenSection";

export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
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

      {/* Dashboard Preview Section */}
      <ProblemSection />
      {/* Stats Section */}
      <section className="relative py-32 px-6 bg-gradient-to-r from-blue-500 to-cyan-300">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
<div>
              <h2 
                className="text-5xl font-bold text-slate-900 mb-6"
                style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
              >
                Trusted by Businesses Worldwide
              </h2>
              <p 
                className="text-xl text-white text-slate-600 mb-8 leading-relaxed"
                style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
              >
                ระบบของเรา ใช้งานโดยบริษัทชั้นนำ และธุรกิจขนาดกลางทั่วโลก
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-white">
                  <svg className="w-6 h-6 text-blue-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span 
                    className="font-medium text-white"
                    style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
                  >
                    อัพเดทข้อมูลแบบ Real-time
                  </span>
                </div>
                <div className="flex items-center gap-3 text-white">
                  <svg className="w-6 h-6 text-blue-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span 
                    className="font-medium text-white"
                    style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
                  >
                    ปลอดภัยระดับ Enterprise
                  </span>
                </div>
                <div className="flex items-center gap-3 text-white">
                  <svg className="w-6 h-6 text-blue-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span 
                    className="font-medium text-white"
                    style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}
                  >
                    รองรับ Google Sheets โดยตรง
                  </span>
                </div>
              </div>
            </div>

<div className="space-y-4">
              <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-l-4 border-blue-600 rounded-xl shadow-md hover:shadow-lg transition-shadow">
                <div className="text-4xl font-black text-blue-600 mb-1" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>ปรึกษาฟรี</div>
                <div className="text-slate-700 font-semibold text-sm" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>เริ่มต้นกับทีมของเรา</div>
              </div>
              <div className="p-6 bg-gradient-to-br from-sky-50 to-sky-100 border-l-4 border-sky-600 rounded-xl shadow-md hover:shadow-lg transition-shadow">
                <div className="text-4xl font-black text-sky-600 mb-1" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>2-3 วัน</div>
                <div className="text-slate-700 font-semibold text-sm" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>ติดตั้งแล้วใช้งานได้</div>
              </div>
              <div className="p-6 bg-gradient-to-br from-cyan-50 to-cyan-100 border-l-4 border-cyan-600 rounded-xl shadow-md hover:shadow-lg transition-shadow">
                <div className="text-4xl font-black text-cyan-600 mb-1" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>100%</div>
                <div className="text-slate-700 font-semibold text-sm" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>ข้อมูลของคุณเท่านั้น</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-32 px-6 bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl font-bold text-white mb-6">
            Ready to Transform Your Business?
          </h2>
          <p className="text-xl text-blue-50 mb-12">
            เริ่มต้นฟรี ไม่ต้องใช้บัตรเครดิต ยกเลิกได้ทุกเมื่อ
          </p>
          <Link href="/login">
            <button className="px-12 py-5 bg-white text-blue-600 rounded-xl font-bold text-lg hover:shadow-2xl hover:shadow-blue-500/30 transition-all">
              Start Your Journey Now
            </button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-12 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg"></div>
              <span className="font-bold text-slate-900">Fazzfly ERP</span>
            </div>
            <div className="flex gap-8 text-sm text-slate-600">
              <a href="#" className="hover:text-blue-600 transition">About</a>
              <a href="#" className="hover:text-blue-600 transition">Contact</a>
              <a href="#" className="hover:text-blue-600 transition">Privacy</a>
              <a href="#" className="hover:text-blue-600 transition">Terms</a>
            </div>
          </div>
          <div className="text-center text-sm text-slate-500 border-t border-slate-200 pt-8">
            © 2025 Fazzfly ERP. All rights reserved.
          </div>
        </div>
      </footer>

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