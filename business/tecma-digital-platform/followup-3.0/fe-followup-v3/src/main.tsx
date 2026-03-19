import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastProvider } from "./contexts/ToastContext";
import "./styles.css";

const updateSW = registerSW({
  onNeedRefresh: () => {
    window.dispatchEvent(new CustomEvent("pwa-need-refresh"));
  },
});
if (typeof updateSW === "function") {
  (window as Window & { __pwa_updateSW?: (reload?: boolean) => Promise<void> }).__pwa_updateSW = updateSW;
}

// Strict Mode disabilitato: in dev può far comparire "Rendered more hooks than during the previous render"
// se un componente ha hook condizionali. Se l'errore scompare, cercare hook dopo return o in branch condizionali.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </ErrorBoundary>
);
