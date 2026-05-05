/**
 * The DevNest brand mark — `{` accent · "devnest" wordmark · `}` accent.
 * The `nest` segment carries a non-blinking caret-style underline in
 * --accent, mirroring an editor's text caret. Renders the same in
 * sidebar / sign-in / footer surfaces.
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
      <span className="text-foreground">
        dev
        <span
          className="relative"
          style={{
            borderBottom: "1.5px solid var(--color-accent)",
            paddingBottom: 1,
          }}
        >
          nest
        </span>
      </span>
      <span style={{ color: "var(--color-accent)" }}>{"}"}</span>
    </span>
  );
}
