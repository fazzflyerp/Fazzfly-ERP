/**
 * lib/pdf-browser.ts
 * Shared Puppeteer launcher — ทำงานได้ทั้ง local dev และ Vercel/serverless
 */

import type { Browser } from "puppeteer-core";

let _browser: Browser | null = null;

export async function getPdfBrowser(): Promise<Browser> {
  const isServerless = !!(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NETLIFY
  );

  if (isServerless) {
    // ── Production / Serverless ──────────────────────────────────────
    const chromium = await import("@sparticuz/chromium");
    const puppeteer = await import("puppeteer-core");

    return puppeteer.default.launch({
      args: chromium.default.args,
      executablePath: await chromium.default.executablePath(),
      headless: true,
    });
  } else {
    // ── Local Dev ────────────────────────────────────────────────────
    // reuse browser instance เพื่อลดเวลา cold start
    if (_browser && _browser.connected) {
      return _browser;
    }

    const puppeteer = await import("puppeteer");
    _browser = (await puppeteer.default.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    })) as unknown as Browser;

    return _browser;
  }
}

export async function generatePdf(html: string): Promise<Buffer> {
  const browser = await getPdfBrowser();
  const isServerless = !!(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NETLIFY
  );

  try {
    const page = await browser.newPage();

    // ใช้ networkidle0 บน dev (รอ Google Fonts), timeout ปกติบน serverless
    await page.setContent(html, {
      waitUntil: isServerless ? "domcontentloaded" : "networkidle0",
      timeout: 30000,
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: true,
    });

    await page.close();
    return Buffer.from(pdfBuffer);
  } finally {
    // Serverless: close browser หลังทุก request (ไม่มี reuse)
    if (isServerless) {
      await browser.close().catch(() => {});
    }
  }
}
