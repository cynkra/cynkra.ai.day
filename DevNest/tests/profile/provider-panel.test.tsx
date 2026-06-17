// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProviderPanel } from "@/components/profile/provider-panel";

describe("<ProviderPanel />", () => {
  it("renders nothing when there are no snapshots", () => {
    const { container } = render(<ProviderPanel snapshots={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a card per provider with the snapshot data", () => {
    render(
      <ProviderPanel
        snapshots={[
          {
            provider: "github",
            avatarUrl: null,
            htmlUrl: "https://github.com/alice",
            publicRepoCount: 12,
            topLanguages: ["TypeScript", "Rust", "Go"],
          },
          {
            provider: "gitlab",
            avatarUrl: null,
            htmlUrl: "https://gitlab.com/alice",
            publicRepoCount: 3,
            topLanguages: ["Python"],
          },
        ]}
      />,
    );

    expect(screen.getByText("From GitHub")).toBeInTheDocument();
    expect(screen.getByText("From GitLab")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("Rust")).toBeInTheDocument();
    expect(screen.getByText("Python")).toBeInTheDocument();
  });

  it("falls back to a 'snapshot pending' message when fields are empty", () => {
    render(
      <ProviderPanel
        snapshots={[
          {
            provider: "github",
            avatarUrl: null,
            htmlUrl: null,
            publicRepoCount: null,
            topLanguages: null,
          },
        ]}
      />,
    );
    expect(screen.getByText(/snapshot pending/i)).toBeInTheDocument();
  });

  it("links to the public profile when htmlUrl is set", () => {
    render(
      <ProviderPanel
        snapshots={[
          {
            provider: "github",
            avatarUrl: null,
            htmlUrl: "https://github.com/alice",
            publicRepoCount: null,
            topLanguages: null,
          },
        ]}
      />,
    );
    const link = screen.getByRole("link", { name: /open/i });
    expect(link).toHaveAttribute("href", "https://github.com/alice");
    expect(link).toHaveAttribute("target", "_blank");
  });
});
