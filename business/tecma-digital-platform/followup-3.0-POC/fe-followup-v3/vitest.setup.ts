import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { expect } from "vitest";

expect.extend(matchers);

// Polyfill per Radix UI: jsdom non implementa questi metodi
if (typeof window !== "undefined") {
  window.HTMLElement.prototype.hasPointerCapture = () => false;
  window.HTMLElement.prototype.setPointerCapture = () => {};
  window.HTMLElement.prototype.releasePointerCapture = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};
}

// jsdom non implementa matchMedia (usato da MUI/Radix e PwaInstallPrompt)
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  });
}

const noisyWarnings = [
  "not wrapped in act(",
  "Missing `Description` or `aria-describedby={undefined}` for {DialogContent}.",
  "`DialogContent` requires a `DialogTitle` for the component to be accessible for screen reader users.",
];

const originalConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const first = args[0];
  if (typeof first === "string" && noisyWarnings.some((token) => first.includes(token))) {
    return;
  }
  originalConsoleError(...args);
};

afterEach(() => {
  cleanup();
});
