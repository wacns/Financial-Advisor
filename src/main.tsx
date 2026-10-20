import React from "react";
import { createRoot } from "react-dom/client";
import App from "./application/App.jsx";
import "./web.css";
import { must } from "./guards.ts";
createRoot(must(document.getElementById("app"), "app root element")).render(<App />);
