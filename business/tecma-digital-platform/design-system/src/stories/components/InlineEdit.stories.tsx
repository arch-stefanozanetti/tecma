import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { noop } from "../storyStubHandlers";
import {
  InlineEditText,
  InlineEditSelect,
  InlineEditMultiselect,
} from "../../components/InlineEdit";

const selectOptions = [
  { value: "a", label: "Opzione A" },
  { value: "b", label: "Opzione B" },
  { value: "c", label: "Opzione C" },
];

const multiOptions = [
  { value: "1", label: "Tag uno" },
  { value: "2", label: "Tag due" },
  { value: "3", label: "Tag tre" },
  { value: "4", label: "Tag quattro", disabled: true },
];

const meta = {
  title: "Components/InlineEdit",
  parameters: {
    layout: "padded",
    docs: {
      page: () => import("./InlineEdit.mdx").then((m) => m.default),
      description: {
        component:
          "Inline Edit DS Tecma — vista valore + modifica in place. Varianti: **Text** (input + cancel/confirm), **Select** (dropdown singolo), **Multiselect** (tag + menu con checkbox). [Figma 10582:1450](https://www.figma.com/design/ZRftnYLwNGRshiXEkS7WGM/DS---Tecma-Software-Suite?node-id=10582-1450), [10579:7431](https://www.figma.com/design/ZRftnYLwNGRshiXEkS7WGM?node-id=10579-7431), [10689:3244](https://www.figma.com/design/ZRftnYLwNGRshiXEkS7WGM?node-id=10689-3244).",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <div className="sb-p-4 sb-font-sans" style={{ maxWidth: 320 }}>
      <InlineEditText label="Field Label" placeholder="Add text" onSave={noop} />
    </div>
  ),
};

export const TextFilled: Story = {
  render: () => (
    <div className="sb-p-4 sb-font-sans" style={{ maxWidth: 320 }}>
      <InlineEditText
        label="Field Label"
        value="Valore salvato"
        placeholder="Add text"
        onSave={noop}
      />
    </div>
  ),
};

export const TextWithError: Story = {
  render: () => (
    <div className="sb-p-4 sb-font-sans" style={{ maxWidth: 320 }}>
      <InlineEditText
        label="Field Label"
        value="Valore"
        placeholder="Add text"
        errorMessage="Error text"
        onSave={noop}
      />
    </div>
  ),
};

function TextInteractiveDemo() {
  const [v, setV] = useState("");
  return (
    <div className="sb-p-4 sb-font-sans" style={{ maxWidth: 320 }}>
      <InlineEditText
        label="Campo"
        value={v}
        placeholder="Add text"
        onSave={(val) => setV(val)}
      />
      <p className="sb-mt-2 sb-text-s" style={{ color: "hsl(var(--tecma-color-neutral-on-general-sub))" }}>
        Valore: {v || "—"}
      </p>
    </div>
  );
}

export const TextInteractive: Story = {
  render: () => <TextInteractiveDemo />,
};

export const SelectDefault: Story = {
  render: () => (
    <div className="sb-p-4 sb-font-sans" style={{ maxWidth: 320 }}>
      <InlineEditSelect
        label="Field Label"
        options={selectOptions}
        placeholder="Add text"
        onChange={noop}
      />
    </div>
  ),
};

export const SelectFilled: Story = {
  render: () => (
    <div className="sb-p-4 sb-font-sans" style={{ maxWidth: 320 }}>
      <InlineEditSelect
        label="Field Label"
        value="b"
        options={selectOptions}
        placeholder="Add text"
        onChange={noop}
      />
    </div>
  ),
};

function SelectInteractiveDemo() {
  const [v, setV] = useState("");
  return (
    <div className="sb-p-4 sb-font-sans" style={{ maxWidth: 320 }}>
      <InlineEditSelect
        label="Scegli"
        value={v}
        options={selectOptions}
        placeholder="Add text"
        onChange={setV}
      />
      <p className="sb-mt-2 sb-text-s" style={{ color: "hsl(var(--tecma-color-neutral-on-general-sub))" }}>
        Valore: {v || "—"}
      </p>
    </div>
  );
}

export const SelectInteractive: Story = {
  render: () => <SelectInteractiveDemo />,
};

export const MultiselectDefault: Story = {
  render: () => (
    <div className="sb-p-4 sb-font-sans" style={{ maxWidth: 320 }}>
      <InlineEditMultiselect
        label="Field Label"
        options={multiOptions}
        placeholder="Add text"
        onChange={noop}
      />
    </div>
  ),
};

export const MultiselectFilled: Story = {
  render: () => (
    <div className="sb-p-4 sb-font-sans" style={{ maxWidth: 320 }}>
      <InlineEditMultiselect
        label="Field Label"
        value={["1", "2"]}
        options={multiOptions}
        placeholder="Add text"
        onChange={noop}
      />
    </div>
  ),
};

function MultiselectInteractiveDemo() {
  const [v, setV] = useState<string[]>([]);
  return (
    <div className="sb-p-4 sb-font-sans" style={{ maxWidth: 320 }}>
      <InlineEditMultiselect
        label="Tag"
        value={v}
        options={multiOptions}
        placeholder="Add text"
        onChange={setV}
      />
      <p className="sb-mt-2 sb-text-s" style={{ color: "hsl(var(--tecma-color-neutral-on-general-sub))" }}>
        Selezionati: {v.length ? v.join(", ") : "—"}
      </p>
    </div>
  );
}

export const MultiselectInteractive: Story = {
  render: () => <MultiselectInteractiveDemo />,
};

export const AllVariants: Story = {
  render: () => (
    <div className="sb-flex sb-flex-col sb-gap-8 sb-p-4 sb-font-sans" style={{ maxWidth: 360 }}>
      <section>
        <h3 className="sb-mb-2 sb-text-s sb-font-semibold" style={{ color: "hsl(var(--tecma-color-neutral-on-general))" }}>
          Text
        </h3>
        <div className="sb-flex sb-flex-col sb-gap-4">
          <InlineEditText label="Field Label" placeholder="Add text" onSave={noop} />
          <InlineEditText label="Field Label" value="Valore" placeholder="Add text" onSave={noop} />
        </div>
      </section>
      <section>
        <h3 className="sb-mb-2 sb-text-s sb-font-semibold" style={{ color: "hsl(var(--tecma-color-neutral-on-general))" }}>
          Select
        </h3>
        <div className="sb-flex sb-flex-col sb-gap-4">
          <InlineEditSelect label="Field Label" options={selectOptions} placeholder="Add text" onChange={noop} />
          <InlineEditSelect label="Field Label" value="b" options={selectOptions} onChange={noop} />
        </div>
      </section>
      <section>
        <h3 className="sb-mb-2 sb-text-s sb-font-semibold" style={{ color: "hsl(var(--tecma-color-neutral-on-general))" }}>
          Multiselect
        </h3>
        <div className="sb-flex sb-flex-col sb-gap-4">
          <InlineEditMultiselect label="Field Label" options={multiOptions} placeholder="Add text" onChange={noop} />
          <InlineEditMultiselect label="Field Label" value={["1", "2"]} options={multiOptions} onChange={noop} />
        </div>
      </section>
    </div>
  ),
};
