import React from 'react';
import Navbar from '@/app/components/NavBar';
import { Mail, Phone, Facebook, Instagram } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
      <Navbar />
      
      {/* Hero Section */}
      <div className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-4">
            ติดต่อเรา
          </h1>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto">
            เรายินดีให้บริการและตอบคำถามทุกข้อสงสัย
          </p>
        </div>
      </div>

      {/* Contact Section */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          
          {/* Email Card */}
          <div className="group bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg transform group-hover:scale-110 group-hover:rotate-3 transition-all flex-shrink-0">
                <Mail className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">อีเมล</h3>
                <a href="mailto:contact@fazzfly.com" className="text-blue-600 hover:text-blue-700 font-medium text-lg break-all">
                  contact@fazzfly.com
                </a>
                <p className="text-sm text-gray-500 mt-2">ตอบกลับภายใน 24 ชั่วโมง</p>
              </div>
            </div>
          </div>

          {/* Phone Card */}
          <div className="group bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg transform group-hover:scale-110 group-hover:rotate-3 transition-all flex-shrink-0">
                <Phone className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">โทรศัพท์</h3>
                <a href="tel:+6621234567" className="text-blue-600 hover:text-blue-700 font-medium text-xl">
                  02-123-4567
                </a>
                <p className="text-sm text-gray-500 mt-2">จันทร์-ศุกร์ 9:00-18:00 น.</p>
              </div>
            </div>
          </div>

        </div>

        {/* Social Media Section */}
        <div className="bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-600 rounded-2xl p-10 shadow-xl text-white text-center">
          <h2 className="text-3xl font-bold mb-3">ติดตามเรา</h2>
          <p className="text-purple-100 mb-8 text-lg">เชื่อมต่อกับเราผ่านโซเชียลมีเดีย</p>
          
          <div className="flex justify-center gap-4 flex-wrap">
            <a 
              href="https://facebook.com" 
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-xl p-5 flex items-center gap-3 transition-all hover:scale-105"
            >
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                <Facebook className="w-6 h-6 text-white" />
              </div>
              <span className="font-semibold text-lg">Facebook</span>
            </a>
            
            <a 
              href="https://instagram.com" 
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-xl p-5 flex items-center gap-3 transition-all hover:scale-105"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                <Instagram className="w-6 h-6 text-white" />
              </div>
              <span className="font-semibold text-lg">Instagram</span>
            </a>
            
            <a 
              href="https://line.me" 
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-xl p-5 flex items-center gap-3 transition-all hover:scale-105"
            >
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                </svg>
              </div>
              <span className="font-semibold text-lg">Line</span>
            </a>
            
            <a 
              href="https://tiktok.com" 
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-xl p-5 flex items-center gap-3 transition-all hover:scale-105"
            >
              <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                </svg>
              </div>
              <span className="font-semibold text-lg">TikTok</span>
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}