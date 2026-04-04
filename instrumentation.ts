/**
 * Next.js Instrumentation Hook
 * Runs once at server startup (before any request is handled)
 * Ensures logger initializes early so console is intercepted globally
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/logger");
  }
}
