import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { VoucherSessionProvider } from "./session/VoucherSessionContext";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <VoucherSessionProvider>
        <App />
      </VoucherSessionProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
