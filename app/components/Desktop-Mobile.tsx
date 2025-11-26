"use client";

import Image from 'next/image';
import { useEffect, useState } from 'react';

export default function HeroSection() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Trigger animation on mount
        setIsVisible(true);
    }, []);

    return (
        <section className="relative min-h-screen flex items-center justify-center px-6 py-5 overflow-hidden pt-5">
            {/* Background */}
            <Image
                src="/bg5.jpg"
                alt="Hero background"
                fill
                priority
                quality={100}
                className="object-cover object-center"
                style={{ transform: "translateZ(0)" }}
            />
            <div className="max-w-7xl mx-auto relative z-10 w-full">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                    {/* Left Content */}
                    <div className="space-y-8">
                        {/* Heading Animation */}
                        <h1 
                            className={`text-5xl lg:text-4xl font-semibold text-gray-900 leading-tight font-noto transition-all duration-1000 ${
                                isVisible 
                                    ? 'opacity-100 translate-y-0' 
                                    : 'opacity-0 translate-y-10'
                            }`}
                        >
                            จัดการธุรกิจทั้งหมดในคลิกเดียว
                            <br />
                            ด้วย
                            <span className="text-[#0a4b97]"> FAZZ</span>
                            <span className="text-[#0791ed]">FLY</span>
                        </h1>

                        {/* Description Animation */}
                        <p 
                            className={`text-lg lg:text-xl text-gray-700 leading-relaxed max-w-xl font-noto transition-all duration-1000 ${
                                isVisible 
                                    ? 'opacity-100 translate-y-0' 
                                    : 'opacity-0 translate-y-10'
                            }`}
                            style={{ transitionDelay: '200ms' }}
                        >
                            DASHBOARD เชื่อมต่อระบบทุกการเคลื่อนไหวของธุรกิจ จ่ายง่าย สต๊อก บัญชี
                            ใบรับเงินการเงินดราฟต์สรุปแบบเรียลไทม์ ใช้งานง่าย เหมือนมีผู้ช่วยอัจฉริยะคอย
                            ทำงานแทน
                        </p>

                        {/* CTA Buttons with Staggered Animation */}
                        <div className="flex flex-wrap gap-4">
                            <button 
                                className={`px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white font-bold text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-700 hover:scale-105 font-noto ${
                                    isVisible 
                                        ? 'opacity-100 translate-y-0' 
                                        : 'opacity-0 translate-y-10'
                                }`}
                                style={{ transitionDelay: '400ms' }}
                            >
                                Request Demo
                            </button>
                            <button 
                                className={`px-8 py-4 bg-white hover:bg-gray-50 text-blue-600 font-bold text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-700 hover:scale-105 border-2 border-blue-600 font-noto ${
                                    isVisible 
                                        ? 'opacity-100 translate-y-0' 
                                        : 'opacity-0 translate-y-10'
                                }`}
                                style={{ transitionDelay: '550ms' }}
                            >
                                Free Plan
                            </button>
                        </div>
                    </div>

                    {/* Right Side - Device Mockups with Animation */}
                    <div className="relative flex items-center justify-center lg:justify-end w-full">
                        <div 
                            className={`relative w-full transition-all duration-1200 ${
                                isVisible 
                                    ? 'opacity-100 scale-100 translate-x-0' 
                                    : 'opacity-0 scale-90 translate-x-20'
                            }`}
                            style={{ transitionDelay: '600ms' }}
                        >
                            {/* Glow Effect */}
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-cyan-400/20 rounded-3xl blur-3xl"></div>

                            <Image
                                src="/pc-assets.png"
                                alt="Desktop and Mobile Dashboard"
                                width={1400}
                                height={1000}
                                quality={100}
                                className="object-contain drop-shadow-2xl w-full h-auto relative z-10"
                                priority
                            />

                            {/* Floating Decorative Elements */}
                            <div 
                                className={`absolute top-10 -right-6 w-16 h-16 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-2xl opacity-60 blur-sm transition-all duration-1000 ${
                                    isVisible 
                                        ? 'animate-pulse translate-x-0 translate-y-0 opacity-60' 
                                        : 'translate-x-10 -translate-y-10 opacity-0'
                                }`}
                                style={{ transitionDelay: '900ms' }}
                            ></div>

                            <div 
                                className={`absolute bottom-20 -left-8 w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl opacity-50 blur-sm transition-all duration-1000 ${
                                    isVisible 
                                        ? 'animate-pulse translate-x-0 translate-y-0 opacity-50' 
                                        : '-translate-x-10 translate-y-10 opacity-0'
                                }`}
                                style={{ 
                                    animationDelay: '0.5s',
                                    transitionDelay: '1000ms'
                                }}
                            ></div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}