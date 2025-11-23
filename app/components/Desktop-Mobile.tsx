import Image from 'next/image';

export default function HeroSection() {
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
                        <h1 className="text-5xl lg:text-4xl font-semibold text-gray-900 leading-tight font-noto">
                            จัดการธุรกิจทั้งหมดในคลิกเดียว
                            <br />
                            ด้วย
                            <span className="text-[#0a4b97] border-"> FAZZ</span>
                            <span className="text-[#0791ed] border-">FLY</span>
                        </h1>

                        <p className="text-lg lg:text-xl text-gray-700 leading-relaxed max-w-xl font-noto">
                            DASHBOARD เชื่อมต่อระบบทุกการเคลื่อนไหวของธุรกิจ จ่ายง่าย สต๊อก บิญชี
                            ใบรับเงินการเงินดราฟต์สสล้บแบบเรียลไทม์ ใช้งานง่าย เหมือนมีผู้ช่วยอัจฉริยะคอย
                            ทำงานแทน
                        </p>

                        {/* CTA Buttons */}
                        <div className="flex flex-wrap gap-4">
                            <button className="px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white font-bold text-lg rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 font-noto">
                                Request Demo
                            </button>
                            <button className="px-8 py-4 bg-white hover:bg-gray-50 text-blue-600 font-bold text-lg rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 border-2 border-blue-600 font-noto">
                                Free Plan
                            </button>
                        </div>
                    </div>
                    {/* Right Side - Device Mockups */}
                    <div className="relative flex items-center justify-center lg:justify-end w-full">
                        <div className="relative w-full">
                            <Image
                                src="/pc assets.png"
                                alt="Desktop and Mobile Dashboard"
                                width={1400}
                                height={1000}
                                quality={100}
                                className="object-contain drop-shadow-2xl w-full h-auto"
                                priority
                            />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}