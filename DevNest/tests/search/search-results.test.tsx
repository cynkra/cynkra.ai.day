// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/follow/actions", () => ({
  followUser: vi.fn(async () => ({ ok: true })),
  unfollowUser: vi.fn(async () => ({ ok: true })),
  followTag: vi.fn(async () => ({ ok: true })),
  unfollowTag: vi.fn(async () => ({ ok: true })),
}));

import { SearchResultsView } from "@/components/search/search-results";

const emptyViewer = {
  id: null,
  followingUserIds: new Set<string>(),
  followingTagIds: new Set<string>(),
};

describe("<SearchResultsView />", () => {
  it("prompts to start searching when no query", () => {
    render(
      <SearchResultsView
        query=""
        results={{ users: [], tags: [] }}
        viewer={emptyViewer}
      />,
    );
    expect(screen.getByText(/search for developers and tags/i)).toBeInTheDocument();
  });

  it("shows two empty-state messages when nothing matches", () => {
    render(
      <SearchResultsView
        query="zilch"
        results={{ users: [], tags: [] }}
        viewer={emptyViewer}
      />,
    );
    const empties = screen.getAllByText(/no matches for/i);
    expect(empties).toHaveLength(2); // one per section
  });

  it("renders matching users and tags with follow controls", () => {
    render(
      <SearchResultsView
        query="react"
        results={{
          users: [
            {
              id: "u1",
              handle: "alice",
              name: "Alice React",
              image: null,
              headline: "frontend dev",
            },
          ],
          tags: [
            { id: "t1", slug: "react", displayName: "react" },
            { id: "t2", slug: "react-hooks", displayName: "react-hooks" },
          ],
        }}
        viewer={{
          id: "viewer",
          followingUserIds: new Set(["u1"]),
          followingTagIds: new Set(),
        }}
      />,
    );

    expect(screen.getByText("Alice React")).toBeInTheDocument();
    expect(screen.getByText("@alice · frontend dev")).toBeInTheDocument();
    expect(screen.getByText("#react")).toBeInTheDocument();
    expect(screen.getByText("#react-hooks")).toBeInTheDocument();

    // Three follow buttons (1 user + 2 tags). The user one should already
    // say "Following" because the viewer follows u1.
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(3);
    expect(buttons.some((b) => b.textContent === "Following")).toBe(true);
    expect(buttons.filter((b) => b.textContent === "Follow")).toHaveLength(2);
  });

  it("renders sign-in prompts when the viewer is unauthenticated", () => {
    render(
      <SearchResultsView
        query="react"
        results={{
          users: [],
          tags: [{ id: "t1", slug: "react", displayName: "react" }],
        }}
        viewer={emptyViewer}
      />,
    );
    expect(
      screen.getByRole("link", { name: /sign in to follow/i }),
    ).toBeInTheDocument();
  });
});
