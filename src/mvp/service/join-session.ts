import { resolveApiBaseUrl, type KahootMiniSnapshot } from "./pin-session";

export type KahootMiniPlayer = {
  id: string;
  name: string;
  joinedAt: string;
  score: number;
  correctAnswers: number;
  answersCount: number;
};

type JoinSessionParams = {
  pin: string;
  name: string;
  deviceId: string;
};

export type JoinSessionResponse = {
  player: KahootMiniPlayer;
  reconnected: boolean;
  snapshot?: KahootMiniSnapshot;
  streamUrl?: string;
};

type ApiErrorPayload = {
  message?: string;
};

export const joinPinSession = async ({
  pin,
  name,
  deviceId,
}: JoinSessionParams): Promise<JoinSessionResponse> => {
  const response = await fetch(`${resolveApiBaseUrl()}/api/kahoot-mini/join`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pin,
      name,
      deviceId,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    throw new Error(payload.message ?? `Join session failed with status ${response.status}`);
  }

  const payload = (await response.json()) as JoinSessionResponse;

  if (!payload?.player?.id) {
    throw new Error("Join session payload is missing `player.id`");
  }

  return payload;
};
