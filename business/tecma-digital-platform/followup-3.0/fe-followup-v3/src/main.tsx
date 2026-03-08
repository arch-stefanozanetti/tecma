import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles.css";

// Strict Mode disabilitato: in dev può far comparire "Rendered more hooks than during the previous render"
// se un componente ha hook condizionali. Se l'errore scompare, cercare hook dopo return o in branch condizionali.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </ErrorBoundary>
);
