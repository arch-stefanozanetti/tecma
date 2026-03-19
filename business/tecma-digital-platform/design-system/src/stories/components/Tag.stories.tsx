import type { Meta, StoryObj } from "@storybook/react";
import { noop } from "../storyStubHandlers";
import {
  Tag,
  type TagAppearance,
  type TagVariant,
} from "../../components/Tag";

const variants: TagVariant[] = [
  "default",
  "primary",
  "accentLight",
  "info",
  "success",
  "warning",
  "danger",
];

const meta = {
  title: "Components/Tag",
  component: Tag,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Tag DS Tecma — [Figma 599:7479](https://www.figma.com/design/ZRftnYLwNGRshiXEkS7WGM/DS---Tecma-Software-Suite?node-id=599-7479). Tipografia caption (xs / medium). Layout: statico, **click** (`onClick`), **dismiss** (`dismissible` + `onDismiss`).",
      },
    },
  },
  args: {
    children: "Tag",
    onDismiss: noop,
  },
} satisfies Meta<typeof Tag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    variant: "primary",
    appearance: "outline",
  },
};

export const OutlineRow: Story = {
  render: () => (
    <div className="sb-flex sb-flex-wrap sb-gap-2 sb-p-4 sb-font-sans">
      {variants.map((v) => (
        <Tag key={v} variant={v} appearance="outline">
          {v === "accentLight" ? "accent" : v}
        </Tag>
      ))}
    </div>
  ),
};

export const FilledRow: Story = {
  render: () => (
    <div className="sb-flex sb-flex-wrap sb-gap-2 sb-p-4 sb-font-sans">
      {variants.map((v) => (
        <Tag key={v} variant={v} appearance="filled">
          {v === "accentLight" ? "accent" : v}
        </Tag>
      ))}
    </div>
  ),
};

export const Clickable: Story = {
  render: () => (
    <div className="sb-flex sb-flex-wrap sb-gap-2 sb-p-4 sb-font-sans">
      <Tag variant="primary" appearance="outline" onClick={noop}>
        outline
      </Tag>
      <Tag variant="primary" appearance="filled" onClick={noop}>
        filled
      </Tag>
      <Tag variant="info" appearance="filled" onClick={noop}>
        info
      </Tag>
    </div>
  ),
};

export const Dismissible: Story = {
  render: () => (
    <div className="sb-flex sb-flex-col sb-gap-3 sb-p-4 sb-font-sans">
      <div className="sb-flex sb-flex-wrap sb-gap-2">
        <Tag variant="default" appearance="outline" dismissible onDismiss={noop}>
          default
        </Tag>
        <Tag variant="primary" appearance="filled" dismissible onDismiss={noop}>
          primary
        </Tag>
        <Tag variant="success" appearance="outline" dismissible onDismiss={noop}>
          success
        </Tag>
      </div>
      <p className="sb-text-s" style={{ color: "hsl(var(--tecma-color-neutral-on-general-sub))" }}>
        Cliccabile + dismiss: area testo e X separati.
      </p>
      <div className="sb-flex sb-flex-wrap sb-gap-2">
        <Tag
          variant="warning"
          appearance="filled"
          dismissible
          onDismiss={noop}
          onClick={noop}
        >
          filtro
        </Tag>
      </div>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="sb-flex sb-flex-wrap sb-gap-2 sb-p-4 sb-font-sans">
      <Tag variant="primary" appearance="filled" disabled>
        disabled
      </Tag>
      <Tag variant="danger" appearance="outline" dismissible disabled onDismiss={noop}>
        dismiss disabilitato
      </Tag>
    </div>
  ),
};

export const Matrix: Story = {
  render: () => (
    <div
      className="sb-p-4 sb-font-sans sb-space-y-6"
      style={{ color: "hsl(var(--tecma-color-neutral-on-general))" }}
    >
      {( ["outline", "filled"] as const).map((appearance) => (
        <div key={appearance}>
          <h3
            className="sb-mb-2 sb-text-s sb-font-semibold"
            style={{ textTransform: "capitalize" }}
          >
            {appearance}
          </h3>
          <div className="sb-flex sb-flex-col sb-gap-2">
            {variants.map((v) => (
              <div key={v} className="sb-flex sb-flex-wrap sb-items-center sb-gap-2">
                <span
                  className="sb-text-s sb-shrink-0"
                  style={{ width: "6rem", textTransform: "capitalize" }}
                >
                  {v === "accentLight" ? "accent light" : v}
                </span>
                <Tag variant={v} appearance={appearance as TagAppearance}>
                  Tag
                </Tag>
                <Tag
                  variant={v}
                  appearance={appearance as TagAppearance}
                  onClick={noop}
                >
                  click
                </Tag>
                <Tag
                  variant={v}
                  appearance={appearance as TagAppearance}
                  dismissible
                  onDismiss={noop}
                >
                  close
                </Tag>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  ),
};
