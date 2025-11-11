"use client";

import { useState } from 'react';
import { signIn } from "next-auth/react";
import Link from 'next/link';

export default function LoginPage() {
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    setIsLoading(true);
    await signIn("google", { callbackUrl: "/home" });
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50">
      {/* Animated Background Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/3 w-96 h-96 bg-sky-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      {/* Home Button */}
      <Link href="/">
        <button className="fixed top-6 left-6 z-50 inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-xl border border-blue-100 rounded-xl hover:bg-white hover:shadow-lg transition-all duration-300 text-blue-600 font-medium">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-3m0 0l7-4 7 4M5 7v10a1 1 0 001 1h1m6 0h1a1 1 0 001-1V7M9 9h6m0 0l-1-1m1 1l1-1m-5 5l2 2m2-2l-2-2" />
          </svg>
          กลับหน้าหลัก
        </button>
      </Link>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* Logo Section */}
          <div className="text-center mb-10 animate-slideDown">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-400 rounded-3xl shadow-2xl shadow-blue-500/30 mb-6 transform hover:scale-110 transition-transform duration-300">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 bg-clip-text text-transparent mb-3">
              Fazzfly ERP
            </h1>
            <p className="text-slate-600 font-medium text-lg">Enterprise Resource Planning System</p>
            <p className="text-slate-500 text-sm mt-2">จัดการทรัพยากรองค์กรอย่างมีประสิทธิภาพ</p>
          </div>

          {/* Main Card */}
          <div className="bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-blue-200/50 p-10 border border-blue-100/50 animate-slideDown" style={{ animationDelay: '100ms' }}>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-slate-800 mb-2">ยินดีต้อนรับกลับ</h2>
              <p className="text-slate-600 font-medium">เข้าสู่ระบบเพื่อจัดการธุรกิจของคุณ</p>
            </div>

            {/* Google Sign In Button */}
            <button
              onClick={handleSignIn}
              disabled={isLoading}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              className="w-full relative group"
            >
              <div className={`
                w-full flex items-center justify-center gap-3 
                bg-gradient-to-br from-blue-600 to-cyan-500
                text-white py-4 rounded-2xl
                transition-all duration-300 font-semibold text-lg
                ${isLoading ? 'opacity-75 cursor-not-allowed' : ''}
                ${isHovered ? 'shadow-xl shadow-blue-500/40 -translate-y-1' : 'shadow-lg shadow-blue-500/20'}
              `}>
                {isLoading ? (
                  <>
                    <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    กำลังเข้าสู่ระบบ...
                  </>
                ) : (
                  <>
                    <img
                      src="https://www.svgrepo.com/show/475656/google-color.svg"
                      alt="Google"
                      className="w-6 h-6 bg-white rounded-md p-0.5"
                    />
                    เข้าสู่ระบบด้วย Google
                  </>
                )}
              </div>
              
              <div className={`
                absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500 via-sky-400 to-cyan-400 
                transition-opacity duration-300 -z-10 blur-lg
                ${isHovered ? 'opacity-50' : 'opacity-0'}
              `}></div>
            </button>

            {/* Divider */}
            <div className="relative my-10">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-slate-600 font-semibold">ความปลอดภัยของข้อมูล</span>
              </div>
            </div>

            {/* Security Features */}
            <div className="space-y-3">
              {[
                { 
                  icon: <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>,
                  text: 'เข้ารหัสข้อมูลระดับ Enterprise' 
                },
                { 
                  icon: <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>,
                  text: 'เชื่อมต่อ Google Sheets โดยตรง' 
                },
                { 
                  icon: <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>,
                  text: 'ไม่เก็บข้อมูลบนเซิร์ฟเวอร์ภายนอก' 
                }
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm text-slate-700 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl p-4 border border-blue-100/60 hover:border-blue-200 transition-all duration-300 hover:shadow-md" style={{ animationDelay: `${(idx + 2) * 100}ms` }}>
                  <div className="flex-shrink-0 p-2 bg-white rounded-lg">
                    {item.icon}
                  </div>
                  <span className="font-medium">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-10 animate-slideDown" style={{ animationDelay: '400ms' }}>
            <p className="text-sm text-slate-600 font-medium">
              ระบบจัดการทรัพยากรองค์กร สำหรับธุรกิจยุคใหม่
            </p>
            <p className="text-xs text-slate-500 mt-2">
              © 2025 Fazzfly ERP. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        .animate-slideDown {
          animation: slideDown 0.6s ease-out;
        }
      `}</style>
    </div>
  );
}