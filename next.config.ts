/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
    serverComponentsExternalPackages: ["next-auth", "@sparticuz/chromium", "puppeteer-core"],
    instrumentationHook: true,
  },
};

export default nextConfig;
