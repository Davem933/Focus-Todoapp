import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Agentation } from "agentation";
import { App } from "./App";
import { SharedTaskView } from "./layout/SharedTaskView";
import { registerServiceWorker } from "./pwa/registerServiceWorker";
import "./tailwind.css";

function getShareToken(): string | null {
  const match = window.location.pathname.match(/^\/share\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

const shareToken = getShareToken();

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    {shareToken ? (
      <SharedTaskView token={shareToken} />
    ) : (
      <>
        <App />
        {import.meta.env.DEV && <Agentation />}
      </>
    )}
  </StrictMode>,
);

if (import.meta.env.PROD && !shareToken) {
  registerServiceWorker();
}
