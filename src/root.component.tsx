import { useEffect, useRef, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  ensureThemeToggle,
} from "@mfe-sols/ui-kit";
import { getStoredLocale, setLocale, t } from "@mfe-sols/i18n";
import { createModel, type AppModel } from "./mvp/model";
import { createPresenter } from "./mvp/presenter";
import { createQueryClient } from "./mvp/service";
import { AppView } from "./mvp/view";

const getThemeFromElement = (target: Element | null): "light" | "dark" =>
  target?.getAttribute("data-theme") === "dark" ? "dark" : "light";

export default function Root() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const modelRef = useRef<AppModel | null>(null);
  const themeCleanupRef = useRef<(() => void) | null>(null);
  const [locale, setLocaleState] = useState(() => {
    if (typeof window === "undefined") return "en";
    const stored = getStoredLocale();
    setLocale(stored);
    return stored;
  });
  const [queryClient] = useState(() => createQueryClient());

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const applyLocale = (next: string) => {
      const normalized = next === "vi" ? "vi" : "en";
      setLocale(normalized);
      setLocaleState(normalized);
      document.documentElement.setAttribute("lang", normalized);
    };
    const onLocaleChange = (event: Event) => {
      const detail = (event as CustomEvent<{ locale?: string }>).detail;
      if (detail?.locale) applyLocale(detail.locale);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === "app-locale") {
        applyLocale(getStoredLocale());
      }
    };
    window.addEventListener("app-locale-change", onLocaleChange);
    window.addEventListener("storage", onStorage);
    applyLocale(getStoredLocale());
    return () => {
      window.removeEventListener("app-locale-change", onLocaleChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const rootEl = rootRef.current as HTMLDivElement | null;
    if (!rootEl) return undefined;

    const shellRoot = document.documentElement;
    const sharedKey = "ds-theme";
    const legacyKey = "ds-theme:mfe-kahoot-mini-react";

    const readStoredTheme = (): "light" | "dark" | null => {
      try {
        const shared = window.localStorage.getItem(sharedKey);
        if (shared === "dark" || shared === "light") return shared;
        const legacy = window.localStorage.getItem(legacyKey);
        if (legacy === "dark" || legacy === "light") return legacy;
      } catch {
        return null;
      }
      return null;
    };

    const applyThemeToModuleRoot = (mode: "light" | "dark") => {
      if (mode === "dark") {
        rootEl.setAttribute("data-theme", "dark");
      } else {
        rootEl.removeAttribute("data-theme");
      }
    };

    const syncFromShell = () => {
      const shellMode = getThemeFromElement(shellRoot);
      if (shellRoot.hasAttribute("data-theme")) {
        applyThemeToModuleRoot(shellMode);
        return;
      }

      const storedMode = readStoredTheme();
      const mode = storedMode ?? shellMode;
      if (storedMode) {
        if (storedMode === "dark") {
          shellRoot.setAttribute("data-theme", "dark");
        } else {
          shellRoot.removeAttribute("data-theme");
        }
      }
      applyThemeToModuleRoot(mode);
    };

    syncFromShell();

    const shellThemeObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.attributeName === "data-theme") {
          applyThemeToModuleRoot(getThemeFromElement(shellRoot));
          return;
        }
      }
    });
    shellThemeObserver.observe(shellRoot, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    const onStorage = (event: StorageEvent) => {
      if (event.key !== sharedKey && event.key !== legacyKey) return;
      const storedMode = readStoredTheme() ?? "light";
      if (storedMode === "dark") {
        shellRoot.setAttribute("data-theme", "dark");
      } else {
        shellRoot.removeAttribute("data-theme");
      }
    };
    window.addEventListener("storage", onStorage);

    if (themeCleanupRef.current) {
      themeCleanupRef.current();
      themeCleanupRef.current = null;
    }
    themeCleanupRef.current =
      ensureThemeToggle(rootEl, t("toggleTheme"), {
        target: shellRoot,
        storageKey: sharedKey,
        placement: "bottom-right",
      }) || null;

    return () => {
      shellThemeObserver.disconnect();
      window.removeEventListener("storage", onStorage);
      if (themeCleanupRef.current) {
        themeCleanupRef.current();
        themeCleanupRef.current = null;
      }
    };
  }, [locale]);

  if (!modelRef.current) {
    modelRef.current = createModel();
  }

  const viewModel = createPresenter(modelRef.current);

  return (
    <QueryClientProvider client={queryClient}>
      <main ref={rootRef}>
        <AppView {...viewModel} />
      </main>
    </QueryClientProvider>
  );
}
