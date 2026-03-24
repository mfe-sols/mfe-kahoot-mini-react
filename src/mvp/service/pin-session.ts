export type KahootMiniPinSession = {
  id: string;
  pin: string;
  quizId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
};

export type KahootMiniQuiz = {
  id?: string;
  slug?: string;
  title?: string;
  description?: string;
  language?: string;
  timePerQuestionSec?: number;
  pointsPerCorrect?: number;
  questions?: KahootMiniQuizQuestion[];
};

export type KahootMiniQuizQuestionChoice = {
  id?: string;
  label?: string;
  text?: string;
};

export type KahootMiniQuizQuestion = {
  id?: number;
  prompt?: string;
  explanation?: string;
  correctAnswerId?: string;
  choices?: KahootMiniQuizQuestionChoice[];
};

export type KahootMiniState = {
  phase?: "lobby" | "question_live" | "question_closed" | "completed" | string;
  currentQuestionIndex?: number;
  totalQuestions?: number;
  closeReason?: "manual_finish" | "auto_completed" | "host_replaced" | "expired" | string;
};

export type KahootMiniQuestionChoice = {
  id?: string;
  label?: string;
  text?: string;
  content?: string;
};

export type KahootMiniCurrentQuestion = {
  id?: string | number;
  index?: number;
  prompt?: string;
  text?: string;
  question?: string;
  explanation?: string;
  correctAnswerId?: string;
  answerId?: string;
  timeLimitSec?: number;
  timeLeftSec?: number;
  remainingSec?: number;
  choices?: KahootMiniQuestionChoice[];
  options?: KahootMiniQuestionChoice[];
};

export type KahootMiniPlayerSnapshot = {
  id?: string;
  playerId?: string;
  rank?: number;
  name?: string;
  score?: number;
  correctAnswers?: number;
  answersCount?: number;
};

export type KahootMiniSnapshot = {
  session?: KahootMiniPinSession;
  state?: KahootMiniState;
  players?: KahootMiniPlayerSnapshot[];
  connectedPlayerIds?: string[];
  connectedPlayersCount?: number;
  leaderboard?: KahootMiniPlayerSnapshot[];
  topPlayers?: KahootMiniPlayerSnapshot[];
  currentQuestion?: KahootMiniCurrentQuestion;
};

export type KahootMiniPinLookupResponse = {
  session: KahootMiniPinSession;
  quiz?: KahootMiniQuiz;
  snapshot?: KahootMiniSnapshot;
};

type KahootMiniPlaySnapshotResponse = {
  snapshot?: KahootMiniSnapshot;
};

type ApiErrorPayload = {
  message?: string;
};

const normalizeApiBaseUrl = (value?: string | null) => value?.trim().replace(/\/+$/, "") ?? "";

const isLocalHostname = (value: string) => /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(value);

const isLocalApiBaseUrl = (value: string) =>
  /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/|$)/i.test(value);

export const resolveApiBaseUrl = () => {
  const browserLocation = typeof window !== "undefined" ? window.location : null;
  const isLocalPage = browserLocation ? isLocalHostname(browserLocation.hostname) : false;

  if (typeof document !== "undefined") {
    const metaAuthBaseUrl = normalizeApiBaseUrl(
      document.querySelector('meta[name="auth-base-url"]')?.getAttribute("content")
    );

    if (metaAuthBaseUrl && (!isLocalApiBaseUrl(metaAuthBaseUrl) || isLocalPage)) {
      return metaAuthBaseUrl;
    }
  }

  if (isLocalPage) {
    return "http://localhost:7272";
  }

  return "";
};

const requireApiBaseUrl = () => {
  const baseUrl = resolveApiBaseUrl();
  if (!baseUrl) {
    throw new Error("API base URL is not configured for this environment.");
  }
  return baseUrl;
};

const readApiError = async (response: Response, fallbackMessage: string) => {
  const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
  return payload.message ?? fallbackMessage;
};

export const fetchPinSessionByPin = async (pin: string): Promise<KahootMiniPinLookupResponse> => {
  const response = await fetch(`${requireApiBaseUrl()}/api/kahoot-mini/pin?pin=${encodeURIComponent(pin)}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `PIN lookup failed with status ${response.status}`));
  }

  const payload = (await response.json()) as KahootMiniPinLookupResponse;

  if (!payload?.session?.pin) {
    throw new Error("PIN lookup payload is missing `session.pin`");
  }

  return payload;
};

export const fetchPlaySnapshot = async (pin: string): Promise<KahootMiniSnapshot> => {
  const response = await fetch(`${requireApiBaseUrl()}/api/kahoot-mini/play?pin=${encodeURIComponent(pin)}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      await readApiError(response, `Play snapshot request failed with status ${response.status}`)
    );
  }

  const payload = (await response.json()) as KahootMiniPlaySnapshotResponse;

  if (!payload?.snapshot) {
    throw new Error("Play snapshot payload is missing `snapshot`");
  }

  return payload.snapshot;
};
