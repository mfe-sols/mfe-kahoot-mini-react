import { resolveApiBaseUrl, type KahootMiniPlayerSnapshot } from "./pin-session";

export type KahootMiniLeaderboardResponse = {
  leaderboard?: KahootMiniPlayerSnapshot[];
  topPlayers?: KahootMiniPlayerSnapshot[];
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
    throw new Error(`Leaderboard request failed with status ${response.status}`);
  }

  return (await response.json()) as KahootMiniLeaderboardResponse;
};
