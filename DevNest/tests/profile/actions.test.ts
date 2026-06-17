import { afterEach, describe, expect, it, vi } from "vitest";

// Mocks must be set BEFORE the action module is imported.
const mockAuth = vi.fn();
const mockSelect = vi.fn();
const mockDelete = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => mockSelect(),
    delete: () => mockDelete(),
    update: () => mockUpdate(),
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { disconnectProvider } from "@/lib/profile/actions";

afterEach(() => {
  vi.clearAllMocks();
});

describe("disconnectProvider", () => {
  it("rejects unauthenticated callers", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const result = await disconnectProvider("github");
    expect(result).toEqual({ ok: false, error: "auth" });
  });

  it("rejects when the user has only one linked OAuth account", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user-1" } });
    mockSelect.mockReturnValueOnce({
      from: () => ({
        where: () => Promise.resolve([{ provider: "github" }]),
      }),
    });
    const result = await disconnectProvider("github");
    expect(result).toEqual({ ok: false, error: "last_method" });
  });

  it("rejects when the requested provider is not linked", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user-1" } });
    mockSelect.mockReturnValueOnce({
      from: () => ({
        where: () =>
          Promise.resolve([{ provider: "github" }, { provider: "gitlab" }]),
      }),
    });
    const result = await disconnectProvider("bitbucket");
    expect(result).toEqual({ ok: false, error: "not_linked" });
  });

  it("deletes the row when more than one provider is linked", async () => {
    const deleteWhere = vi.fn().mockResolvedValue(undefined);
    const deleteChain = { where: deleteWhere };

    mockAuth.mockResolvedValueOnce({ user: { id: "user-1" } });
    mockSelect.mockReturnValueOnce({
      from: () => ({
        where: () =>
          Promise.resolve([{ provider: "github" }, { provider: "gitlab" }]),
      }),
    });
    mockDelete.mockReturnValueOnce(deleteChain);

    const result = await disconnectProvider("gitlab");
    expect(result).toEqual({ ok: true });
    expect(deleteWhere).toHaveBeenCalledOnce();
  });
});
