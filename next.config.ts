/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["next-auth", "@sparticuz/chromium", "@sparticuz/chromium-min", "puppeteer-core"],
};

export default nextConfig;
