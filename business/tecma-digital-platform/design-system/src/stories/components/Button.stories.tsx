import type { Meta, StoryObj } from "@storybook/react";
import { Button, type ButtonVariant } from "../../components/Button";
import { Icon } from "../../components/Icon";

const variants: ButtonVariant[] = [
  "primary",
  "secondary",
  "outline",
  "ghost",
  "muted",
  "inverse",
  "danger",
  "warning",
];

const meta = {
  title: "Components/Button",
  component: Button,
  parameters: {
    layout: "padded",
    docs: {
      page: () => import("./Button.mdx").then((m) => m.default),
      description: {
        component:
          "Button DS Tecma — [Figma 66:9864](https://www.figma.com/design/ZRftnYLwNGRshiXEkS7WGM/DS---Tecma-Software-Suite?node-id=66-9864). Stili in `css/components.css` + token `--tecma-*`. **Prima lettera sempre maiuscola** (anche negli esempi con testo in minuscolo).",
      },
    },
  },
  argTypes: {
    variant: { control: "select", options: variants },
    size: { control: "select", options: ["sm", "md", "lg"] },
    loading: { control: "boolean" },
    disabled: { control: "boolean" },
    iconOnly: { control: "boolean" },
  },
  args: {
    children: "azione",
    variant: "primary",
    size: "md",
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "Button"
  }
};

export const AllVariants: Story = {
  render: () => (
    <div className="sb-flex sb-flex-col sb-gap-8 sb-p-4">
      <div className="sb-panel sb-panel--canvas">
        <h3 className="sb-panel-title sb-panel-title--default">Su canvas (contesto app)</h3>
        <div className="sb-flex sb-flex-wrap sb-gap-3">
          {variants.map((v) => (
            <Button key={v} variant={v}>
              {v}
            </Button>
          ))}
        </div>
      </div>
      <div className="sb-panel sb-panel--dark">
        <h3 className="sb-panel-title sb-panel-title--on-dark">Su sfondo scuro</h3>
        <div className="sb-flex sb-flex-wrap sb-gap-3">
          {variants.map((v) => (
            <Button key={v} variant={v}>
              {v}
            </Button>
          ))}
        </div>
      </div>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="sb-flex sb-flex-wrap sb-items-center sb-gap-3 sb-p-4">
      <Button size="sm">piccolo</Button>
      <Button size="md">medio</Button>
      <Button size="lg">grande</Button>
    </div>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <div className="sb-flex sb-flex-wrap sb-gap-3 sb-p-4">
      <Button leftIcon={<Icon name="plus" size="md" />}>sinistra</Button>
      <Button rightIcon={<Icon name="plus" size="md" />}>destra</Button>
      <Button
        leftIcon={<Icon name="plus" size="md" />}
        rightIcon={<Icon name="chevron-right" size="md" />}
      >
        entrambe
      </Button>
    </div>
  ),
};

export const IconOnly: Story = {
  render: () => (
    <div className="sb-flex sb-flex-wrap sb-items-center sb-gap-3 sb-p-4">
      <Button iconOnly size="sm" aria-label="Aggiungi">
        <Icon name="plus" size="sm" />
      </Button>
      <Button iconOnly size="md" aria-label="Aggiungi">
        <Icon name="plus" size="md" />
      </Button>
      <Button iconOnly size="lg" variant="secondary" aria-label="Aggiungi">
        <Icon name="plus" size="lg" />
      </Button>
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="sb-flex sb-flex-wrap sb-gap-3 sb-p-4">
      <Button loading>caricamento</Button>
      <Button loading size="lg" variant="secondary">
        large
      </Button>
      <Button loading iconOnly aria-label="Caricamento">
        <Icon name="plus" size="md" />
      </Button>
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div
      className="sb-space-y-4 sb-p-4 sb-font-sans"
      style={{ color: "hsl(var(--tecma-color-neutral-on-general))" }}
    >
      <p className="sb-text-s" style={{ color: "hsl(var(--tecma-color-neutral-on-general-sub))" }}>
        Default / hover / active / focus (tab) / disabled
      </p>
      <div className="sb-flex sb-flex-wrap sb-gap-3">
        <Button>default</Button>
        <Button disabled>disabled</Button>
      </div>
    </div>
  ),
};
