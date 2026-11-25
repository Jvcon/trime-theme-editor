import React from "react";
import ReactDOM from "react-dom/client";
import { AuthoringApp } from "./authoring/AuthoringApp";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthoringApp />
  </React.StrictMode>,
);
