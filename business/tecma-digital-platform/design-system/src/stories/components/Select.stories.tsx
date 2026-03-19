import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { noop } from "../storyStubHandlers";
import {
  Select,
  SelectTrigger,
  SelectItem,
  SelectMenu,
  SelectMenuSection,
  SelectMenuToolbar,
  SelectMenuLink,
  SelectMenuAddRow,
  SelectMenuSearch,
  SelectMenuList,
} from "../../components/Select";

const options = [
  { value: "1", label: "Milano" },
  { value: "2", label: "Roma" },
  { value: "3", label: "Napoli" },
  { value: "4", label: "Torino", disabled: true },
];

const meta = {
  title: "Components/Select",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Select DS Tecma — atomi **SelectTrigger**, **SelectItem**, **SelectMenu**\\* che compongono il campo e il pannello. [Trigger 300:7666](https://www.figma.com/design/ZRftnYLwNGRshiXEkS7WGM/DS---Tecma-Software-Suite?node-id=300-7666), [menu 5057:1587](https://www.figma.com/design/ZRftnYLwNGRshiXEkS7WGM/DS---Tecma-Software-Suite?node-id=5057-1587), [voci 5057:1604](https://www.figma.com/design/ZRftnYLwNGRshiXEkS7WGM/DS---Tecma-Software-Suite?node-id=5057-1604).",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <div
      className="sb-flex sb-flex-col sb-gap-4 sb-p-4 sb-font-sans"
      style={{ maxWidth: "28rem" }}
    >
      <SelectTrigger size="sm" placeholder="Small" open={false} />
      <SelectTrigger size="md" placeholder="Medium" />
      <SelectTrigger size="lg" placeholder="Large" />
    </div>
  ),
};

export const TriggerStates: Story = {
  render: () => (
    <div
      className="sb-flex sb-flex-col sb-gap-4 sb-p-4 sb-font-sans"
      style={{ maxWidth: "28rem" }}
    >
      <SelectTrigger placeholder="Default" />
      <SelectTrigger>Roma</SelectTrigger>
      <SelectTrigger invalid placeholder="Invalid" />
      <SelectTrigger disabled placeholder="Disabled" />
      <SelectTrigger readOnly>Roma</SelectTrigger>
    </div>
  ),
};

function SelectSingleDemo() {
  const [v, setV] = useState("");
  return (
    <div className="sb-p-4 sb-font-sans">
      <Select
        options={options}
        value={v}
        onChange={(x) => setV(x as string)}
        placeholder="Scegli città"
        maxWidth="16rem"
      />
      <p className="sb-mt-2 sb-text-s" style={{ color: "hsl(var(--tecma-color-neutral-on-general-sub))" }}>
        Valore: {v || "—"}
      </p>
    </div>
  );
}

export const ComposedSingle: Story = {
  render: () => <SelectSingleDemo />,
};

function SelectMultiDemo() {
  const [v, setV] = useState<string[]>([]);
  return (
    <div className="sb-p-4 sb-font-sans">
      <Select
        options={options}
        value={v}
        onChange={(x) => setV(x as string[])}
        placeholder="Città"
        multiselect
        maxWidth="16rem"
      />
    </div>
  );
}

export const ComposedMultiselect: Story = {
  render: () => <SelectMultiDemo />,
};

