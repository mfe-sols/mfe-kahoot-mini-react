import * as React from "react";
import * as ReactDOMClient from "react-dom/client";
import singleSpaReact from "single-spa-react";
import { defineDesignSystem, ensureTokens } from "@mfe-sols/ui-kit";
import Root from "./root.component";
import { initMfeErrorReporter } from "./mfe-error-reporter";
import "./i18n/domain-messages";

defineDesignSystem({ tailwind: true });
ensureTokens();

const reporter = initMfeErrorReporter("@org/mfe-kahoot-mini-react");

const isTrustedOrigin = (origin: string) =>
  origin === window.location.origin ||
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

const applyToggleMessage = () => {
  window.addEventListener("message", (event) => {
    if (!isTrustedOrigin(event.origin)) return;
    const data = event.data;
    if (!data || data.type !== "mfe-toggle" || !Array.isArray(data.disabled)) {
      return;
    }
    try {
      window.localStorage.setItem("mfe-disabled", JSON.stringify(data.disabled));
    } catch {
      return;
    }
    if (!window.location.search.includes("mfe-bridge=1")) {
      window.location.reload();
    }
  });
};

applyToggleMessage();
window.addEventListener("storage", (event) => {
  if (event.key === "mfe-disabled") {
    window.location.reload();
  }
});

const lifecycles = singleSpaReact({
  React,
  ReactDOMClient,
  rootComponent: Root,
  errorBoundary(err, info) {
    const detail = [err?.stack || String(err), info?.componentStack]
      .filter(Boolean)
      .join("\n");
    reporter.report("error", "React render error", detail);
    return null;
  },
});

export const { bootstrap, mount, unmount } = lifecycles;
