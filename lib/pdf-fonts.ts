/**
 * lib/pdf-fonts.ts
 * Fetch Thai fonts from Google Fonts server-side and embed as base64.
 *
 * WHY: On Vercel/serverless, Puppeteer's Chromium runs in a sandbox that
 * cannot reach Google Fonts CDN. Fetching here (Node.js) bypasses the
 * sandbox, and we inline the font so Chromium needs zero network requests.
 */

interface CacheEntry {
  css: string;
  ts: number;
}

const _cache: Record<string, CacheEntry> = {};
const TTL = 24 * 60 * 60 * 1000; // reuse for 24 h per cold-start instance

async function fetchBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`font fetch failed: ${res.status} ${url}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf).toString("base64");
}

/**
 * Returns a <style> block with @font-face rules that embed the font as
 * base64 data URIs — safe to paste directly into HTML sent to Puppeteer.
 *
 * @param family  Google Fonts family name, e.g. "Sarabun" or "Noto+Sans+Thai"
 * @param weights Array of weights to include, e.g. ["400","600","700"]
 */
export async function getEmbeddedFontStyle(
  family: string,
  weights: string[] = ["400", "700"]
): Promise<string> {
  const key = `${family}-${weights.join(",")}`;
  const now = Date.now();

  if (_cache[key] && now - _cache[key].ts < TTL) {
    return _cache[key].css;
  }

  try {
    const weightParam = weights.join(";");
    const cssUrl = `https://fonts.googleapis.com/css2?family=${family}:wght@${weightParam}&display=swap`;

    // Use a desktop UA so Google returns WOFF2 (smaller than TTF)
    const cssRes = await fetch(cssUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      },
    });
    if (!cssRes.ok) throw new Error(`css fetch failed: ${cssRes.status}`);

    const cssText = await cssRes.text();

    // Replace every url(...) with a base64 data URI
    const urlPattern = /url\((https?:\/\/[^)]+)\)/g;
    const matches = [...cssText.matchAll(urlPattern)];

    let embedded = cssText;
    await Promise.all(
      matches.map(async ([full, url]) => {
        try {
          const b64 = await fetchBase64(url);
          const mime = url.includes(".woff2") ? "font/woff2" : "font/truetype";
          embedded = embedded.replace(full, `url(data:${mime};base64,${b64})`);
        } catch {
          // leave the original URL if one weight fails — better than crashing
        }
      })
    );

    _cache[key] = { css: embedded, ts: now };
    return embedded;
  } catch (err) {
    console.error(`[pdf-fonts] Failed to embed font "${family}":`, err);
    return ""; // caller falls back to system fonts
  }
}
