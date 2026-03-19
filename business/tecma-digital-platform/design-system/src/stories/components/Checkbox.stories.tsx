import type { Meta, StoryObj } from "@storybook/react";
import { Checkbox } from "../../components/Checkbox";

const meta = {
  title: "Components/Checkbox",
  component: Checkbox,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Checkbox DS Tecma — [Figma 40:275](https://www.figma.com/design/ZRftnYLwNGRshiXEkS7WGM/DS---Tecma-Software-Suite?node-id=40-275). Token `--tecma-color-*`, tre misure (16 / 24 / 32 px).",
      },
    },
  },
  argTypes: {
    size: { control: "select", options: ["sm", "md", "lg"] },
    invalid: { control: "boolean" },
    readOnly: { control: "boolean" },
    disabled: { control: "boolean" },
    checked: { control: "boolean" },
  },
  args: {
    size: "md",
    children: "Etichetta opzionale",
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    size: "sm",
    children: "Checkbox"
  }
};

export const Sizes: Story = {
  render: () => (
    <div className="sb-flex sb-flex-col sb-gap-4 sb-p-4">
      <Checkbox size="sm">Small (16px)</Checkbox>
      <Checkbox size="md">Medium (24px)</Checkbox>
      <Checkbox size="lg">Large (32px)</Checkbox>
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div
      className="sb-p-4 sb-font-sans"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, auto)",
        gap: "1rem 1.5rem",
        alignItems: "center",
        color: "hsl(var(--tecma-color-neutral-on-general))",
      }}
    >
      <span className="sb-text-s sb-font-medium" style={{ gridColumn: "1 / -1" }}>
        Righe: sm / md / lg · Colonne: default · focus (tab) · invalid · disabled · read-only
      </span>
      {(["sm", "md", "lg"] as const).map((sz) => (
        <div
          key={sz}
          style={{
            display: "contents",
          }}
        >
          <Checkbox size={sz}>default</Checkbox>
          <Checkbox size={sz} autoFocus={sz === "sm"}>
            focus (tab)
          </Checkbox>
          <Checkbox size={sz} invalid>
            invalid
          </Checkbox>
          <Checkbox size={sz} disabled>
            disabled
          </Checkbox>
          <Checkbox size={sz} readOnly defaultChecked>
            read-only
          </Checkbox>
        </div>
      ))}
    </div>
  ),
};

export const CheckedVariants: Story = {
  render: () => (
    <div className="sb-flex sb-flex-wrap sb-gap-6 sb-p-4">
      <Checkbox size="md" defaultChecked>
        Selezionato
      </Checkbox>
      <Checkbox size="md" defaultChecked invalid>
        Selezionato + errore
      </Checkbox>
      <Checkbox size="md" defaultChecked disabled>
        Selezionato disabilitato
      </Checkbox>
    </div>
  ),
};
