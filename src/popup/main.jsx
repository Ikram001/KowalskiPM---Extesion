import "@fontsource/inter/latin.css";
import "@fontsource/inter/latin-ext.css";
import "@fontsource/space-grotesk/latin.css";
import "@fontsource/space-grotesk/latin-ext.css";
import "./App.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
