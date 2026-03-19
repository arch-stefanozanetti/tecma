import { useMemo, useState, type ChangeEvent } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Icon, ICON_NAMES, type IconName } from "../../components/Icon";

const meta = {
  title: "Components/Icon",
  component: Icon,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Icone Tecma (SVG). Sync: `npm run sync:icons`. Richiede `tokens.css` + `components.css` per il layout placeholder.",
      },
    },
  },
  argTypes: {
    name: { control: "select", options: [...ICON_NAMES] },
    size: { control: "select", options: ["xs", "sm", "md", "lg", "xl"] },
    filled: { control: "boolean" },
    preserveColors: { control: "boolean" },
  },
  args: {
    name: "emoji-happy" as IconName,
    size: "lg",
  },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Sizes: Story = {
  render: () => (
    <div
      className="sb-flex sb-flex-wrap sb-items-end sb-gap-6 sb-p-4 sb-font-sans"
      style={{ color: "hsl(var(--tecma-color-neutral-on-general))" }}
    >
      {(["xs", "sm", "md", "lg", "xl"] as const).map((s) => (
        <div key={s} className="sb-flex sb-flex-col sb-items-center sb-gap-2">
          <Icon name="bell" size={s} />
          <span className="sb-text-xs" style={{ color: "hsl(var(--tecma-color-neutral-on-general-sub))" }}>
            {s}
          </span>
        </div>
      ))}
    </div>
  ),
};

export const Filled: Story = {
  render: () => (
    <div
      className="sb-flex sb-flex-wrap sb-gap-6 sb-p-4 sb-font-sans"
      style={{ color: "hsl(var(--tecma-color-neutral-on-general))" }}
    >
      <div className="sb-flex sb-flex-col sb-items-center sb-gap-1">
        <Icon name="calendar" filled size="lg" />
        <span className="sb-text-xs">calendar + filled</span>
      </div>
      <div className="sb-flex sb-flex-col sb-items-center sb-gap-1">
        <Icon name="check-circle" filled size="lg" />
        <span className="sb-text-xs">check-circle + filled</span>
      </div>
      <div className="sb-flex sb-flex-col sb-items-center sb-gap-1">
        <Icon name="phone" filled size="lg" />
        <span className="sb-text-xs">phone + filled</span>
      </div>
    </div>
  ),
};

function Gallery() {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return ICON_NAMES;
    return ICON_NAMES.filter((id) => id.toLowerCase().includes(n));
  }, [q]);

  return (
    <div className="sb-p-4">
      <div className="sb-mb-4 sb-flex sb-flex-wrap sb-items-center sb-gap-3">
        <label className="sb-text-s sb-font-medium sb-font-sans" style={{ color: "hsl(var(--tecma-color-neutral-on-general))" }}>
          Cerca tra {ICON_NAMES.length} icone
        </label>
        <input
          type="search"
          value={q}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
          placeholder="es. arrow, user, logo…"
          className="sb-input-search"
        />
        <span className="sb-text-s sb-font-sans" style={{ color: "hsl(var(--tecma-color-neutral-on-general-sub))" }}>
          {filtered.length} risultati
        </span>
      </div>
      <div className="sb-icon-grid">
        {filtered.map((name) => (
          <div key={name} className="sb-icon-cell" title={name}>
            <Icon name={name} size="md" preserveColors={name.startsWith("logo-")} />
            <span className="sb-break-all sb-font-mono sb-text-10" style={{ color: "hsl(var(--tecma-color-neutral-on-general-sub))" }}>
              {name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const Catalog: Story = {
  render: () => <Gallery />,
  parameters: { layout: "fullscreen" },
};
