export type MfeErrorLevel = "error" | "warn" | "info";

type MfeErrorPayload = {
  type: "mfe-error";
  module: string;
  level: MfeErrorLevel;
  message: string;
  detail?: string;
  url?: string;
  messageKey?: string;
};

type MfeErrorReporter = {
  report: (
    level: MfeErrorLevel,
    message: string,
    detail?: string,
    extra?: Partial<MfeErrorPayload>
  ) => void;
};

type GlobalReporterRegistry = Record<string, MfeErrorReporter>;

const MAX_DETAIL = 800;
const DEDUPE_WINDOW_MS = 3000;
const REGISTRY_KEY = "__mfeErrorReporterRegistry__";

const getParentOrigin = (): string | null => {
  try {
    if (typeof document !== "undefined" && document.referrer) {
      return new URL(document.referrer).origin;
    }
  } catch {
    return null;
  }
  return null;
};

const isBridgeMode = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("mfe-bridge") === "1";
  } catch {
    return false;
  }
};

const getReporterRegistry = (): GlobalReporterRegistry => {
  const globalObj = window as unknown as Record<string, unknown>;
  const existing = globalObj[REGISTRY_KEY] as GlobalReporterRegistry | undefined;
  if (existing) return existing;
  const created: GlobalReporterRegistry = {};
  globalObj[REGISTRY_KEY] = created;
  return created;
};

export const initMfeErrorReporter = (moduleName: string): MfeErrorReporter => {
  if (typeof window === "undefined") {
    return { report: () => undefined };
  }

  const registry = getReporterRegistry();
  const cached = registry[moduleName];
  if (cached) return cached;

  const parentOrigin = isBridgeMode() ? getParentOrigin() : null;
  if (!parentOrigin || window.parent === window) {
    const noopReporter: MfeErrorReporter = { report: () => undefined };
    registry[moduleName] = noopReporter;
    return noopReporter;
  }

  const recent = new Map<string, number>();

  const post = (payload: MfeErrorPayload) => {
    window.parent.postMessage(payload, parentOrigin);
  };

  const report: MfeErrorReporter["report"] = (level, message, detail, extra) => {
    const safeMessage = message || "Module error";
    const safeDetail = detail ? String(detail).slice(0, MAX_DETAIL) : undefined;
    const key = `${level}:${safeMessage}:${safeDetail ?? ""}`;
    const now = Date.now();
    const last = recent.get(key);
    if (last && now - last < DEDUPE_WINDOW_MS) return;
    recent.set(key, now);

    post({
      type: "mfe-error",
      module: moduleName,
      level,
      message: safeMessage,
      detail: safeDetail,
      url: window.location.href,
      ...(extra || {}),
    });
  };

  const onError = (event: ErrorEvent) => {
    report(
      "error",
      event.message || "Runtime error",
      event.error?.stack || event.error?.message
    );
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    report(
      "error",
      "Unhandled promise rejection",
      event.reason?.stack || event.reason?.message || String(event.reason || "")
    );
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);

  const reporter: MfeErrorReporter = { report };
  registry[moduleName] = reporter;
  return reporter;
};

export type { MfeErrorReporter };
