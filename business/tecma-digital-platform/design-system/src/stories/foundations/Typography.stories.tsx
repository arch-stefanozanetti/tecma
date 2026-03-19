import type { Meta, StoryObj } from "@storybook/react";

const standardSizes = [
  { token: "2xs", class: "sb-typ-2xs", cssVar: "--tecma-typography-size-standard-2xs" },
  { token: "xs", class: "sb-typ-xs", cssVar: "--tecma-typography-size-standard-xs" },
  { token: "s", class: "sb-typ-s", cssVar: "--tecma-typography-size-standard-s" },
  { token: "m", class: "sb-typ-m", cssVar: "--tecma-typography-size-standard-m" },
  { token: "l", class: "sb-typ-l", cssVar: "--tecma-typography-size-standard-l" },
  { token: "xl", class: "sb-typ-xl", cssVar: "--tecma-typography-size-standard-xl" },
  { token: "2xl", class: "sb-typ-2xl", cssVar: "--tecma-typography-size-standard-2xl" },
] as const;

const oversize = [
  { class: "sb-typ-os-s", cssVar: "--tecma-typography-size-oversize-s" },
  { class: "sb-typ-os-m", cssVar: "--tecma-typography-size-oversize-m" },
  { class: "sb-typ-os-l", cssVar: "--tecma-typography-size-oversize-l" },
  { class: "sb-typ-os-xl", cssVar: "--tecma-typography-size-oversize-xl" },
] as const;

const weights = [
  { var: "--tecma-typography-weight-thin", label: "thin" },
  { var: "--tecma-typography-weight-light", label: "light" },
  { var: "--tecma-typography-weight-regular", label: "regular" },
  { var: "--tecma-typography-weight-medium", label: "medium" },
  { var: "--tecma-typography-weight-semibold", label: "semibold" },
  { var: "--tecma-typography-weight-bold", label: "bold" },
] as const;

function TypographyFoundations() {
  const fg = "hsl(var(--tecma-color-neutral-on-general))";
  const sub = "hsl(var(--tecma-color-neutral-on-general-sub))";
  const border = "hsl(var(--tecma-color-neutral-general-border))";
  const canvas = "hsl(var(--tecma-color-neutral-canvas))";

  return (
    <div className="sb-max-w-3xl sb-space-y-12 sb-p-6 sb-font-sans" style={{ color: fg }}>
      <header>
        <h1 className="sb-text-2xl sb-font-semibold">Tipografia (Figma / Tecma)</h1>
        <p className="sb-mt-2 sb-typ-s" style={{ color: sub }}>
          Variabili <code className="sb-code" style={{ background: canvas }}>--tecma-typography-*</code>
        </p>
      </header>

      <section>
        <h2 className="sb-section-title" style={{ borderColor: border }}>
          Typeface
        </h2>
        <p
          className="sb-mb-2 sb-typ-xl"
          style={{
            fontFamily: `var(--tecma-typography-typeface-serif), Georgia, serif`,
          }}
        >
          Serif — var(--tecma-typography-typeface-serif)
        </p>
        <p className="sb-typ-xl" style={{ fontFamily: `var(--tecma-typography-typeface-sans-serif), sans-serif` }}>
          Sans — var(--tecma-typography-typeface-sans-serif)
        </p>
      </section>

      <section>
        <h2 className="sb-section-title" style={{ borderColor: border }}>
          Size standard
        </h2>
        <div className="sb-space-y-4">
          {standardSizes.map(({ class: c, token, cssVar }) => (
            <div key={c} className="sb-typ-row" style={{ borderColor: `${border}80` }}>
              <span className="sb-w-40 sb-shrink-0 sb-font-mono sb-text-xs" style={{ color: sub }}>
                {token} — {cssVar}
              </span>
              <span className={c}>The quick brown fox jumps over the lazy dog</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="sb-section-title" style={{ borderColor: border }}>
          Oversize
        </h2>
        <div className="sb-space-y-4">
          {oversize.map(({ class: c, cssVar }) => (
            <div key={c} className="sb-flex sb-flex-col sb-gap-1">
              <span className="sb-font-mono sb-text-xs" style={{ color: sub }}>
                {cssVar}
              </span>
              <span className={c}>Display</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="sb-section-title" style={{ borderColor: border }}>
          Weight
        </h2>
        <div className="sb-space-y-2 sb-typ-m">
          {weights.map(({ var: w, label }) => (
            <p key={w} style={{ fontWeight: `var(${w})` as unknown as number }}>
              {label} — {w}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}

const meta = {
  title: "Foundations/Typography",
  component: TypographyFoundations,
  parameters: {
    layout: "fullscreen",
    docs: {
      page: () => import("./Typography.mdx").then((m) => m.default),
    },
  },
} satisfies Meta<typeof TypographyFoundations>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <TypographyFoundations />,
};
