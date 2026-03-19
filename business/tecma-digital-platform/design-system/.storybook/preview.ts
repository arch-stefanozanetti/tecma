import type { Preview } from "@storybook/react";
import "../css/fonts.css";
import "../css/tokens.css";
import "../css/components.css";
import "../css/storybook-layout.css";

const preview: Preview = {
  parameters: {
    a11y: {
      element: "#storybook-root",
      manual: false,
      /** `error` fa fallire il test-runner su ogni violazione; `todo` segnala senza bloccare CI. */
      test: "todo",
    },
    controls: { expanded: true },
    layout: "padded",
    backgrounds: {
      default: "canvas",
      values: [
        { name: "canvas", value: "hsl(var(--tecma-color-neutral-canvas))" },
        { name: "white", value: "#ffffff" },
        { name: "dark", value: "#1a1a1a" },
      ],
    },
  },
};

export default preview;
