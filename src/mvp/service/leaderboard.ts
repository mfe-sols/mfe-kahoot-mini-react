import { resolveApiBaseUrl, type KahootMiniPlayerSnapshot } from "./pin-session";

export type KahootMiniLeaderboardResponse = {
  leaderboard?: KahootMiniPlayerSnapshot[];
  topPlayers?: KahootMiniPlayerSnapshot[];
};

type ApiErrorPayload = {
  message?: string;
};

const readApiError = async (response: Response, fallbackMessage: string) => {
  const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
  return payload.message ?? fallbackMessage;
};

export const fetchLeaderboard = async (pin: string): Promise<KahootMiniLeaderboardResponse> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 10000);

  const response = await fetch(`${resolveApiBaseUrl()}/api/kahoot-mini/leaderboard?pin=${encodeURIComponent(pin)}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    signal: controller.signal,
  }).finally(() => {
    window.clearTimeout(timeoutId);
  });

  if (!response.ok) {
    throw new Error(
      await readApiError(response, `Leaderboard request failed with status ${response.status}`)
    );
  }

  return (await response.json()) as KahootMiniLeaderboardResponse;
};
