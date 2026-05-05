// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/profile/actions", () => ({
  updateProfile: vi.fn(async () => ({ ok: true })),
}));

import { ProfileForm } from "@/app/(app)/me/settings/profile-form";

describe("<ProfileForm />", () => {
  const initial = {
    handle: "alice",
    name: "Alice Anderson",
    headline: "Backend dev",
    bio: "Loves TypeScript.",
  };

  it("renders all four fields with initial values", () => {
    render(<ProfileForm initial={initial} />);

    expect(screen.getByLabelText(/handle/i)).toHaveValue("alice");
    expect(screen.getByLabelText(/display name/i)).toHaveValue(
      "Alice Anderson",
    );
    expect(screen.getByLabelText(/headline/i)).toHaveValue("Backend dev");
    expect(screen.getByLabelText(/bio/i)).toHaveValue("Loves TypeScript.");
  });

  it("enforces handle length via input attributes", () => {
    render(<ProfileForm initial={initial} />);
    const handle = screen.getByLabelText(/handle/i);
    expect(handle).toHaveAttribute("minLength", "3");
    expect(handle).toHaveAttribute("maxLength", "32");
    expect(handle).toBeRequired();
  });

  it("renders a save button", () => {
    render(<ProfileForm initial={initial} />);
    expect(
      screen.getByRole("button", { name: /save changes/i }),
    ).toBeInTheDocument();
  });
});
