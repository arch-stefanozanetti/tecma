import type { Meta, StoryObj } from "@storybook/react";
import { color } from "../../../tokens/color";

const colorVars = Object.keys(color.hex)
  .sort()
  .map((key) => ({
    var: `--tecma-color-${key.replace(/\./g, "-")}` as const,
    label: key.replace(/\./g, " / "),
  }));

function Swatch({ label, cssVar }: { label: string; cssVar: string }) {
  return (
    <div className="sb-swatch">
      <div className="sb-swatch-strip" style={{ background: `hsl(var(${cssVar}))` }} title={cssVar} />
      <div className="sb-swatch-label sb-font-sans">{label}</div>
      <div className="sb-swatch-var">{cssVar}</div>
    </div>
  );
}

function ColorsFoundations() {
  return (
    <div
      className="sb-max-w-6xl sb-space-y-10 sb-p-4 sb-font-sans"
      style={{ color: "hsl(var(--tecma-color-neutral-on-general))" }}
    >
      <header>
        <h1 className="sb-text-2xl sb-font-semibold sb-font-sans">Colori (Figma Alias / Tecma v2)</h1>
        <p className="sb-mt-1 sb-text-s" style={{ color: "hsl(var(--tecma-color-neutral-on-general-sub))" }}>
          <code className="sb-code">--tecma-color-*</code> da <code className="sb-code">tokens/color.ts</code>.
        </p>
      </header>
      <section className="sb-grid-colors">
        {colorVars.map(({ var: v, label }) => (
          <Swatch key={v} label={label} cssVar={v} />
        ))}
      </section>
    </div>
  );
}

const meta = {
  title: "Foundations/Colors",
  component: ColorsFoundations,
  parameters: {
    layout: "fullscreen",
    docs: {
      page: () => import("./Colors.mdx").then((m) => m.default),
    },
  },
} satisfies Meta<typeof ColorsFoundations>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <ColorsFoundations />,
};
