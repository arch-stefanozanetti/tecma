import type { Meta, StoryObj } from "@storybook/react";
import { Avatar } from "../../components/Avatar";

const meta = {
  title: "Components/Avatar",
  component: Avatar,
  parameters: {
    layout: "padded",
    docs: {
      page: () => import("./Avatar.mdx").then((m) => m.default),
      description: {
        component:
          "Avatar DS Tecma — cerchio con variante **Icon** (user), **Image** (foto) o **Text** (iniziali). Size: sm 24px, md 40px, lg 64px. [Figma 725:6764](https://www.figma.com/design/ZRftnYLwNGRshiXEkS7WGM/DS---Tecma-Software-Suite?node-id=725-6764).",
      },
    },
  },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof Avatar>;

export const Default: Story = {
  args: { variant: "icon", size: "md" },
};

export const IconSmall: Story = {
  args: { variant: "icon", size: "sm" },
};

export const IconMedium: Story = {
  args: { variant: "icon", size: "md" },
};

export const IconLarge: Story = {
  args: { variant: "icon", size: "lg" },
};

export const TextSmall: Story = {
  args: { variant: "text", size: "sm", contentText: "MR" },
};

export const TextMedium: Story = {
  args: { variant: "text", size: "md", contentText: "MR" },
};

export const TextLarge: Story = {
  args: { variant: "text", size: "lg", contentText: "MR" },
};

export const ImageSmall: Story = {
  args: {
    variant: "image",
    size: "sm",
    src: "https://picsum.photos/48",
    alt: "Avatar utente",
  },
};

export const ImageMedium: Story = {
  args: {
    variant: "image",
    size: "md",
    src: "https://picsum.photos/80",
    alt: "Avatar utente",
  },
};

export const ImageLarge: Story = {
  args: {
    variant: "image",
    size: "lg",
    src: "https://picsum.photos/128",
    alt: "Avatar utente",
  },
};

export const AllVariants: Story = {
  render: () => (
    <div
      className="sb-flex sb-gap-8 sb-p-4 sb-font-sans"
      style={{ alignItems: "flex-end", flexWrap: "wrap" }}
    >
      <div className="sb-flex sb-flex-col sb-items-center sb-gap-2">
        <span className="sb-text-xs" style={{ color: "hsl(var(--tecma-color-neutral-on-general-sub))" }}>
          Icon
        </span>
        <div className="sb-flex sb-items-end sb-gap-4">
          <Avatar variant="icon" size="sm" />
          <Avatar variant="icon" size="md" />
          <Avatar variant="icon" size="lg" />
        </div>
      </div>
      <div className="sb-flex sb-flex-col sb-items-center sb-gap-2">
        <span className="sb-text-xs" style={{ color: "hsl(var(--tecma-color-neutral-on-general-sub))" }}>
          Image
        </span>
        <div className="sb-flex sb-items-end sb-gap-4">
          <Avatar variant="image" size="sm" src="https://picsum.photos/48" alt="" />
          <Avatar variant="image" size="md" src="https://picsum.photos/80" alt="" />
          <Avatar variant="image" size="lg" src="https://picsum.photos/128" alt="" />
        </div>
      </div>
      <div className="sb-flex sb-flex-col sb-items-center sb-gap-2">
        <span className="sb-text-xs" style={{ color: "hsl(var(--tecma-color-neutral-on-general-sub))" }}>
          Text
        </span>
        <div className="sb-flex sb-items-end sb-gap-4">
          <Avatar variant="text" size="sm" contentText="MR" />
          <Avatar variant="text" size="md" contentText="MR" />
          <Avatar variant="text" size="lg" contentText="MR" />
        </div>
      </div>
    </div>
  ),
};
