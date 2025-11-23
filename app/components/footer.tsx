import React from 'react';
import Link from 'next/link';
import { Facebook, Instagram, Mail, Phone } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50" style={{ fontFamily: 'var(--font-noto-sans-thai), sans-serif' }}>
      <div className="max-w-7xl mx-auto px-6 py-12">
        
        {/* Main Footer Content */}
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          
          {/* Brand Section */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="font-bold text-xl text-slate-900">FAZZFLY</span>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              ระบบ Mini ERP ที่ครบวงจรสำหรับธุรกิจยุคใหม่
            </p>
            {/* Social Media */}
            <div className="flex gap-3">
              <a 
                href="https://facebook.com" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center justify-center transition-colors"
              >
                <Facebook className="w-5 h-5 text-white" />
              </a>
              <a 
                href="https://instagram.com" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg flex items-center justify-center transition-colors"
              >
                <Instagram className="w-5 h-5 text-white" />
              </a>
              <a 
                href="https://line.me" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 bg-green-500 hover:bg-green-600 rounded-lg flex items-center justify-center transition-colors"
              >
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                </svg>
              </a>
              <a 
                href="https://tiktok.com" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 bg-black hover:bg-gray-800 rounded-lg flex items-center justify-center transition-colors"
              >
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Solutions */}
          <div>
            <h3 className="font-bold text-slate-900 mb-4">โซลูชัน</h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>
                <Link href="/solution" className="hover:text-blue-600 transition">
                  ภาพรวมระบบ
                </Link>
              </li>
              <li>
                <Link href="/solution" className="hover:text-blue-600 transition">
                  ระบบขาย
                </Link>
              </li>
              <li>
                <Link href="/solution" className="hover:text-blue-600 transition">
                  ระบบบัญชี
                </Link>
              </li>
              <li>
                <Link href="/solution" className="hover:text-blue-600 transition">
                  ระบบเงินเดือน
                </Link>
              </li>
              <li>
                <Link href="/solution" className="hover:text-blue-600 transition">
                  ระบบจัดการสินค้า
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-bold text-slate-900 mb-4">บริษัท</h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>
                <Link href="/pricing" className="hover:text-blue-600 transition">
                  แผนราคา
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-blue-600 transition">
                  ติดต่อเรา
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-bold text-slate-900 mb-4">ติดต่อเรา</h3>
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600" />
                <a href="mailto:contact@fazzfly.com" className="hover:text-blue-600 transition">
                  contact@fazzfly.com
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-600" />
                <a href="tel:+6621234567" className="hover:text-blue-600 transition">
                  02-123-4567
                </a>
              </li>
              <li className="text-slate-500 text-xs">
                จันทร์-ศุกร์ 9:00-18:00 น.
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="border-t border-slate-200 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm text-slate-500">
            © 2025 Fazzfly ERP. All rights reserved.
          </div>
          <div className="flex gap-6 text-sm text-slate-600">
            <Link href="/privacy" className="hover:text-blue-600 transition">
              นโยบายความเป็นส่วนตัว
            </Link>
            <Link href="/terms" className="hover:text-blue-600 transition">
              ข้อกำหนดการใช้งาน
            </Link>
          </div>
        </div>

      </div>
    </footer>
  );
}