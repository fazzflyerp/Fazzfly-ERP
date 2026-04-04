/**
 * withLogger - HOC สำหรับ wrap Next.js API Route Handler
 * ใช้ logger โดยตรง ทำให้ทุก request ขึ้น Debug Dashboard
 *
 * Usage:
 *   export const GET = withLogger("/api/module/data", async (request) => { ... });
 */

import { logger } from "./logger";
import { NextRequest, NextResponse } from "next/server";

type RouteHandler = (req: NextRequest, ctx?: any) => Promise<NextResponse | Response>;

export function withLogger(apiPath: string, handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, ctx?: any) => {
    const log = logger.createContext(apiPath);
    const method = req.method;
    const url = new URL(req.url);
    const query = url.searchParams.toString();

    log.info(`→ ${method}${query ? `?${query}` : ""}`);
    const start = Date.now();

    try {
      const res = await handler(req, ctx);
      const status = (res as any).status ?? 200;
      const duration = Date.now() - start;

      if (status >= 400) {
        log.warn(`← ${status} (${duration}ms)`);
      } else {
        log.info(`← ${status} (${duration}ms)`);
      }

      return res;
    } catch (err: any) {
      log.error(`✗ ${method} failed`, err);
      throw err;
    }
  };
}
