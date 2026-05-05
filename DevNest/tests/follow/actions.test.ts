import { afterEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => mockSelect(),
    insert: () => mockInsert(),
    delete: () => mockDelete(),
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { followUser } from "@/lib/follow/actions";

afterEach(() => {
  vi.clearAllMocks();
});

describe("followUser", () => {
  it("rejects self-follow", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user-1" } });
    const result = await followUser("user-1");
    expect(result).toEqual({ ok: false, error: "self" });
  });

  it("rejects when target user does not exist", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user-1" } });
    mockSelect.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    });
    const result = await followUser("ghost");
    expect(result).toEqual({ ok: false, error: "not_found" });
  });

  it("rejects when target user is soft-deleted", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user-1" } });
    mockSelect.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve([
              {
                id: "user-2",
                handle: "deleted",
                deletedAt: new Date("2026-01-01"),
              },
            ]),
        }),
      }),
    });
    const result = await followUser("user-2");
    expect(result).toEqual({ ok: false, error: "not_found" });
  });

  it("inserts and is idempotent (onConflictDoNothing)", async () => {
    const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
    const insertChain = {
      values: () => ({ onConflictDoNothing }),
    };
    mockAuth.mockResolvedValueOnce({ user: { id: "user-1" } });
    mockSelect.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve([
              { id: "user-2", handle: "alice", deletedAt: null },
            ]),
        }),
      }),
    });
    mockInsert.mockReturnValueOnce(insertChain);

    const result = await followUser("user-2");
    expect(result).toEqual({ ok: true });
    expect(onConflictDoNothing).toHaveBeenCalledOnce();
  });
});
