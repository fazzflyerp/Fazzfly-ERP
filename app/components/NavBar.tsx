"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`absolute top-0 left-0 right-0 z-50 transition-all duration-300`}>
      {/* Content */}
      <div className="px-6 md:px-12 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="FAZZELY"
              width={100}
              height={100}
              className="w-auto h-35"
            />
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-12">
            <Link href="/" className="text-white font-semibold text-lg hover:text-blue-200 transition-colors">
              HOME
            </Link>

            <Link href="/solution" className="text-white font-semibold text-lg hover:text-blue-200 transition-colors">
              SOLUTION
            </Link>

            <Link href="#" className="text-white font-semibold text-lg hover:text-blue-200 transition-colors">
              LEARN
            </Link>

            <Link href="/pricing" className="text-white font-semibold text-lg hover:text-blue-200 transition-colors">
              PRICING
            </Link>

            <Link href="/contact" className="text-white font-semibold text-lg hover:text-blue-200 transition-colors">
              CONTACT
            </Link>
          </div>

          {/* Right side - Launch App Button */}
          <div className="flex items-center gap-4">
            <Link href="/home" className="hidden md:block px-8 py-3 border-2 border-white text-white rounded-full font-bold hover:bg-white/20 transition-all duration-300 hover:scale-105">
              Launch App
            </Link>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden text-white p-2"
            >
              {isOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden mt-4 pb-4 space-y-4 bg-white/10 backdrop-blur-md rounded-lg p-4">
            <Link href="/solution" className="block text-white font-semibold py-2 hover:text-blue-200 transition-colors">
              SOLUTION
            </Link>
            <Link href="#" className="block text-white font-semibold py-2 hover:text-blue-200 transition-colors">
              LEARN
            </Link>
            <Link href="/pricing" className="block text-white font-semibold py-2 hover:text-blue-200 transition-colors">
              PRICING
            </Link>
            <Link href="/contact" className="block text-white font-semibold py-2 hover:text-blue-200 transition-colors">
              CONTACT
            </Link>
            <Link href="/home" className="w-full px-6 py-3 border-2 border-white text-white rounded-full font-bold hover:bg-white/20 transition-all mt-4 block text-center">
              Launch App
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}