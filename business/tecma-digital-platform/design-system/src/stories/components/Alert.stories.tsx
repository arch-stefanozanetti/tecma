import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Alert, type AlertVariant } from "../../components/Alert";
import { Button } from "../../components/Button";

const variants: AlertVariant[] = [
  "default",
  "brand",
  "informative",
  "success",
  "warning",
  "error",
];

const meta: Meta<typeof Alert> = {
  title: "Components/Alert",
  component: Alert,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Alert DS Tecma — Figma 450:15027. Token semantici + neutral/brand.",
      },
    },
  },
  argTypes: {
    variant: { control: "select", options: variants },
    title: { control: "text" },
  },
  args: {
    title: "Title",
    variant: "informative",
  },
};

export default meta;
type Story = StoryObj<typeof Alert>;

export const Default: Story = {
  render: (args) => (
    <div style={{ maxWidth: 376 }}>
      <Alert
        {...args}
        description="Content text per provare layout a più righe."
        onDismiss={() => undefined}
        action={{ label: "Action", onClick: () => undefined }}
      />
    </div>
  ),
};

export const TitleOnly: Story = {
  render: () => (
    <div
      className="sb-font-sans"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
        gap: "1rem",
        maxWidth: 1200,
      }}
    >
      {variants.map((v) => (
        <Alert key={v} variant={v} title="Title" onDismiss={() => undefined} />
      ))}
    </div>
  ),
};

export const TitleAndDescription: Story = {
  render: () => (
    <div
      className="sb-font-sans"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
        gap: "1rem",
        maxWidth: 1200,
      }}
    >
      {variants.map((v) => (
        <Alert
          key={v}
          variant={v}
          title="Title"
          description="Content text"
          onDismiss={() => undefined}
        />
      ))}
    </div>
  ),
};

export const WithActionBelow: Story = {
  render: () => (
    <div style={{ maxWidth: 376 }}>
      <Alert
        variant="informative"
        title="Title"
        description="Content text"
        action={{ label: "Action", onClick: () => undefined, placement: "below" }}
        onDismiss={() => undefined}
      />
    </div>
  ),
};

export const TitleWithInlineAction: Story = {
  render: () => (
    <div style={{ maxWidth: 376 }}>
      <Alert
        variant="success"
        title="Title"
        action={{ label: "Action", onClick: () => undefined, placement: "titleEnd" }}
        onDismiss={() => undefined}
      />
    </div>
  ),
};

export const ActionBesideDescription: Story = {
  render: () => (
    <div style={{ maxWidth: 376 }}>
      <Alert
        variant="warning"
        title="Title"
        description="Content text allineato a sinistra con azione a destra."
        action={{
          label: "Action",
          onClick: () => undefined,
          placement: "besideDescription",
        }}
        onDismiss={() => undefined}
      />
    </div>
  ),
};

export const Dismissible: Story = {
  render: () => {
    const [vis, setVis] = useState(true);
    if (!vis) {
      return (
        <Button size="sm" variant="primary" onClick={() => setVis(true)}>
          mostra di nuovo
        </Button>
      );
    }
    return (
      <div style={{ maxWidth: 376 }}>
        <Alert
          variant="error"
          title="Errore"
          description="Messaggio di errore."
          onDismiss={() => setVis(false)}
        />
      </div>
    );
  },
};

export const NoIcon: Story = {
  render: () => (
    <div style={{ maxWidth: 376 }}>
      <Alert variant="default" title="Solo titolo" showIcon={false} />
    </div>
  ),
};
