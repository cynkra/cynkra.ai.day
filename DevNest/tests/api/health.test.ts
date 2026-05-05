import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    execute: vi.fn(),
  },
}));

vi.mock("@/lib/logger", () => ({
  getLogger: vi.fn(async () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

import { GET } from "@/app/api/health/route";
import { db } from "@/lib/db";

const mockedExecute = vi.mocked(db.execute);

afterEach(() => {
  mockedExecute.mockReset();
});

describe("GET /api/health", () => {
  it("returns 200 ok when the database responds", async () => {
    mockedExecute.mockResolvedValueOnce({ rows: [] } as never);

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({ status: "ok", db: "ok" });
    expect(typeof body.version).toBe("string");
  });

  it("returns 503 degraded when the database rejects", async () => {
    mockedExecute.mockRejectedValueOnce(new Error("connection refused"));

    const response = await GET();
    expect(response.status).toBe(503);

    const body = await response.json();
    expect(body).toMatchObject({ status: "degraded", db: "down" });
  });

  it("returns 503 degraded when the database hangs past the timeout", async () => {
    mockedExecute.mockImplementationOnce(
      () => new Promise(() => {}) as never, // never settles
    );

    const response = await GET();
    expect(response.status).toBe(503);

    const body = await response.json();
    expect(body).toMatchObject({ status: "degraded", db: "down" });
  }, 5000);
});
