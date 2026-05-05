import "server-only";

import { headers } from "next/headers";
import pino, { type Logger } from "pino";

import { REQUEST_ID_HEADER } from "@/lib/request-id";

const isProduction = process.env.NODE_ENV === "production";

// Single base logger reused across the request lifecycle. Children inherit
// transport but get their own bindings (e.g. requestId) at no extra cost.
const baseLogger: Logger = pino({
  level: isProduction ? "info" : "debug",
  base: null, // omit pid/hostname; the platform adds those in prod
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            singleLine: true,
            translateTime: "HH:MM:ss.l",
            ignore: "pid,hostname",
          },
        },
      }),
});

/**
 * Returns a request-scoped logger with `requestId` bound. Falls back to the
 * base logger (with `requestId: "no-context"`) when called outside an
 * inbound-request scope (e.g. background workers, Drizzle migration scripts).
 *
 * Usage in route handlers, server actions, and RSC:
 *   const log = await getLogger();
 *   log.info({ userId }, "did the thing");
 */
export async function getLogger(): Promise<Logger> {
  let requestId: string | undefined;
  try {
    const h = await headers();
    requestId = h.get(REQUEST_ID_HEADER) ?? undefined;
  } catch {
    // headers() throws when called outside a request scope. Fine.
  }
  return baseLogger.child({ requestId: requestId ?? "no-context" });
}

export { baseLogger as logger };
