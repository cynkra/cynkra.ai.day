import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import packageJson from "@/package.json";
import { db } from "@/lib/db";
import { getLogger } from "@/lib/logger";

const DB_PING_TIMEOUT_MS = 1000;

type HealthBody = {
  status: "ok" | "degraded";
  db: "ok" | "down";
  version: string;
};

async function pingDb(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("db ping timeout")),
          DB_PING_TIMEOUT_MS,
        );
      }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function GET(): Promise<NextResponse<HealthBody>> {
  const log = await getLogger();
  const dbOk = await pingDb();

  if (!dbOk) {
    log.warn("health check: db unreachable");
    return NextResponse.json<HealthBody>(
      { status: "degraded", db: "down", version: packageJson.version },
      { status: 503 },
    );
  }

  return NextResponse.json<HealthBody>(
    { status: "ok", db: "ok", version: packageJson.version },
    { status: 200 },
  );
}
