import type { Meta, StoryObj } from "@storybook/react";
import { borderRadiusPx } from "../../../tokens/radius";

const semantic = [
  {
    key: "external" as const,
    cssVar: "--tecma-values-border-radius-external",
    note: "Contenitori esterni → {radius.square.maximum}",
  },
  {
    key: "internal" as const,
    cssVar: "--tecma-values-border-radius-internal",
    note: "Dentro contenitori → {radius.square.intermediate}",
  },
  {
    key: "element" as const,
    cssVar: "--tecma-values-border-radius-element",
    note: "Elementi indipendenti (es. button) → {radius.square.intermediate}",
  },
  {
    key: "standard" as const,
    cssVar: "--tecma-values-border-radius-standard",
    note: "Forma vincolata → {radius.square.minimum}",
  },
] as const;

const scale = [
  { name: "standard → sm", pxKey: "standard" as const },
  { name: "element → md / button", pxKey: "element" as const },
  { name: "external → lg / card", pxKey: "external" as const },
] as const;

function RadiusFoundations() {
  const border = "hsl(var(--tecma-color-main-accent))";
  const bg = "hsl(var(--tecma-color-neutral-canvas))";
  const fg = "hsl(var(--tecma-color-neutral-on-general-sub))";

  return (
    <div
      className="sb-max-w-3xl sb-space-y-10 sb-p-6 sb-font-sans"
      style={{ color: "hsl(var(--tecma-color-neutral-on-general))" }}
    >
      <header>
        <h1 className="sb-text-2xl sb-font-semibold">Radius</h1>
        <p className="sb-mt-1 sb-text-s" style={{ color: fg }}>
          <strong>values.border-radius</strong> (Tecma v2). Primitive <code className="sb-code">radius.square.*</code> in{" "}
          <code className="sb-code">data/figma-primitives-radius.json</code> — <code className="sb-code">npm run sync:tokens</code>.
        </p>
      </header>

      <section>
        <h2 className="sb-text-l sb-font-semibold sb-mb-4">Token Figma</h2>
        <div className="sb-grid-2">
          {semantic.map(({ key, cssVar, note }) => (
            <div key={key} className="sb-flex sb-gap-4">
              <div
                className="sb-radius-box"
                style={{
                  borderColor: border,
                  background: bg,
                  borderRadius: `var(${cssVar})`,
                }}
              />
              <div>
                <p className="sb-font-mono sb-text-s sb-font-semibold">{key}</p>
                <p className="sb-mt-1 sb-text-xs" style={{ color: fg }}>
                  {borderRadiusPx[key]}px — var({cssVar})
                </p>
                <p className="sb-mt-1 sb-text-xs sb-leading-snug" style={{ color: fg }}>
                  {note}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="sb-text-l sb-font-semibold sb-mb-4">Scala pratica</h2>
        <div className="sb-flex sb-flex-wrap sb-gap-8">
          {scale.map(({ name, pxKey }) => (
            <div key={name} className="sb-flex sb-flex-col sb-items-center sb-gap-2">
              <div
                className="sb-radius-box sb-radius-box-lg"
                style={{
                  borderColor: border,
                  background: bg,
                  borderRadius: borderRadiusPx[pxKey],
                }}
              />
              <span className="sb-text-xs sb-font-mono" style={{ color: fg }}>
                {name}
              </span>
              <span className="sb-text-center sb-text-10 sb-leading-tight sb-max-w-3xl" style={{ color: fg, maxWidth: "8rem" }}>
                {borderRadiusPx[pxKey]}px
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const meta = {
  title: "Foundations/Radius",
  component: RadiusFoundations,
  parameters: {
    layout: "fullscreen",
    docs: {
      page: () => import("./Radius.mdx").then((m) => m.default),
    },
  },
} satisfies Meta<typeof RadiusFoundations>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <RadiusFoundations />,
};
