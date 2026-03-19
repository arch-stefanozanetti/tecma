import type { Meta, StoryObj } from "@storybook/react";
import { ButtonGroup } from "../../components/ButtonGroup/ButtonGroup";
import { Button } from "../../components/Button";

const meta = {
  title: "Components/ButtonGroup",
  component: ButtonGroup,
  parameters: {
    layout: "padded",
    docs: {
      page: () => import("./ButtonGroup.mdx").then((m) => m.default),
      description: {
        component:
          "Button Group DS Tecma — bottoni attaccati (0px gap), bordi condivisi, angoli solo all’esterno. [Figma 456:10239](https://www.figma.com/design/ZRftnYLwNGRshiXEkS7WGM/DS---Tecma-Software-Suite?node-id=456-10239).",
      },
    },
  },
  argTypes: {
    layout: { control: "select", options: ["horizontal", "vertical"] },
    type: { control: "select", options: ["default", "segmented"] },
    size: { control: "select", options: ["sm", "md", "lg"] },
  },
  args: {
    layout: "horizontal",
    type: "default",
    size: "md",
  },
} satisfies Meta<typeof ButtonGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    layout: "horizontal",
    type: "default",
    size: "md",
    children: (
      <>
        <Button variant="primary">Attivo</Button>
        <Button variant="outline">Inattivo</Button>
      </>
    ),
  },
};

export const DefaultHorizontalThree: Story = {
  args: {
    layout: "horizontal",
    type: "default",
    size: "md",
    children: (
      <>
        <Button variant="primary">Uno</Button>
        <Button variant="outline">Due</Button>
        <Button variant="outline">Tre</Button>
      </>
    ),
  },
};

export const SegmentedHorizontal: Story = {
  args: {
    layout: "horizontal",
    type: "segmented",
    size: "md",
    children: (
      <>
        <Button variant="primary">Attivo</Button>
        <Button variant="outline">Inattivo</Button>
      </>
    ),
  },
};

export const DefaultVertical: Story = {
  args: {
    layout: "vertical",
    type: "default",
    size: "md",
    children: (
      <>
        <Button variant="primary">Primo</Button>
        <Button variant="outline">Secondo</Button>
      </>
    ),
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className="sb-flex sb-flex-col sb-gap-8 sb-p-4" style={{ alignItems: "flex-start" }}>
      <div>
        <p className="sb-text-s sb-mb-2" style={{ color: "hsl(var(--tecma-color-neutral-on-general-sub))" }}>
          Small
        </p>
        <ButtonGroup layout="horizontal" size="sm">
          <Button variant="primary">Sì</Button>
          <Button variant="outline">No</Button>
        </ButtonGroup>
      </div>
      <div>
        <p className="sb-text-s sb-mb-2" style={{ color: "hsl(var(--tecma-color-neutral-on-general-sub))" }}>
          Medium
        </p>
        <ButtonGroup layout="horizontal" size="md">
          <Button variant="primary">Sì</Button>
          <Button variant="outline">No</Button>
        </ButtonGroup>
      </div>
      <div>
        <p className="sb-text-s sb-mb-2" style={{ color: "hsl(var(--tecma-color-neutral-on-general-sub))" }}>
          Large
        </p>
        <ButtonGroup layout="horizontal" size="lg">
          <Button variant="primary">Sì</Button>
          <Button variant="outline">No</Button>
        </ButtonGroup>
      </div>
    </div>
  ),
};
