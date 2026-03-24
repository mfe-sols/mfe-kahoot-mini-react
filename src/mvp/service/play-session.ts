import { resolveApiBaseUrl } from "./pin-session";

export type KahootMiniPlayAction = "start" | "next" | "finish";
export type KahootMiniPlayerAction = "answer" | "skip";

type PlayActionParams = {
  pin: string;
  action: KahootMiniPlayAction;
};

type AnswerActionParams = {
  pin: string;
  playerId: string;
  questionId: number;
  answerId?: string;
  remainingSec?: number;
  action: KahootMiniPlayerAction;
};

type ApiErrorPayload = {
  message?: string;
};

const readApiError = async (response: Response, fallbackMessage: string) => {
  const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
  return payload.message ?? fallbackMessage;
};

export const sendPlayAction = async ({ pin, action }: PlayActionParams): Promise<void> => {
  const response = await fetch(`${resolveApiBaseUrl()}/api/kahoot-mini/play`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pin,
      action,
    }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Play action failed with status ${response.status}`));
  }
};

const sendPlayerAction = async ({
  pin,
  playerId,
  questionId,
  answerId,
  remainingSec,
  action,
}: AnswerActionParams): Promise<void> => {
  const response = await fetch(`${resolveApiBaseUrl()}/api/kahoot-mini/play`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pin,
      action,
      playerId,
      questionId,
      answerId,
      remainingSec,
    }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Player action failed with status ${response.status}`));
  }
};

export const submitPlayerAnswer = async ({
  pin,
  playerId,
  questionId,
  answerId,
  remainingSec,
}: Omit<AnswerActionParams, "action"> & { answerId: string }): Promise<void> =>
  sendPlayerAction({ pin, playerId, questionId, answerId, remainingSec, action: "answer" });

export const skipPlayerAnswer = async ({
  pin,
  playerId,
  questionId,
}: Omit<AnswerActionParams, "action" | "answerId">): Promise<void> =>
  sendPlayerAction({ pin, playerId, questionId, action: "skip" });
