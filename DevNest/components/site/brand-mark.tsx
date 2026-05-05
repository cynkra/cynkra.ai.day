/**
 * The DevNest brand mark — `{` accent · "devnest" wordmark · `}` accent.
 * The `nest` segment carries a non-blinking caret-style underline in
 * --accent, mirroring an editor's text caret. Renders the same in
 * sidebar / sign-in / footer surfaces.
 *
 * `dev` and `nest` are split into separate `inline-block` boxes so the
 * line-box on `nest` is bound exactly to its four characters — the
 * underline starts at `n` and ends at `t` regardless of font size
 * (DEFECTS.md → D-4).
 */
export function BrandMark({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const fontSize = size === "lg" ? 28 : size === "sm" ? 14 : 18;
  return (
    <span
      className={`mono inline-flex items-baseline gap-1 ${className ?? ""}`}
      style={{ fontSize, fontWeight: 600 }}
    >
      <span style={{ color: "var(--color-accent)" }}>{"{"}</span>
      <span className="text-foreground inline-flex items-baseline">
        <span>dev</span>
        <span
          className="inline-block"
          style={{
            borderBottom: "1.5px solid var(--color-accent)",
            lineHeight: 1,
          }}
        >
          nest
        </span>
      </span>
      <span style={{ color: "var(--color-accent)" }}>{"}"}</span>
    </span>
  );
}
