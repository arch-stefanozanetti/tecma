import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { AccordionItem } from "../../components/Accordion";

const meta: Meta<typeof AccordionItem> = {
  title: "Components/Accordion",
  component: AccordionItem,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Accordion DS Tecma — Figma node 707:6874. Varianti Flat / Border, link footer opzionale.",
      },
    },
  },
  argTypes: {
    variant: { control: "select", options: ["flat", "border"] },
    disabled: { control: "boolean" },
    title: { control: "text" },
  },
  args: {
    title: "Title",
    variant: "flat",
    disabled: false,
  },
};

export default meta;
type Story = StoryObj<typeof AccordionItem>;

function SlotPlaceholder() {
  return (
    <div
      className="sb-flex sb-items-center sb-justify-center sb-p-6"
      style={{
        width: "100%",
        boxSizing: "border-box",
        border: "1px dashed hsl(var(--tecma-color-main-accent))",
        borderRadius: "var(--tecma-values-border-radius-element)",
        background: "hsl(var(--tecma-color-main-accent-light))",
        color: "hsl(var(--tecma-color-main-accent))",
        fontSize: "14px",
        minHeight: "80px",
      }}
    >
      Slot
    </div>
  );
}

export const Default: Story = {
  render: (args) => (
    <div style={{ maxWidth: 360 }}>
      <AccordionItem {...args} defaultOpen={true}>
        <SlotPlaceholder />
      </AccordionItem>
    </div>
  ),
};

export const FlatCollapsed: Story = {
  args: { variant: "flat", title: "Title" },
  render: (args) => (
    <div style={{ maxWidth: 280 }}>
      <AccordionItem {...args} defaultOpen={false} />
    </div>
  ),
};

export const FlatExpanded: Story = {
  render: () => (
    <div style={{ maxWidth: 280 }}>
      <AccordionItem title="Title" variant="flat" defaultOpen={true}>
        <SlotPlaceholder />
      </AccordionItem>
    </div>
  ),
};

export const FlatWithFooterLink: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <div style={{ maxWidth: 280 }}>
        <AccordionItem
          title="Title"
          variant="flat"
          open={open}
          onOpenChange={setOpen}
          footerLink={{
            label: open ? "See less" : "See all",
            onClick: () => setOpen(!open),
          }}
        >
          <SlotPlaceholder />
        </AccordionItem>
      </div>
    );
  },
};

export const FlatDisabled: Story = {
  render: () => (
    <div style={{ maxWidth: 280 }}>
      <AccordionItem title="Title" variant="flat" disabled />
    </div>
  ),
};

export const BorderCollapsed: Story = {
  render: () => (
    <div style={{ maxWidth: 280 }}>
      <AccordionItem title="Title" variant="border" defaultOpen={false} />
    </div>
  ),
};

export const BorderExpanded: Story = {
  render: () => (
    <div style={{ maxWidth: 280 }}>
      <AccordionItem
        title="Title"
        variant="border"
        defaultOpen={true}
        footerLink={{ label: "See all", onClick: () => undefined }}
      >
        <SlotPlaceholder />
      </AccordionItem>
    </div>
  ),
};

export const BorderDisabled: Story = {
  render: () => (
    <div style={{ maxWidth: 280 }}>
      <AccordionItem title="Title" variant="border" disabled />
    </div>
  ),
};

export const OverviewGrid: Story = {
  render: () => (
    <div
      className="sb-font-sans"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(200px, 1fr))",
        gap: "1.5rem 2rem",
        maxWidth: 900,
        alignItems: "start",
      }}
    >
      <AccordionItem title="Title" variant="flat" defaultOpen={false} />
      <AccordionItem title="Title" variant="flat" defaultOpen={true}>
        <SlotPlaceholder />
      </AccordionItem>
      <AccordionItem title="Title" variant="flat" disabled />
      <AccordionItem title="Title" variant="border" defaultOpen={false} />
      <AccordionItem title="Title" variant="border" defaultOpen={true}>
        <SlotPlaceholder />
      </AccordionItem>
      <AccordionItem title="Title" variant="border" disabled />
    </div>
  ),
};
