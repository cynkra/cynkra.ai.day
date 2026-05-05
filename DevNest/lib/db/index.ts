import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";

import * as schema from "./schema";

// Single shared client across the Next.js dev server's module HMR.
declare global {
  var __devnest_pg__: ReturnType<typeof postgres> | undefined;
}

const queryClient =
  globalThis.__devnest_pg__ ??
  postgres(env.DATABASE_URL, {
    max: env.NODE_ENV === "production" ? 10 : 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (env.NODE_ENV !== "production") {
  globalThis.__devnest_pg__ = queryClient;
}

export const db = drizzle(queryClient, { schema, casing: "snake_case" });

export type DB = typeof db;
export { schema };
