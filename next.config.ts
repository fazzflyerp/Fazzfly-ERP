/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    "next-auth",
    "@sparticuz/chromium",
    "@sparticuz/chromium-min",
    "puppeteer",
    "puppeteer-core",
    "googleapis",
    "heic-convert",
    "pdf-lib",
    "pdfkit",
    "@pdf-lib/fontkit",
    "plotly.js",
    "@react-pdf/renderer",
  ],
};

export default nextConfig;