export const ItemsAtoms: Story = {
  render: () => (
    <div
      className="sb-p-4 sb-font-sans"
      style={{
        color: "hsl(var(--tecma-color-neutral-on-general))",
        maxWidth: "28rem",
      }}
    >
      <p className="sb-text-s sb-mb-2" style={{ color: "hsl(var(--tecma-color-neutral-on-general-sub))" }}>
        Atom SelectItem — layout testo, check a destra, checkbox prima/dopo
      </p>
      <div className="sb-flex sb-flex-col sb-gap-2">
      <SelectItem layout="text">Solo testo</SelectItem>
      <SelectItem layout="checkEnd" selected>
        Selezionato (check trailing)
      </SelectItem>
      <SelectItem layout="checkboxStart">Checkbox sinistra</SelectItem>
      <SelectItem layout="checkboxStart" selected>
        Checkbox selezionato
      </SelectItem>
      <SelectItem layout="checkboxEnd" selected>
        Checkbox a destra
      </SelectItem>
      <SelectItem layout="text" disabled>
        Disabilitato
      </SelectItem>
      <SelectItem layout="checkEnd" selected invalid>
        Errore + selezionato
      </SelectItem>
      <SelectItem layout="text" description="Sottotitolo">
        Con descrizione
      </SelectItem>
      </div>
    </div>
  ),
};

export const MenuMoleculeDefault: Story = {
  render: () => (
    <div className="sb-p-4 sb-font-sans" style={{ maxWidth: 240 }}>
      <SelectMenu>
        <SelectMenuSection>
          <SelectMenuToolbar>
            <SelectMenuLink onClick={noop}>Select all</SelectMenuLink>
            <SelectMenuLink onClick={noop}>Deselect all</SelectMenuLink>
          </SelectMenuToolbar>
        </SelectMenuSection>
        <SelectMenuSection>
          <SelectMenuAddRow label='Add "Value"' onAdd={noop} />
        </SelectMenuSection>
        <SelectMenuList>
          {["One", "Two", "Three", "Four", "Five", "Six"].map((x) => (
            <SelectItem key={x} layout="text">
              {x}
            </SelectItem>
          ))}
        </SelectMenuList>
      </SelectMenu>
    </div>
  ),
};

export const MenuMoleculeCheckbox: Story = {
  render: () => (
    <div className="sb-p-4 sb-font-sans" style={{ maxWidth: 240 }}>
      <SelectMenu>
        <SelectMenuSection>
          <SelectMenuToolbar>
            <SelectMenuLink onClick={noop}>Select all</SelectMenuLink>
            <SelectMenuLink onClick={noop}>Deselect all</SelectMenuLink>
          </SelectMenuToolbar>
        </SelectMenuSection>
        <SelectMenuSection>
          <SelectMenuAddRow label='Add "Value"' onAdd={noop} />
        </SelectMenuSection>
        <SelectMenuList>
          {["Item", "Item", "Item", "Item", "Item", "Item"].map((x, i) => (
            <SelectItem key={i} layout="checkboxStart">
              {x}
            </SelectItem>
          ))}
        </SelectMenuList>
      </SelectMenu>
    </div>
  ),
};

function MenuMoleculeSearchDemo() {
  const [q, setQ] = useState("");
  return (
    <div className="sb-p-4 sb-font-sans" style={{ maxWidth: 240 }}>
      <SelectMenu>
        <SelectMenuSection>
          <SelectMenuSearch
            placeholder="Placeholder"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onClear={() => setQ("")}
          />
        </SelectMenuSection>
        <SelectMenuSection>
          <SelectMenuToolbar end>
            <SelectMenuLink onClick={noop}>Clear selection</SelectMenuLink>
          </SelectMenuToolbar>
        </SelectMenuSection>
        <SelectMenuList>
          <SelectItem layout="text">Item</SelectItem>
          <SelectItem layout="text">Item</SelectItem>
        </SelectMenuList>
      </SelectMenu>
    </div>
  );
}

export const MenuMoleculeSearch: Story = {
  render: () => <MenuMoleculeSearchDemo />,
};

export const MenuSimpleList: Story = {
  render: () => (
    <div className="sb-p-4 sb-font-sans" style={{ maxWidth: 200 }}>
      <SelectMenu>
        <SelectMenuList>
          <SelectItem layout="text">Item</SelectItem>
          <SelectItem layout="text">Item</SelectItem>
          <SelectItem layout="text">Item</SelectItem>
        </SelectMenuList>
      </SelectMenu>
    </div>
  ),
};
