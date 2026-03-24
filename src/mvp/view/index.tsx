import { useEffect, useRef, useState } from "react";
import type { QuizQuestion } from "../model";
import type { AppViewModel } from "../presenter";
import { calculateAccuracy, calculateMaxScore, calculateTimedCorrectPoints } from "../usecase";
import {
  fetchPlaySnapshot,
  fetchPinSessionByPin,
  resolveApiBaseUrl,
  type KahootMiniPinLookupResponse,
  type KahootMiniPlayerSnapshot,
  type KahootMiniQuizQuestion,
  type KahootMiniSnapshot,
} from "../service/pin-session";
import { joinPinSession, type KahootMiniPlayer } from "../service/join-session";
import { fetchLeaderboard, type KahootMiniLeaderboardResponse } from "../service/leaderboard";
import { skipPlayerAnswer, submitPlayerAnswer } from "../service/play-session";

type Props = AppViewModel;

type Phase = "pin" | "name" | "intro" | "playing" | "finished";

type StreamState = "idle" | "connecting" | "open" | "error";

type RoundAnswer = {
  questionId: number;
  selectedId: string | null;
  correctAnswerId: string;
  isCorrect: boolean;
};

const DEVICE_KEY = "kahoot-mini-device-id";
const SESSION_RESET_CHANNEL = "kahoot-mini-session-reset";
const SESSION_RESET_STORAGE_KEY = "kahoot-mini-session-reset";
const PREJOIN_LOOKUP_STORAGE_KEY = "kahoot-mini-prejoin-lookup";

const answerPalette = ["#ef4444", "#3b82f6", "#f59e0b", "#10b981"];

const pageStyle = {
  width: "100%",
  maxWidth: "1200px",
  margin: "0 auto",
  padding: "clamp(12px, 2.5vw, 28px)",
  boxSizing: "border-box" as const,
};

const stackStyle = {
  display: "grid",
  gap: "16px",
};

const panelStyle = {
  borderRadius: "22px",
  border: "1px solid rgba(15, 23, 42, 0.08)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(246,248,255,0.92) 100%)",
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
  padding: "20px",
};

const heroShellStyle = {
  position: "relative" as const,
  overflow: "hidden" as const,
  background:
    "radial-gradient(circle at top left, rgba(20, 184, 166, 0.12) 0%, rgba(255,255,255,0) 34%), radial-gradient(circle at top right, rgba(59, 130, 246, 0.14) 0%, rgba(255,255,255,0) 38%), linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,247,255,0.96) 100%)",
};

const sectionBadgeStyle = {
  display: "inline-flex",
  width: "fit-content",
  alignItems: "center",
  gap: "8px",
  padding: "8px 12px",
  borderRadius: "999px",
  background: "rgba(255,255,255,0.12)",
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
};

const softMetricCardStyle = {
  borderRadius: "20px",
  padding: "18px",
  background: "rgba(255,255,255,0.88)",
  border: "1px solid rgba(148, 163, 184, 0.18)",
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.06)",
};

const frostPanelStyle = {
  display: "grid",
  gap: "14px",
  padding: "20px",
  borderRadius: "24px",
  background: "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(239,246,255,0.9) 100%)",
  border: "1px solid rgba(191, 219, 254, 0.7)",
  boxShadow: "0 20px 42px rgba(37, 99, 235, 0.12)",
};

const answerButtonBase = {
  border: "none",
  borderRadius: "18px",
  color: "#fff",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column" as const,
  gap: "8px",
  minHeight: "104px",
  padding: "16px",
  textAlign: "left" as const,
  transition: "transform 180ms ease, opacity 180ms ease, box-shadow 180ms ease",
};

const findChoiceText = (question: QuizQuestion, answerId: string | null, fallback: string) =>
  question.choices.find((choice) => choice.id === answerId)?.text ?? fallback;

const createDeviceId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `kahoot-mini-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getDeviceId = () => {
  if (typeof window === "undefined") {
    return "kahoot-mini-server-device";
  }

  const existingId = window.localStorage.getItem(DEVICE_KEY);
  if (existingId) return existingId;

  const nextId = createDeviceId();
  window.localStorage.setItem(DEVICE_KEY, nextId);
  return nextId;
};

const getPlayerStorageKey = (pin: string) => `kahoot-mini-player:${pin}`;
const getAnswerSubmissionStorageKey = (pin: string, playerId: string, questionId: number) =>
  `kahoot-mini-answer:${pin}:${playerId}:${questionId}`;

const readStoredSubmittedAnswer = (pin: string, playerId: string, questionId: number) => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(getAnswerSubmissionStorageKey(pin, playerId, questionId)) !== null;
  } catch {
    return false;
  }
};

const writeStoredSubmittedAnswer = (pin: string, playerId: string, questionId: number, value: string | null) => {
  if (typeof window === "undefined") return;
  try {
    const key = getAnswerSubmissionStorageKey(pin, playerId, questionId);
    if (value === null) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage errors
  }
};

const resolveStreamUrl = (streamUrl: string) => {
  if (/^https?:\/\//.test(streamUrl)) return streamUrl;
  const baseUrl = resolveApiBaseUrl();
  return `${baseUrl}${streamUrl.startsWith("/") ? "" : "/"}${streamUrl}`;
};

const getRealtimeLabel = (streamState: StreamState) => {
  if (streamState === "open") return "Connected";
  if (streamState === "connecting") return "Connecting";
  if (streamState === "error") return "Error";
  return "Idle";
};

const getRealtimeTone = (streamState: StreamState) => {
  if (streamState === "open") {
    return {
      background: "rgba(15, 118, 110, 0.12)",
      border: "1px solid rgba(13, 148, 136, 0.28)",
      color: "#0f766e",
      dot: "#14b8a6",
    };
  }

  if (streamState === "connecting") {
    return {
      background: "rgba(59, 130, 246, 0.12)",
      border: "1px solid rgba(59, 130, 246, 0.24)",
      color: "#2563eb",
      dot: "#3b82f6",
    };
  }

  if (streamState === "error") {
    return {
      background: "rgba(239, 68, 68, 0.12)",
      border: "1px solid rgba(239, 68, 68, 0.24)",
      color: "#dc2626",
      dot: "#ef4444",
    };
  }

  return {
    background: "rgba(71, 85, 105, 0.1)",
    border: "1px solid rgba(100, 116, 139, 0.22)",
    color: "#475569",
    dot: "#94a3b8",
  };
};

const getJoinedPhaseLabel = (phase: string, labels: Props["labels"]) => {
  if (phase === "question_live") return labels.joinedPhaseQuestionLiveLabel;
  if (phase === "question_closed") return labels.joinedPhaseQuestionClosedLabel;
  if (phase === "completed") return labels.joinedPhaseCompletedLabel;
  return labels.joinedPhaseLobbyLabel;
};

const getJoinedPhaseTone = (phase: string) => {
  if (phase === "question_live") {
    return {
      background: "linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(249, 115, 22, 0.14) 100%)",
      border: "1px solid rgba(249, 115, 22, 0.24)",
      color: "#c2410c",
    };
  }

  if (phase === "question_closed") {
    return {
      background: "linear-gradient(135deg, rgba(99, 102, 241, 0.14) 0%, rgba(59, 130, 246, 0.12) 100%)",
      border: "1px solid rgba(99, 102, 241, 0.2)",
      color: "#4338ca",
    };
  }

  if (phase === "completed") {
    return {
      background: "linear-gradient(135deg, rgba(16, 185, 129, 0.14) 0%, rgba(6, 182, 212, 0.12) 100%)",
      border: "1px solid rgba(16, 185, 129, 0.22)",
      color: "#0f766e",
    };
  }

  return {
    background: "linear-gradient(135deg, rgba(30, 41, 59, 0.08) 0%, rgba(59, 130, 246, 0.1) 100%)",
    border: "1px solid rgba(100, 116, 139, 0.18)",
    color: "#334155",
  };
};

const isPinGoneError = (message: string) => /pin not found or expired/i.test(message);

const shouldResetSessionFromSnapshot = (snapshot: KahootMiniSnapshot | null | undefined) => {
  if (!snapshot) return false;

  const closeReason = snapshot.state?.closeReason;
  const status = snapshot.session?.status;

  return (
    status === "expired" ||
    closeReason === "host_replaced" ||
    closeReason === "manual_finish" ||
    closeReason === "expired"
  );
};

const readLatestSessionResetToken = () => {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(SESSION_RESET_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
};

const readUrlJoinPin = () => {
  if (typeof window === "undefined") return "";
  try {
    const url = new URL(window.location.href);
    return (
      url.searchParams.get("kahootPin")?.trim() ||
      url.searchParams.get("pin")?.trim() ||
      ""
    );
  } catch {
    return "";
  }
};

const clearUrlJoinPin = () => {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("kahootPin");
    url.searchParams.delete("pin");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // ignore malformed URL state
  }
};

const isUsablePinLookup = (lookup: KahootMiniPinLookupResponse | null) => {
  if (!lookup?.session?.pin) return false;
  if (!lookup.session.expiresAt) return true;
  const expiresAtMs = new Date(lookup.session.expiresAt).getTime();
  return !Number.isNaN(expiresAtMs) && expiresAtMs > Date.now();
};

const readStoredPrejoinLookup = (): KahootMiniPinLookupResponse | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PREJOIN_LOOKUP_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as KahootMiniPinLookupResponse;
    if (!isUsablePinLookup(parsed)) {
      window.sessionStorage.removeItem(PREJOIN_LOOKUP_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const persistPrejoinLookup = (lookup: KahootMiniPinLookupResponse | null) => {
  if (typeof window === "undefined") return;
  try {
    if (lookup && isUsablePinLookup(lookup)) {
      window.sessionStorage.setItem(PREJOIN_LOOKUP_STORAGE_KEY, JSON.stringify(lookup));
      return;
    }
    window.sessionStorage.removeItem(PREJOIN_LOOKUP_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
};

const normalizeQuizQuestion = (question: KahootMiniQuizQuestion, index: number): QuizQuestion | null => {
  if (
    typeof question.id !== "number" ||
    typeof question.prompt !== "string" ||
    typeof question.explanation !== "string" ||
    typeof question.correctAnswerId !== "string" ||
    !Array.isArray(question.choices)
  ) {
    return null;
  }

  const choices = question.choices
    .map((choice) => {
      if (
        typeof choice.id !== "string" ||
        typeof choice.label !== "string" ||
        typeof choice.text !== "string"
      ) {
        return null;
      }

      return {
        id: choice.id as QuizQuestion["correctAnswerId"],
        label: choice.label,
        text: choice.text,
      };
    })
    .filter((choice): choice is QuizQuestion["choices"][number] => choice !== null);

  if (choices.length === 0) return null;

  return {
    id: question.id ?? index + 1,
    prompt: question.prompt,
    explanation: question.explanation,
    correctAnswerId: question.correctAnswerId as QuizQuestion["correctAnswerId"],
    choices,
  };
};

const normalizeQuizQuestions = (questions: KahootMiniQuizQuestion[] | undefined, fallback: QuizQuestion[]) => {
  if (!Array.isArray(questions) || questions.length === 0) return fallback;

  const normalized = questions
    .map((question, index) => normalizeQuizQuestion(question, index))
    .filter((question): question is QuizQuestion => question !== null);

  return normalized.length > 0 ? normalized : fallback;
};

const normalizeQuestionId = (questionId: string | number | undefined) => {
  if (typeof questionId === "number") return questionId;
  if (typeof questionId === "string" && questionId.trim() !== "") {
    const parsed = Number(questionId);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const resolveSnapshotQuestionIndex = (
  nextSnapshot: KahootMiniSnapshot | null | undefined,
  activeQuestions: QuizQuestion[],
  fallbackIndex: number
) => {
  const snapshotIndex = nextSnapshot?.currentQuestion?.index ?? nextSnapshot?.state?.currentQuestionIndex;
  if (
    typeof snapshotIndex === "number" &&
    snapshotIndex >= 0 &&
    snapshotIndex < activeQuestions.length
  ) {
    return snapshotIndex;
  }

  const snapshotQuestionId = normalizeQuestionId(nextSnapshot?.currentQuestion?.id);
  if (snapshotQuestionId !== null) {
    const matchedIndex = activeQuestions.findIndex((question) => question.id === snapshotQuestionId);
    if (matchedIndex >= 0) {
      return matchedIndex;
    }
  }

  return fallbackIndex;
};

const findPlayerSnapshot = (players: KahootMiniPlayerSnapshot[] | undefined, playerId: string | undefined) => {
  if (!players?.length || !playerId) return null;
  return players.find((player) => player.id === playerId) ?? null;
};

const isJoinOpen = (
  pinLookup: KahootMiniPinLookupResponse | null | undefined,
  liveSnapshot?: KahootMiniSnapshot | null
) => {
  const phase = liveSnapshot?.state?.phase ?? pinLookup?.snapshot?.state?.phase;
  const status = liveSnapshot?.session?.status ?? pinLookup?.session?.status;

  const isLobby = !phase || phase === "lobby";
  const isWaiting = !status || status === "waiting";

  return isLobby && isWaiting;
};

export const AppView = ({
  introEyebrow,
  introBody,
  questions,
  timePerQuestionSec,
  pointsPerCorrect,
  labels,
}: Props): JSX.Element => {
  const initialPrejoinLookup = readStoredPrejoinLookup();
  const [phase, setPhase] = useState<Phase>(initialPrejoinLookup ? "name" : "pin");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedAtRemainingSec, setSelectedAtRemainingSec] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(timePerQuestionSec);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<RoundAnswer[]>([]);
  const [enteredPin, setEnteredPin] = useState(initialPrejoinLookup?.session?.pin ?? "");
  const [pinError, setPinError] = useState("");
  const [isPinChecking, setIsPinChecking] = useState(false);
  const [pinLookup, setPinLookup] = useState<KahootMiniPinLookupResponse | null>(initialPrejoinLookup);
  const [playerName, setPlayerName] = useState("");
  const [nameError, setNameError] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [joinedPlayer, setJoinedPlayer] = useState<KahootMiniPlayer | null>(null);
  const [joinedReconnected, setJoinedReconnected] = useState(false);
  const [snapshot, setSnapshot] = useState<KahootMiniSnapshot | null>(initialPrejoinLookup?.snapshot ?? null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [streamState, setStreamState] = useState<StreamState>("idle");
  const [lastPingAt, setLastPingAt] = useState<string | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<KahootMiniLeaderboardResponse | null>(null);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState("");
  const [playApiError, setPlayApiError] = useState("");
  const [submittingQuestionId, setSubmittingQuestionId] = useState<number | null>(null);
  const [lockedQuestionId, setLockedQuestionId] = useState<number | null>(null);
  const processedQuestionIdsRef = useRef<Set<number>>(new Set());
  const submittedQuestionIdsRef = useRef<Set<number>>(new Set());
  const leaderboardRetryRef = useRef(0);
  const leaderboardRetryTimerRef = useRef<number | null>(null);
  const lastSeenResetTokenRef = useRef(readLatestSessionResetToken());
  const lastAutoPinRef = useRef("");
  const lastPrejoinValidationPinRef = useRef("");

  const resetToPinEntry = () => {
    persistPrejoinLookup(null);
    setPhase("pin");
    setCurrentIndex(0);
    setSelectedId(null);
    setSelectedAtRemainingSec(null);
    setRevealed(false);
    setTimeLeft(timePerQuestionSec);
    setScore(0);
    setAnswers([]);
    setEnteredPin("");
    setPinError("");
    setIsPinChecking(false);
    setPinLookup(null);
    setPlayerName("");
    setNameError("");
    setIsJoining(false);
    setJoinedPlayer(null);
    setJoinedReconnected(false);
    setSnapshot(null);
    setStreamUrl(null);
    setStreamState("idle");
    setLastPingAt(null);
    setLeaderboardData(null);
    setIsLeaderboardLoading(false);
    setLeaderboardError("");
    setPlayApiError("");
    setSubmittingQuestionId(null);
    setLockedQuestionId(null);
    processedQuestionIdsRef.current.clear();
    submittedQuestionIdsRef.current.clear();
  };

  const activeQuestions = normalizeQuizQuestions(pinLookup?.quiz?.questions, questions);
  const activePointsPerCorrect = pinLookup?.quiz?.pointsPerCorrect ?? pointsPerCorrect;
  const currentQuestion = activeQuestions[currentIndex] ?? activeQuestions[0];
  const totalQuestions = activeQuestions.length;
  const activeTimePerQuestion = pinLookup?.quiz?.timePerQuestionSec ?? timePerQuestionSec;
  const maxScore = calculateMaxScore(totalQuestions, activePointsPerCorrect);
  const answeredCount = answers.length;
  const correctCount = answers.filter((answer) => answer.isCorrect).length;
  const accuracy = calculateAccuracy(correctCount, totalQuestions);
  const latestAnswer = answers[answers.length - 1] ?? null;
  const currentPin = pinLookup?.session.pin ?? enteredPin;
  const hasActiveSession = Boolean(currentPin && joinedPlayer?.id);
  const isReloadGuardActive = hasActiveSession && (phase === "intro" || phase === "playing");

  const quizTitle = pinLookup?.quiz?.title ?? pinLookup?.session.quizId ?? "Quiz";
  const quizDescription = pinLookup?.quiz?.description ?? introBody;
  const quizQuestionCount = activeQuestions.length;
  const quizTimer = pinLookup?.quiz?.timePerQuestionSec ?? timePerQuestionSec;
  const snapshotPhase = snapshot?.state?.phase ?? pinLookup?.snapshot?.state?.phase ?? "lobby";
  const snapshotCloseReason = snapshot?.state?.closeReason ?? pinLookup?.snapshot?.state?.closeReason ?? null;
  const snapshotTimeLeft =
    snapshot?.currentQuestion?.timeLeftSec ?? snapshot?.currentQuestion?.remainingSec ?? activeTimePerQuestion;
  const snapshotQuestionIndex = resolveSnapshotQuestionIndex(snapshot ?? pinLookup?.snapshot, activeQuestions, currentIndex);
  const playersCount =
    snapshot?.connectedPlayersCount ??
    snapshot?.connectedPlayerIds?.length ??
    pinLookup?.snapshot?.connectedPlayersCount ??
    pinLookup?.snapshot?.connectedPlayerIds?.length ??
    snapshot?.players?.length ??
    pinLookup?.snapshot?.players?.length ??
    0;
  const currentPlayerSnapshot = findPlayerSnapshot(snapshot?.players, joinedPlayer?.id);
  const currentPlayerScore = score || currentPlayerSnapshot?.score || joinedPlayer?.score || 0;
  const topPlayers = leaderboardData?.topPlayers ?? [];
  const leaderboard = leaderboardData?.leaderboard ?? [];
  const podiumPlayers = (leaderboard.length > 0 ? leaderboard : topPlayers).slice(0, 3);
  const currentPlayerBoardEntry =
    leaderboard.find((player) => player.playerId === joinedPlayer?.id || player.id === joinedPlayer?.id) ?? null;
  const currentPlayerRank = currentPlayerBoardEntry?.rank ?? (currentPlayerBoardEntry ? leaderboard.indexOf(currentPlayerBoardEntry) + 1 : null);
  const currentPlayerCorrect = currentPlayerBoardEntry?.correctAnswers ?? currentPlayerSnapshot?.correctAnswers ?? correctCount;
  const currentPlayerAnswersCount =
    currentPlayerBoardEntry?.answersCount ?? currentPlayerSnapshot?.answersCount ?? answeredCount;
  const isCurrentQuestionSubmitting = submittingQuestionId === currentQuestion.id;
  const isCurrentQuestionLocked = lockedQuestionId === currentQuestion.id;
  const shouldResetOnCompleted =
    snapshotCloseReason === "manual_finish" || snapshotCloseReason === "host_replaced";
  const shouldResetCurrentSession = shouldResetSessionFromSnapshot(snapshot ?? pinLookup?.snapshot);
  const realtimeTone = getRealtimeTone(streamState);
  const joinedPhaseLabel = getJoinedPhaseLabel(snapshotPhase, labels);
  const joinedPhaseTone = getJoinedPhaseTone(snapshotPhase);
  const playerIdentity = joinedPlayer?.name?.trim() || "-";
  const playerInitial = playerIdentity && playerIdentity !== "-" ? playerIdentity.charAt(0).toUpperCase() : "?";

  const joinedMessage =
    snapshotPhase === "lobby"
      ? labels.joinedLobby
      : snapshotPhase === "question_live"
      ? labels.joinedQuestionLive
      : snapshotPhase === "question_closed"
      ? labels.joinedQuestionClosed
      : snapshotPhase === "completed"
      ? labels.joinedCompleted
      : labels.joinedWaiting;

  const resyncPlayState = async (pin: string) => {
    try {
      const nextSnapshot = await fetchPlaySnapshot(pin);
      if (shouldResetSessionFromSnapshot(nextSnapshot)) {
        resetToPinEntry();
        return;
      }
      setSnapshot(nextSnapshot);
      setPlayApiError("");
    } catch (error) {
      const message = error instanceof Error ? error.message : labels.hostActionError;
      if (isPinGoneError(message)) {
        resetToPinEntry();
        return;
      }
      setPlayApiError(message);
    }
  };

  const loadLeaderboard = async (pin: string) => {
    setIsLeaderboardLoading(true);
    setLeaderboardError("");
    let scheduledRetry = false;

    try {
      const payload = await fetchLeaderboard(pin);
      const items = payload.leaderboard ?? [];
      const hasCurrentPlayer =
        !joinedPlayer?.id ||
        items.some((player) => player.playerId === joinedPlayer.id || player.id === joinedPlayer.id);

      if (items.length === 0 || !hasCurrentPlayer) {
        if (leaderboardRetryRef.current < 5) {
          leaderboardRetryRef.current += 1;
          scheduledRetry = true;
          leaderboardRetryTimerRef.current = window.setTimeout(() => {
            leaderboardRetryTimerRef.current = null;
            setIsLeaderboardLoading(false);
            setLeaderboardData(null);
          }, 1200);
          return;
        }
      }

      setLeaderboardData(payload);
    } catch (error) {
      setLeaderboardError(error instanceof Error ? error.message : labels.leaderboardEmpty);
    } finally {
      if (scheduledRetry) return;
      setIsLeaderboardLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const applyResetIfNeeded = (token?: string | null) => {
      const nextToken = token ?? readLatestSessionResetToken();
      if (!nextToken || nextToken === lastSeenResetTokenRef.current) return;
      lastSeenResetTokenRef.current = nextToken;
      resetToPinEntry();
    };

    let channel: BroadcastChannel | null = null;

    if (typeof window.BroadcastChannel !== "undefined") {
      channel = new window.BroadcastChannel(SESSION_RESET_CHANNEL);
      channel.addEventListener("message", (event) => {
        const token =
          typeof event.data === "string"
            ? event.data
            : typeof event.data?.token === "string"
            ? event.data.token
            : null;
        applyResetIfNeeded(token);
      });
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== SESSION_RESET_STORAGE_KEY) return;
      applyResetIfNeeded(event.newValue);
    };

    const onVisibilityOrFocus = () => {
      applyResetIfNeeded();
    };

    const intervalId = window.setInterval(() => {
      applyResetIfNeeded();
    }, 1000);

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onVisibilityOrFocus);
    window.addEventListener("visibilitychange", onVisibilityOrFocus);

    return () => {
      if (channel) {
        channel.close();
      }
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onVisibilityOrFocus);
      window.removeEventListener("visibilitychange", onVisibilityOrFocus);
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (joinedPlayer?.id || phase !== "name" || !pinLookup) {
      persistPrejoinLookup(null);
      return;
    }

    persistPrejoinLookup(pinLookup);
  }, [phase, pinLookup, joinedPlayer?.id]);

  useEffect(() => {
    if (phase !== "name" || joinedPlayer?.id || !pinLookup?.session?.pin) {
      lastPrejoinValidationPinRef.current = "";
      return;
    }

    const restoringStoredLookup = enteredPin === pinLookup.session.pin;
    if (!restoringStoredLookup) {
      lastPrejoinValidationPinRef.current = "";
      return;
    }

    if (lastPrejoinValidationPinRef.current === pinLookup.session.pin) {
      return;
    }

    lastPrejoinValidationPinRef.current = pinLookup.session.pin;
    let cancelled = false;

    void (async () => {
      try {
        const latestLookup = await fetchPinSessionByPin(pinLookup.session.pin);
        const latestSnapshot = latestLookup.snapshot ?? null;

        if (cancelled) return;

        if (!isJoinOpen(latestLookup, latestSnapshot)) {
          resetToPinEntry();
          setPinError(labels.joinClosed);
          return;
        }

        setPinLookup(latestLookup);
        setSnapshot(latestSnapshot);
        persistPrejoinLookup(latestLookup);
      } catch (error) {
        if (cancelled) return;

        const message = error instanceof Error ? error.message : labels.pinUnavailable;
        if (isPinGoneError(message)) {
          resetToPinEntry();
          setPinError(labels.pinUnavailable);
          return;
        }

        setNameError(message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [phase, pinLookup, joinedPlayer?.id, enteredPin, labels.joinClosed, labels.pinUnavailable]);

  useEffect(() => {
    if (!isReloadGuardActive || typeof window === "undefined") return undefined;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [isReloadGuardActive]);

  useEffect(() => {
    if (phase !== "playing" || isCurrentQuestionSubmitting) return undefined;
    const intervalId = window.setInterval(() => {
      setTimeLeft((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [phase, currentIndex, isCurrentQuestionSubmitting]);

  useEffect(() => {
    if (phase !== "playing") return;
    if (snapshotPhase !== "question_live") return;
    if (timeLeft > 1) return;
    if (!currentPin || !joinedPlayer?.id) return;
    if (isCurrentQuestionSubmitting) return;

    const questionId = currentQuestion.id;
    if (processedQuestionIdsRef.current.has(questionId)) return;
    if (submittedQuestionIdsRef.current.has(questionId)) return;
    if (readStoredSubmittedAnswer(currentPin, joinedPlayer.id, questionId)) {
      submittedQuestionIdsRef.current.add(questionId);
      return;
    }

    void syncAnswerToBackend(questionId, selectedId, timeLeft);
  }, [
    phase,
    snapshotPhase,
    selectedId,
    timeLeft,
    currentPin,
    joinedPlayer?.id,
    isCurrentQuestionSubmitting,
    currentQuestion.id,
  ]);

  useEffect(() => {
    if (!streamUrl || typeof window === "undefined") return undefined;

    const eventSource = new EventSource(streamUrl);
    setStreamState("connecting");
    setLastPingAt(null);

    const onConnected = () => {
      setStreamState("open");
      if (currentPin) {
        void resyncPlayState(currentPin);
      }
    };

    const onSnapshot = (event: MessageEvent<string>) => {
      try {
        const nextSnapshot = JSON.parse(event.data) as KahootMiniSnapshot;
        if (shouldResetSessionFromSnapshot(nextSnapshot)) {
          resetToPinEntry();
          return;
        }
        setSnapshot(nextSnapshot);
        setStreamState("open");
      } catch {
        setStreamState("error");
      }
    };

    const onPing = () => {
      setLastPingAt(new Date().toLocaleTimeString("vi-VN"));
      setStreamState("open");
    };

    eventSource.onopen = () => {
      setStreamState("connecting");
    };
    eventSource.onerror = () => {
      setStreamState("error");
      if (currentPin) {
        void resyncPlayState(currentPin);
      }
    };
    eventSource.addEventListener("connected", onConnected as EventListener);
    eventSource.addEventListener("snapshot", onSnapshot as EventListener);
    eventSource.addEventListener("ping", onPing as EventListener);

    return () => {
      eventSource.removeEventListener("connected", onConnected as EventListener);
      eventSource.removeEventListener("snapshot", onSnapshot as EventListener);
      eventSource.removeEventListener("ping", onPing as EventListener);
      eventSource.close();
    };
  }, [streamUrl, currentPin]);

  useEffect(() => {
    if (phase !== "intro") return;

    if (shouldResetCurrentSession) {
      resetToPinEntry();
      return;
    }

    if (snapshotPhase === "question_live") {
      setCurrentIndex(snapshotQuestionIndex);
      setSelectedId(null);
      setSelectedAtRemainingSec(null);
      setRevealed(false);
      setTimeLeft(snapshotTimeLeft);
      setScore(0);
      setAnswers([]);
      setLeaderboardData(null);
      setLeaderboardError("");
      setPlayApiError("");
      setSubmittingQuestionId(null);
      setLockedQuestionId(null);
      processedQuestionIdsRef.current.clear();
      submittedQuestionIdsRef.current.clear();
      setPhase("playing");
      return;
    }

    if (snapshotPhase === "completed") {
      if (shouldResetOnCompleted) {
        resetToPinEntry();
        return;
      }
      if (currentPin) {
        void loadLeaderboard(currentPin);
      }
      setPhase("finished");
    }
  }, [
    phase,
    snapshotPhase,
    snapshotQuestionIndex,
    snapshotTimeLeft,
    shouldResetOnCompleted,
    shouldResetCurrentSession,
    currentPin,
  ]);

  useEffect(() => {
    if (phase === "playing" && shouldResetCurrentSession) {
      resetToPinEntry();
      return;
    }

    if (phase === "playing" && snapshotPhase === "completed") {
      if (shouldResetOnCompleted) {
        resetToPinEntry();
        return;
      }
      if (currentPin) {
        void loadLeaderboard(currentPin);
      }
      setPhase("finished");
    }
  }, [phase, snapshotPhase, currentPin, shouldResetOnCompleted, shouldResetCurrentSession]);

  useEffect(() => {
    if (phase === "playing" && timeLeft === 0 && !isCurrentQuestionSubmitting) {
      void advanceCurrentQuestion();
    }
  }, [phase, timeLeft, isCurrentQuestionSubmitting, currentQuestion.id]);

  useEffect(() => {
    if (phase !== "playing") return;

    if (snapshotPhase === "question_live") {
      if (snapshotQuestionIndex !== currentIndex) {
        setCurrentIndex(snapshotQuestionIndex);
        setSelectedId(null);
        setSelectedAtRemainingSec(null);
        setRevealed(false);
        setPlayApiError("");
        setSubmittingQuestionId(null);
        setLockedQuestionId(null);
      }
      setTimeLeft(snapshotTimeLeft);
      return;
    }

    if (snapshotPhase === "question_closed") {
      setRevealed(true);
      setTimeLeft(0);
    }
  }, [phase, snapshotPhase, snapshotQuestionIndex, snapshotTimeLeft, currentIndex]);

  useEffect(() => {
    if (phase !== "finished") {
      leaderboardRetryRef.current = 0;
      if (leaderboardRetryTimerRef.current) {
        window.clearTimeout(leaderboardRetryTimerRef.current);
        leaderboardRetryTimerRef.current = null;
      }
      if (leaderboardData || leaderboardError || isLeaderboardLoading) {
        setLeaderboardData(null);
        setLeaderboardError("");
        setIsLeaderboardLoading(false);
      }
      return;
    }

    if (!currentPin || isLeaderboardLoading || leaderboardData) return;
    void loadLeaderboard(currentPin);
  }, [phase, currentPin, leaderboardData, leaderboardError, isLeaderboardLoading, labels.leaderboardEmpty]);

  const syncAnswerToBackend = async (questionId: number, choiceId: string | null, remainingSec: number) => {
    if (!currentPin || !joinedPlayer?.id) return;
    if (readStoredSubmittedAnswer(currentPin, joinedPlayer.id, questionId)) {
      submittedQuestionIdsRef.current.add(questionId);
      setLockedQuestionId(questionId);
      return;
    }
    if (submittedQuestionIdsRef.current.has(questionId)) return;
    submittedQuestionIdsRef.current.add(questionId);
    writeStoredSubmittedAnswer(currentPin, joinedPlayer.id, questionId, "pending");
    setSubmittingQuestionId(questionId);

    try {
      setPlayApiError("");
      const effectiveRemainingSec = choiceId ? selectedAtRemainingSec ?? remainingSec : remainingSec;

      if (choiceId) {
        await submitPlayerAnswer({
          pin: currentPin,
          playerId: joinedPlayer.id,
          questionId,
          answerId: choiceId,
          remainingSec: effectiveRemainingSec,
        });
      } else {
        await skipPlayerAnswer({
          pin: currentPin,
          playerId: joinedPlayer.id,
          questionId,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : labels.hostActionError;
      if (message === "Player already answered this question") {
        writeStoredSubmittedAnswer(currentPin, joinedPlayer.id, questionId, "done");
        setLockedQuestionId(questionId);
        return;
      }
      submittedQuestionIdsRef.current.delete(questionId);
      writeStoredSubmittedAnswer(currentPin, joinedPlayer.id, questionId, null);
      setPlayApiError(message);
    } finally {
      if (submittedQuestionIdsRef.current.has(questionId)) {
        writeStoredSubmittedAnswer(currentPin, joinedPlayer.id, questionId, "done");
        setLockedQuestionId(questionId);
      }
      setSubmittingQuestionId((current) => (current === questionId ? null : current));
    }
  };

  const finalizeAnswerLocally = (questionId: number, choiceId: string | null, remainingSec: number) => {
    const isCorrect = choiceId === currentQuestion.correctAnswerId;
    const effectiveRemainingSec = choiceId ? selectedAtRemainingSec ?? remainingSec : remainingSec;
    setAnswers((current) => [
      ...current,
      {
        questionId,
        selectedId: choiceId,
        correctAnswerId: currentQuestion.correctAnswerId,
        isCorrect,
      },
    ]);
    if (isCorrect) {
      setScore((current) =>
        current + calculateTimedCorrectPoints(effectiveRemainingSec, activePointsPerCorrect, activeTimePerQuestion)
      );
    }
  };

  const advanceCurrentQuestion = async () => {
    const questionId = currentQuestion.id;
    if (processedQuestionIdsRef.current.has(questionId)) return;
    processedQuestionIdsRef.current.add(questionId);

    const remainingSec = timeLeft;

    finalizeAnswerLocally(questionId, selectedId, remainingSec);
    setRevealed(true);
    await syncAnswerToBackend(questionId, selectedId, remainingSec);
  };

  const advanceSelectedAnswer = () => {
    if (isCurrentQuestionSubmitting) return;
    advanceCurrentQuestion();
  };

  const validatePin = async () => {
    if (enteredPin.length !== 6) {
      setPinError(labels.pinError);
      return;
    }

    setIsPinChecking(true);
    setPinError("");

    try {
      const nextLookup = await fetchPinSessionByPin(enteredPin);
      const nextSnapshot = nextLookup.snapshot ?? null;

      if (!isJoinOpen(nextLookup, nextSnapshot)) {
        persistPrejoinLookup(null);
        setPinLookup(null);
        setSnapshot(null);
        setPinError(labels.joinClosed);
        return;
      }

      setPinLookup(nextLookup);
      setSnapshot(nextSnapshot);
      setCurrentIndex(0);
      setSelectedId(null);
      setRevealed(false);
      setScore(0);
      setAnswers([]);
      setTimeLeft(nextLookup.quiz?.timePerQuestionSec ?? timePerQuestionSec);
      setSelectedAtRemainingSec(null);
      setPlayApiError("");
      setSubmittingQuestionId(null);
      processedQuestionIdsRef.current.clear();
      submittedQuestionIdsRef.current.clear();
      persistPrejoinLookup(nextLookup);
      setPhase("name");
    } catch {
      persistPrejoinLookup(null);
      setPinLookup(null);
      setSnapshot(null);
      setPinError(labels.pinUnavailable);
    } finally {
      setIsPinChecking(false);
    }
  };

  const joinGame = async () => {
    const sanitizedName = playerName.trim();

    if (!pinLookup?.session?.pin || !sanitizedName) {
      setNameError(labels.nameError);
      return;
    }

    setIsJoining(true);
    setNameError("");

    try {
      const latestLookup = await fetchPinSessionByPin(pinLookup.session.pin);
      const latestSnapshot = latestLookup.snapshot ?? null;

      if (!isJoinOpen(latestLookup, latestSnapshot)) {
        resetToPinEntry();
        setPinError(labels.joinClosed);
        return;
      }

      setPinLookup(latestLookup);
      setSnapshot(latestSnapshot);

      const payload = await joinPinSession({
        pin: pinLookup.session.pin,
        name: sanitizedName,
        deviceId: getDeviceId(),
      });

      if (typeof window !== "undefined") {
        window.localStorage.setItem(getPlayerStorageKey(pinLookup.session.pin), payload.player.id);
      }

      setJoinedPlayer(payload.player);
      setJoinedReconnected(payload.reconnected);
      setSnapshot(payload.snapshot ?? null);
      setStreamUrl(payload.streamUrl ? resolveStreamUrl(payload.streamUrl) : null);
      persistPrejoinLookup(null);
      void resyncPlayState(pinLookup.session.pin);
      setPhase("intro");
    } catch (error) {
      const message = error instanceof Error ? error.message : labels.nameError;
      if (message === labels.joinClosed || /already started|already live|not in lobby/i.test(message)) {
        resetToPinEntry();
        setPinError(labels.joinClosed);
        return;
      }
      setNameError(message);
    } finally {
      setIsJoining(false);
    }
  };

  useEffect(() => {
    if (phase !== "pin" || pinLookup || isPinChecking) return;

    const urlPin = readUrlJoinPin();
    if (!/^\d{6}$/.test(urlPin)) return;
    if (lastAutoPinRef.current === urlPin) return;

    lastAutoPinRef.current = urlPin;
    setEnteredPin(urlPin);
    setPinError("");
    void (async () => {
      setIsPinChecking(true);

      try {
        const nextLookup = await fetchPinSessionByPin(urlPin);
        const nextSnapshot = nextLookup.snapshot ?? null;

        if (!isJoinOpen(nextLookup, nextSnapshot)) {
          persistPrejoinLookup(null);
          setPinLookup(null);
          setSnapshot(null);
          setPinError(labels.joinClosed);
          return;
        }

        setPinLookup(nextLookup);
        setSnapshot(nextSnapshot);
        setCurrentIndex(0);
        setSelectedId(null);
        setSelectedAtRemainingSec(null);
        setRevealed(false);
        setScore(0);
        setAnswers([]);
        setTimeLeft(nextLookup.quiz?.timePerQuestionSec ?? timePerQuestionSec);
        setPlayApiError("");
        setSubmittingQuestionId(null);
        processedQuestionIdsRef.current.clear();
        submittedQuestionIdsRef.current.clear();
        clearUrlJoinPin();
        persistPrejoinLookup(nextLookup);
        setPhase("name");
      } catch {
        persistPrejoinLookup(null);
        setPinLookup(null);
        setSnapshot(null);
        setPinError(labels.pinUnavailable);
      } finally {
        setIsPinChecking(false);
      }
    })();
  }, [phase, pinLookup, isPinChecking, labels.joinClosed, labels.pinUnavailable, timePerQuestionSec]);

  return (
    <section style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <section style={pageStyle}>
        <section style={stackStyle}>
          {phase === "pin" ? (
            <section
              style={{
                ...panelStyle,
                ...heroShellStyle,
              }}
            >
              <div
                style={{
                  position: "relative",
                  display: "grid",
                  gap: "20px",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  alignItems: "start",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gap: "18px",
                    padding: "22px",
                    borderRadius: "24px",
                    background: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 55%, #0f766e 100%)",
                    color: "#f8fafc",
                    boxShadow: "0 24px 48px rgba(15, 23, 42, 0.18)",
                  }}
                >
                  <div style={sectionBadgeStyle}>{introEyebrow}</div>
                  <div style={{ display: "grid", gap: "10px" }}>
                    <div style={{ fontSize: "clamp(30px, 5vw, 44px)", fontWeight: 900, lineHeight: 1.02 }}>
                      {labels.pinTitle}
                    </div>
                    <div style={{ maxWidth: "54ch", color: "rgba(226, 232, 240, 0.9)", lineHeight: 1.75 }}>
                      {labels.pinSubtitle}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gap: "12px",
                      gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                    }}
                  >
                    <div
                      style={{
                        borderRadius: "18px",
                        padding: "16px",
                        background: "rgba(255,255,255,0.1)",
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}
                    >
                      <div style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(226,232,240,0.72)" }}>
                        {labels.pinLabel}
                      </div>
                      <div style={{ marginTop: "8px", fontSize: "26px", fontWeight: 900, letterSpacing: "0.18em" }}>
                        ...... 
                      </div>
                    </div>
                    <div
                      style={{
                        borderRadius: "18px",
                        padding: "16px",
                        background: "rgba(255,255,255,0.1)",
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}
                    >
                      <div style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(226,232,240,0.72)" }}>
                        {labels.pinQuizQuestions}
                      </div>
                      <div style={{ marginTop: "8px", fontSize: "26px", fontWeight: 900 }}>15</div>
                    </div>
                  </div>
                  <div
                    style={{
                      borderRadius: "18px",
                      background: "rgba(255,255,255,0.1)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      padding: "16px",
                      color: "rgba(226, 232, 240, 0.9)",
                      lineHeight: 1.7,
                    }}
                  >
                    {labels.pinHint}
                  </div>
                </div>

                <div style={frostPanelStyle}
                >
                  <div style={{ display: "grid", gap: "6px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>
                      {labels.pinLabel}
                    </div>
                    <div style={{ fontSize: "28px", fontWeight: 900, lineHeight: 1.08, color: "#0f172a" }}>
                      {labels.pinTitle}
                    </div>
                    <div style={{ color: "#475569", lineHeight: 1.7 }}>
                      {labels.pinSubtitle}
                    </div>
                  </div>

                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void validatePin();
                    }}
                    style={{ display: "grid", gap: "14px" }}
                  >
                    <label style={{ display: "grid", gap: "8px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#475569" }}>{labels.pinLabel}</span>
                      <input
                        value={enteredPin}
                        onChange={(event) => {
                          setEnteredPin(event.target.value.replace(/\D/g, "").slice(0, 6));
                          if (pinError) setPinError("");
                        }}
                        inputMode="numeric"
                        placeholder={labels.pinPlaceholder}
                        disabled={isPinChecking}
                        style={{
                          width: "100%",
                          borderRadius: "20px",
                          border: pinError
                            ? "1px solid rgba(220, 38, 38, 0.35)"
                            : "1px solid rgba(148, 163, 184, 0.3)",
                          background: "rgba(255,255,255,0.9)",
                          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
                          padding: "18px 16px",
                          fontSize: "28px",
                          fontWeight: 900,
                          letterSpacing: "0.28em",
                          textAlign: "center",
                          boxSizing: "border-box",
                          outline: "none",
                          color: "#0f172a",
                        }}
                      />
                    </label>

                    {pinError ? (
                      <div style={{ color: "#b91c1c", fontSize: "14px", fontWeight: 700 }}>{pinError}</div>
                    ) : null}

                    <div
                      style={{
                        borderRadius: "18px",
                        background: "rgba(15, 23, 42, 0.04)",
                        padding: "14px 16px",
                        color: "#334155",
                        lineHeight: 1.7,
                      }}
                    >
                      {isPinChecking ? labels.pinLoading : labels.pinHint}
                    </div>

                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      <button
                        type="submit"
                        className="ds-btn ds-btn--primary ds-btn--md"
                        disabled={enteredPin.length !== 6 || isPinChecking}
                      >
                        {labels.pinContinue}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </section>
          ) : null}

          {phase === "name" ? (
            <section
              style={{
                ...panelStyle,
                ...heroShellStyle,
              }}
            >
              <div
                style={{
                  position: "relative",
                  display: "grid",
                  gap: "20px",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  alignItems: "start",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gap: "18px",
                    padding: "22px",
                    borderRadius: "24px",
                    background: "linear-gradient(135deg, #0f172a 0%, #0f4c81 50%, #0f766e 100%)",
                    color: "#f8fafc",
                    boxShadow: "0 24px 48px rgba(15, 23, 42, 0.18)",
                  }}
                >
                  <div style={sectionBadgeStyle}>{labels.pinQuizTitle}</div>
                  <div style={{ display: "grid", gap: "10px" }}>
                    <div style={{ fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 900, lineHeight: 1.04 }}>
                      {labels.nameTitle}
                    </div>
                    <div style={{ maxWidth: "54ch", color: "rgba(226, 232, 240, 0.9)", lineHeight: 1.75 }}>
                      {labels.nameSubtitle}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gap: "12px",
                      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                    }}
                  >
                    <div
                      style={{
                        borderRadius: "18px",
                        padding: "16px",
                        background: "rgba(255,255,255,0.1)",
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}
                    >
                      <div style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(226,232,240,0.72)" }}>{labels.pinQuizTitle}</div>
                      <div style={{ marginTop: "8px", fontSize: "18px", fontWeight: 800, lineHeight: 1.35 }}>{quizTitle}</div>
                    </div>
                    <div
                      style={{
                        borderRadius: "18px",
                        padding: "16px",
                        background: "rgba(255,255,255,0.1)",
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}
                    >
                      <div style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(226,232,240,0.72)" }}>{labels.pinQuizQuestions}</div>
                      <div style={{ marginTop: "8px", fontSize: "28px", fontWeight: 900 }}>{quizQuestionCount}</div>
                    </div>
                    <div
                      style={{
                        borderRadius: "18px",
                        padding: "16px",
                        background: "rgba(255,255,255,0.1)",
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}
                    >
                      <div style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(226,232,240,0.72)" }}>{labels.pinQuizTimer}</div>
                      <div style={{ marginTop: "8px", fontSize: "28px", fontWeight: 900 }}>{quizTimer}s</div>
                    </div>
                  </div>
                  <div
                    style={{
                      borderRadius: "18px",
                      background: "rgba(255,255,255,0.1)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      padding: "16px",
                      color: "rgba(226, 232, 240, 0.9)",
                      lineHeight: 1.7,
                    }}
                  >
                    <strong>{labels.pinQuizDescription}: </strong>
                    {quizDescription}
                  </div>
                </div>

                <div style={frostPanelStyle}>
                  <div style={{ display: "grid", gap: "6px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>
                      {labels.joinedPlayer}
                    </div>
                    <div style={{ fontSize: "28px", fontWeight: 900, lineHeight: 1.08, color: "#0f172a" }}>
                      {labels.nameTitle}
                    </div>
                    <div style={{ color: "#475569", lineHeight: 1.7 }}>
                      {labels.nameSubtitle}
                    </div>
                  </div>

                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void joinGame();
                    }}
                    style={{ display: "grid", gap: "14px" }}
                  >
                    <label style={{ display: "grid", gap: "8px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#475569" }}>{labels.nameLabel}</span>
                      <input
                        value={playerName}
                        onChange={(event) => {
                          setPlayerName(event.target.value.slice(0, 40));
                          if (nameError) setNameError("");
                        }}
                        placeholder={labels.namePlaceholder}
                        disabled={isJoining}
                        style={{
                          width: "100%",
                          borderRadius: "20px",
                          border: nameError
                            ? "1px solid rgba(220, 38, 38, 0.35)"
                            : "1px solid rgba(148, 163, 184, 0.3)",
                          background: "rgba(255,255,255,0.92)",
                          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
                          padding: "18px 16px",
                          fontSize: "20px",
                          fontWeight: 700,
                          boxSizing: "border-box",
                          outline: "none",
                          color: "#0f172a",
                        }}
                      />
                    </label>

                    {nameError ? (
                      <div style={{ color: "#b91c1c", fontSize: "14px", fontWeight: 700 }}>{nameError}</div>
                    ) : null}

                    <div
                      style={{
                        borderRadius: "18px",
                        background: "rgba(15, 23, 42, 0.04)",
                        padding: "14px 16px",
                        color: "#334155",
                        lineHeight: 1.7,
                      }}
                    >
                      <strong style={{ color: "#0f172a" }}>{labels.pinLabel}:</strong> {currentPin}
                      <br />
                      <strong style={{ color: "#0f172a" }}>{labels.pinQuizTitle}:</strong> {quizTitle}
                    </div>

                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      <button
                        type="submit"
                        className="ds-btn ds-btn--primary ds-btn--md"
                        disabled={!playerName.trim() || isJoining}
                      >
                        {isJoining ? labels.nameLoading : labels.nameJoin}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </section>
          ) : null}

          {phase === "intro" ? (
            <section
              style={{
                ...panelStyle,
                position: "relative",
                overflow: "hidden",
                background:
                  "radial-gradient(circle at top left, rgba(20, 184, 166, 0.12) 0%, rgba(255,255,255,0) 34%), radial-gradient(circle at top right, rgba(59, 130, 246, 0.14) 0%, rgba(255,255,255,0) 38%), linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,247,255,0.96) 100%)",
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: "auto -80px -80px auto",
                  width: "240px",
                  height: "240px",
                  borderRadius: "999px",
                  background: "radial-gradient(circle, rgba(37, 99, 235, 0.14) 0%, rgba(37, 99, 235, 0) 70%)",
                  pointerEvents: "none",
                }}
              />
              <div style={{ display: "grid", gap: "18px", position: "relative" }}>
                <div
                  style={{
                    display: "grid",
                    gap: "18px",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    alignItems: "stretch",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gap: "18px",
                      padding: "22px",
                      borderRadius: "24px",
                      background: "linear-gradient(135deg, #0f172a 0%, #155e75 52%, #0f766e 100%)",
                      color: "#f8fafc",
                      boxShadow: "0 24px 48px rgba(15, 23, 42, 0.18)",
                    }}
                  >
                    <div
                      style={{
                        display: "inline-flex",
                        width: "fit-content",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 12px",
                        borderRadius: "999px",
                        background: "rgba(255,255,255,0.12)",
                        fontSize: "12px",
                        fontWeight: 800,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "999px",
                          background: realtimeTone.dot,
                          boxShadow: `0 0 0 6px ${realtimeTone.background}`,
                        }}
                      />
                      {introEyebrow}
                    </div>

                    <div style={{ display: "grid", gap: "10px" }}>
                      <div style={{ fontSize: "clamp(30px, 5vw, 44px)", fontWeight: 900, lineHeight: 1.02 }}>
                        {labels.joinedTitle}
                      </div>
                      <div style={{ maxWidth: "54ch", color: "rgba(226, 232, 240, 0.92)", lineHeight: 1.7 }}>
                        {labels.joinedSubtitle}
                      </div>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          borderRadius: "999px",
                          background: "rgba(255,255,255,0.1)",
                          padding: "10px 14px",
                          fontSize: "13px",
                          fontWeight: 700,
                        }}
                      >
                        <span style={{ color: "rgba(226, 232, 240, 0.75)" }}>{labels.pinLabel}</span>
                        <span style={{ letterSpacing: "0.16em", fontWeight: 900 }}>{currentPin}</span>
                      </div>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          borderRadius: "999px",
                          background: "rgba(255,255,255,0.1)",
                          padding: "10px 14px",
                          fontSize: "13px",
                          fontWeight: 700,
                        }}
                      >
                        <span style={{ color: "rgba(226, 232, 240, 0.75)" }}>{labels.joinedPhase}</span>
                        <span>{joinedPhaseLabel}</span>
                      </div>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          borderRadius: "999px",
                          background: "rgba(255,255,255,0.1)",
                          padding: "10px 14px",
                          fontSize: "13px",
                          fontWeight: 700,
                        }}
                      >
                        <span style={{ color: "rgba(226, 232, 240, 0.75)" }}>{labels.joinedRealtime}</span>
                        <span>{getRealtimeLabel(streamState)}</span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: "12px",
                        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                      }}
                    >
                      <div
                        style={{
                          borderRadius: "18px",
                          padding: "16px",
                          background: "rgba(255,255,255,0.09)",
                          border: "1px solid rgba(255,255,255,0.12)",
                        }}
                      >
                        <div style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(226, 232, 240, 0.72)" }}>
                          {labels.joinedPlayers}
                        </div>
                        <div style={{ marginTop: "8px", fontSize: "28px", fontWeight: 900 }}>{playersCount}</div>
                      </div>
                      <div
                        style={{
                          borderRadius: "18px",
                          padding: "16px",
                          background: "rgba(255,255,255,0.09)",
                          border: "1px solid rgba(255,255,255,0.12)",
                        }}
                      >
                        <div style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(226, 232, 240, 0.72)" }}>
                          {labels.pinQuizQuestions}
                        </div>
                        <div style={{ marginTop: "8px", fontSize: "28px", fontWeight: 900 }}>{quizQuestionCount}</div>
                      </div>
                      <div
                        style={{
                          borderRadius: "18px",
                          padding: "16px",
                          background: "rgba(255,255,255,0.09)",
                          border: "1px solid rgba(255,255,255,0.12)",
                        }}
                      >
                        <div style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(226, 232, 240, 0.72)" }}>
                          {labels.pinQuizTimer}
                        </div>
                        <div style={{ marginTop: "8px", fontSize: "28px", fontWeight: 900 }}>{quizTimer}s</div>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: "14px",
                      padding: "20px",
                      borderRadius: "24px",
                      background: "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(239,246,255,0.9) 100%)",
                      border: "1px solid rgba(191, 219, 254, 0.7)",
                      boxShadow: "0 20px 42px rgba(37, 99, 235, 0.12)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                      <div
                        style={{
                          width: "64px",
                          height: "64px",
                          flexShrink: 0,
                          borderRadius: "20px",
                          display: "grid",
                          placeItems: "center",
                          background: "linear-gradient(135deg, #1d4ed8 0%, #14b8a6 100%)",
                          color: "#fff",
                          fontSize: "28px",
                          fontWeight: 900,
                          boxShadow: "0 16px 30px rgba(37, 99, 235, 0.22)",
                        }}
                      >
                        {playerInitial}
                      </div>
                      <div style={{ minWidth: 0, display: "grid", gap: "4px" }}>
                        <div style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>
                          {labels.joinedPlayer}
                        </div>
                        <div style={{ fontSize: "28px", fontWeight: 900, lineHeight: 1.05, color: "#0f172a", wordBreak: "break-word" }}>
                          {playerIdentity}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "inline-flex",
                        width: "fit-content",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 12px",
                        borderRadius: "999px",
                        ...joinedPhaseTone,
                        fontSize: "13px",
                        fontWeight: 800,
                      }}
                    >
                      {joinedPhaseLabel}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: "12px",
                        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                      }}
                    >
                      <div
                        style={{
                          borderRadius: "18px",
                          padding: "14px",
                          background: "rgba(255,255,255,0.82)",
                          border: "1px solid rgba(148, 163, 184, 0.2)",
                        }}
                      >
                        <div style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b" }}>
                          {labels.joinedStatus}
                        </div>
                        <div style={{ marginTop: "8px", fontSize: "15px", fontWeight: 800, lineHeight: 1.4, color: "#1e293b" }}>
                          {joinedReconnected ? labels.joinedReconnectTrue : labels.joinedReconnectFalse}
                        </div>
                      </div>
                      <div
                        style={{
                          borderRadius: "18px",
                          padding: "14px",
                          background: realtimeTone.background,
                          border: realtimeTone.border,
                        }}
                      >
                        <div style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b" }}>
                          {labels.joinedRealtime}
                        </div>
                        <div style={{ marginTop: "8px", fontSize: "17px", fontWeight: 900, color: realtimeTone.color }}>
                          {getRealtimeLabel(streamState)}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        borderRadius: "18px",
                        padding: "16px",
                        background: "rgba(15, 23, 42, 0.04)",
                        border: "1px solid rgba(148, 163, 184, 0.16)",
                        color: "#334155",
                        lineHeight: 1.7,
                      }}
                    >
                      <strong style={{ color: "#0f172a" }}>{playerIdentity}</strong>: {joinedMessage}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: "12px",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  }}
                >
                  <div
                    style={{
                      borderRadius: "20px",
                      padding: "18px",
                      background: "rgba(255,255,255,0.88)",
                      border: "1px solid rgba(148, 163, 184, 0.18)",
                      boxShadow: "0 12px 28px rgba(15, 23, 42, 0.06)",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>
                      {labels.pinQuizTitle}
                    </div>
                    <div style={{ marginTop: "10px", fontSize: "21px", fontWeight: 900, lineHeight: 1.2, color: "#0f172a" }}>
                      {quizTitle}
                    </div>
                  </div>
                  <div
                    style={{
                      borderRadius: "20px",
                      padding: "18px",
                      background: "rgba(255,255,255,0.88)",
                      border: "1px solid rgba(148, 163, 184, 0.18)",
                      boxShadow: "0 12px 28px rgba(15, 23, 42, 0.06)",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>
                      {labels.joinedPhase}
                    </div>
                    <div style={{ marginTop: "10px", fontSize: "21px", fontWeight: 900, lineHeight: 1.2, color: joinedPhaseTone.color }}>
                      {joinedPhaseLabel}
                    </div>
                  </div>
                  <div
                    style={{
                      borderRadius: "20px",
                      padding: "18px",
                      background: "rgba(255,255,255,0.88)",
                      border: "1px solid rgba(148, 163, 184, 0.18)",
                      boxShadow: "0 12px 28px rgba(15, 23, 42, 0.06)",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>
                      {labels.joinedPlayers}
                    </div>
                    <div style={{ marginTop: "10px", fontSize: "30px", fontWeight: 900, lineHeight: 1, color: "#0f172a" }}>
                      {playersCount}
                    </div>
                  </div>
                  <div
                    style={{
                      borderRadius: "20px",
                      padding: "18px",
                      background: "rgba(255,255,255,0.88)",
                      border: "1px solid rgba(148, 163, 184, 0.18)",
                      boxShadow: "0 12px 28px rgba(15, 23, 42, 0.06)",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>
                      {labels.joinedRealtime}
                    </div>
                    <div style={{ marginTop: "10px", fontSize: "21px", fontWeight: 900, lineHeight: 1.2, color: realtimeTone.color }}>
                      {getRealtimeLabel(streamState)}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: "12px",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  }}
                >
                  <div
                    style={{
                      borderRadius: "20px",
                      padding: "18px",
                      background: "linear-gradient(180deg, rgba(248,250,252,0.96) 0%, rgba(241,245,249,0.92) 100%)",
                      border: "1px solid rgba(148, 163, 184, 0.18)",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>
                      {labels.pinQuizDescription}
                    </div>
                    <div style={{ marginTop: "10px", color: "#334155", lineHeight: 1.7 }}>
                      {quizDescription}
                    </div>
                  </div>

                  <div
                    style={{
                      borderRadius: "20px",
                      padding: "18px",
                      background: "linear-gradient(180deg, rgba(248,250,252,0.96) 0%, rgba(241,245,249,0.92) 100%)",
                      border: "1px solid rgba(148, 163, 184, 0.18)",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>
                      {labels.joinedRealtime}
                    </div>
                    <div style={{ marginTop: "10px", color: "#334155", lineHeight: 1.7 }}>
                      {streamUrl
                        ? `${labels.joinedRealtime}: ${getRealtimeLabel(streamState)}.`
                        : labels.joinedWaiting}
                      {lastPingAt ? ` ${labels.joinedLastPing}: ${lastPingAt}.` : ""}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {phase === "playing" ? (
            <section
              style={{
                ...panelStyle,
                ...heroShellStyle,
              }}
            >
              <div style={{ display: "grid", gap: "18px", position: "relative" }}>
                <div
                  style={{
                    display: "grid",
                    gap: "16px",
                    padding: "22px",
                    borderRadius: "24px",
                    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #0f766e 100%)",
                    color: "#f8fafc",
                    boxShadow: "0 24px 48px rgba(15, 23, 42, 0.18)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      justifyContent: "space-between",
                      gap: "12px",
                      alignItems: "center",
                    }}
                  >
                    <div style={sectionBadgeStyle}>
                      {labels.question} {currentIndex + 1} / {totalQuestions}
                    </div>
                    <div
                      style={{
                        minWidth: "122px",
                        borderRadius: "18px",
                        background: timeLeft <= 5 ? "rgba(254, 226, 226, 0.14)" : "rgba(255,255,255,0.1)",
                        border: timeLeft <= 5 ? "1px solid rgba(248, 113, 113, 0.28)" : "1px solid rgba(255,255,255,0.12)",
                        color: timeLeft <= 5 ? "#fecaca" : "#f8fafc",
                        padding: "14px 16px",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.8 }}>
                        {labels.timer}
                      </div>
                      <div style={{ fontSize: "30px", fontWeight: 900, marginTop: "4px" }}>{timeLeft}s</div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: "10px" }}>
                    <div style={{ fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 900, lineHeight: 1.08 }}>
                      {currentQuestion.prompt}
                    </div>
                    <div style={{ color: "rgba(226, 232, 240, 0.88)", lineHeight: 1.7 }}>
                      {revealed
                        ? currentQuestion.explanation
                        : selectedId
                        ? `${labels.yourAnswer}: ${findChoiceText(currentQuestion, selectedId, labels.unanswered)}`
                        : `${labels.score}: ${currentPlayerScore}`}
                    </div>
                  </div>

                </div>

                <div
                  style={{
                    height: "8px",
                    width: "100%",
                    overflow: "hidden",
                    borderRadius: "999px",
                    background: "rgba(148, 163, 184, 0.22)",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(timeLeft / activeTimePerQuestion) * 100}%`,
                      borderRadius: "999px",
                      background: "linear-gradient(90deg, #14b8a6 0%, #2563eb 100%)",
                      transition: "width 300ms ease",
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: "12px",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  }}
                >
                  {currentQuestion.choices.map((choice, index) => {
                    const isSelected = selectedId === choice.id;
                    const isCorrect = choice.id === currentQuestion.correctAnswerId;
                    const isIncorrectReveal = revealed && isSelected && !isCorrect;
                    const isCorrectReveal = revealed && isCorrect;

                    return (
                      <button
                        key={choice.id}
                        type="button"
                        onClick={() => {
                          if (!revealed && !isCurrentQuestionSubmitting && !isCurrentQuestionLocked) {
                            setSelectedId(choice.id);
                            setSelectedAtRemainingSec(timeLeft);
                          }
                        }}
                        style={{
                          ...answerButtonBase,
                          background: answerPalette[index % answerPalette.length],
                          opacity: revealed && !isSelected && !isCorrect ? 0.72 : 1,
                          border: isSelected ? "2px solid rgba(255, 255, 255, 0.85)" : "2px solid rgba(255, 255, 255, 0.18)",
                          boxShadow: isCorrectReveal
                            ? "0 0 0 3px rgba(34, 197, 94, 0.8)"
                            : isIncorrectReveal
                            ? "0 0 0 3px rgba(255, 255, 255, 0.65)"
                            : "0 18px 30px rgba(15, 23, 42, 0.12)",
                          transform: isSelected ? "translateY(-2px)" : "translateY(0)",
                        }}
                        disabled={revealed || isCurrentQuestionSubmitting || isCurrentQuestionLocked}
                      >
                        <span style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.04em" }}>
                          {choice.label}
                        </span>
                        <span style={{ fontSize: "18px", fontWeight: 700, lineHeight: 1.35 }}>
                          {choice.text}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    gap: "12px",
                    alignItems: "center",
                  }}
                >
                  <div style={{ color: "#475569", lineHeight: 1.6 }}>{revealed ? labels.correctAnswer : labels.submit}</div>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", minHeight: "40px" }}>
                    {!revealed && selectedId ? (
                      <button
                        type="button"
                        className="ds-btn ds-btn--secondary ds-btn--md"
                        onClick={() => {
                          void advanceSelectedAnswer();
                        }}
                        disabled={isCurrentQuestionSubmitting}
                      >
                        {isCurrentQuestionSubmitting ? labels.answerSending : labels.submit}
                      </button>
                    ) : !revealed ? (
                      <button
                        type="button"
                        className="ds-btn ds-btn--secondary ds-btn--md"
                        onClick={() => {
                          void advanceSelectedAnswer();
                        }}
                        disabled={isCurrentQuestionSubmitting}
                      >
                        {labels.next}
                      </button>
                    ) : null}
                  </div>
                </div>
                {playApiError ? (
                  <div style={{ color: "#b91c1c", fontSize: "14px", fontWeight: 700 }}>{playApiError}</div>
                ) : null}
              </div>
            </section>
          ) : null}

          {phase === "playing" ? (
            <section
              style={{
                ...panelStyle,
                display: "grid",
                gap: "12px",
                background: "linear-gradient(180deg, rgba(248,250,252,0.96) 0%, rgba(241,245,249,0.92) 100%)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gap: "12px",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                }}
              >
                <div
                  style={{
                    borderRadius: "18px",
                    padding: "16px",
                    background: "rgba(37, 99, 235, 0.08)",
                    border: "1px solid rgba(59, 130, 246, 0.14)",
                  }}
                >
                  <div style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b" }}>
                    {labels.score}
                  </div>
                  <div style={{ marginTop: "8px", fontSize: "28px", fontWeight: 900, color: "#0f172a" }}>{currentPlayerScore}</div>
                </div>
                <div
                  style={{
                    borderRadius: "18px",
                    padding: "16px",
                    background: "rgba(14, 165, 233, 0.08)",
                    border: "1px solid rgba(14, 165, 233, 0.14)",
                  }}
                >
                  <div style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b" }}>
                    {labels.pinQuizTimer}
                  </div>
                  <div style={{ marginTop: "8px", fontSize: "28px", fontWeight: 900, color: "#0f172a" }}>{activeTimePerQuestion}s</div>
                </div>
                <div
                  style={{
                    borderRadius: "18px",
                    padding: "16px",
                    background: "rgba(20, 184, 166, 0.08)",
                    border: "1px solid rgba(20, 184, 166, 0.14)",
                  }}
                >
                  <div style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b" }}>
                    {labels.joinedRealtime}
                  </div>
                  <div style={{ marginTop: "8px", fontSize: "22px", fontWeight: 900, color: "#0f172a" }}>{getRealtimeLabel(streamState)}</div>
                </div>
              </div>
            </section>
          ) : null}

          {phase === "playing" && revealed && latestAnswer ? (
            <section
              style={{
                ...panelStyle,
                display: "grid",
                gap: "10px",
                borderRadius: "20px",
                background:
                  latestAnswer.selectedId === null
                    ? "linear-gradient(180deg, rgba(255,251,235,0.96) 0%, rgba(254,243,199,0.88) 100%)"
                    : latestAnswer.isCorrect
                    ? "linear-gradient(180deg, rgba(236,253,245,0.96) 0%, rgba(209,250,229,0.9) 100%)"
                    : "linear-gradient(180deg, rgba(254,242,242,0.96) 0%, rgba(254,226,226,0.9) 100%)",
                border:
                  latestAnswer.selectedId === null
                    ? "1px solid rgba(245, 158, 11, 0.22)"
                    : latestAnswer.isCorrect
                    ? "1px solid rgba(34, 197, 94, 0.22)"
                    : "1px solid rgba(248, 113, 113, 0.22)",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  width: "fit-content",
                  alignItems: "center",
                  borderRadius: "999px",
                  padding: "7px 12px",
                  fontSize: "11px",
                  fontWeight: 800,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  background:
                    latestAnswer.selectedId === null
                      ? "rgba(245, 158, 11, 0.14)"
                      : latestAnswer.isCorrect
                      ? "rgba(22, 163, 74, 0.12)"
                      : "rgba(220, 38, 38, 0.12)",
                  color:
                    latestAnswer.selectedId === null
                      ? "#b45309"
                      : latestAnswer.isCorrect
                      ? "#166534"
                      : "#b91c1c",
                }}
              >
                {labels.yourResultLabel}
              </div>
              <div
                style={{
                  display: "grid",
                  gap: "6px",
                }}
              >
                <div style={{ fontSize: "24px", fontWeight: 900, color: "#0f172a" }}>
                  {latestAnswer.selectedId === null
                    ? labels.timeoutState
                    : latestAnswer.isCorrect
                    ? labels.correctState
                    : labels.incorrectState}
                </div>
                <div style={{ color: "#334155", lineHeight: 1.7 }}>
                  {labels.correctAnswer}:{" "}
                  {findChoiceText(currentQuestion, currentQuestion.correctAnswerId, labels.unanswered)}
                </div>
                <div style={{ color: "#334155", lineHeight: 1.7 }}>
                  {labels.yourAnswer}:{" "}
                  {findChoiceText(currentQuestion, latestAnswer.selectedId, labels.unanswered)}
                </div>
              </div>
            </section>
          ) : null}

          {phase === "finished" ? (
            <section style={stackStyle}>
              <section style={panelStyle}>
                <div style={{ display: "grid", gap: "14px" }}>
                  <div
                    style={{
                      borderRadius: "clamp(20px, 4vw, 24px)",
                      overflow: "hidden",
                      background:
                        "radial-gradient(circle at top left, rgba(251, 191, 36, 0.28), transparent 28%), linear-gradient(135deg, #0f172a 0%, #164e63 45%, #0f766e 100%)",
                      color: "#f8fafc",
                      padding: "clamp(18px, 4vw, 24px)",
                      display: "grid",
                      gap: "clamp(14px, 3vw, 18px)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                      }}
                    >
                      <div style={{ display: "grid", gap: "8px" }}>
                        <div style={{ fontSize: "clamp(30px, 8vw, 42px)", fontWeight: 900, lineHeight: 1 }}>
                          {labels.leaderboardTitle}
                        </div>
                      </div>
                      <div
                        style={{
                          borderRadius: "999px",
                          border: "1px solid rgba(255,255,255,0.18)",
                          background: "rgba(255,255,255,0.12)",
                          padding: "10px 14px",
                          fontSize: "11px",
                          fontWeight: 800,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          justifySelf: "start",
                        }}
                      >
                        {labels.sessionCompleted}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: "10px",
                        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                      }}
                    >
                      <div
                        style={{
                          borderRadius: "18px",
                          background: "rgba(255,255,255,0.08)",
                          border: "1px solid rgba(255,255,255,0.14)",
                          padding: "14px 14px 16px",
                          display: "grid",
                          gap: "6px",
                          minHeight: "112px",
                        }}
                      >
                        <div style={{ fontSize: "11px", color: "rgba(226, 232, 240, 0.78)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                          {labels.yourScoreLabel}
                        </div>
                        <div style={{ fontSize: "clamp(22px, 6.4vw, 30px)", fontWeight: 900, lineHeight: 1.05 }}>
                          {currentPlayerScore}
                          <span style={{ display: "block", fontSize: "clamp(13px, 3.4vw, 16px)", color: "rgba(226, 232, 240, 0.82)", marginTop: "6px" }}>
                            / {maxScore}
                          </span>
                        </div>
                      </div>
                      <div
                        style={{
                          borderRadius: "18px",
                          background: "rgba(255,255,255,0.08)",
                          border: "1px solid rgba(255,255,255,0.14)",
                          padding: "14px 14px 16px",
                          display: "grid",
                          gap: "6px",
                          minHeight: "112px",
                        }}
                      >
                        <div style={{ fontSize: "11px", color: "rgba(226, 232, 240, 0.78)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                          {labels.rankLabel}
                        </div>
                        <div style={{ fontSize: "clamp(22px, 6.4vw, 30px)", fontWeight: 900, lineHeight: 1.05 }}>
                          {currentPlayerRank ? `#${currentPlayerRank}` : "-"}
                        </div>
                      </div>
                      <div
                        style={{
                          borderRadius: "18px",
                          background: "rgba(255,255,255,0.08)",
                          border: "1px solid rgba(255,255,255,0.14)",
                          padding: "14px 14px 16px",
                          display: "grid",
                          gap: "6px",
                          minHeight: "112px",
                        }}
                      >
                        <div style={{ fontSize: "11px", color: "rgba(226, 232, 240, 0.78)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                          {labels.performanceLabel}
                        </div>
                        <div style={{ fontSize: "clamp(22px, 6.4vw, 30px)", fontWeight: 900, lineHeight: 1.05 }}>
                          {accuracy}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {isLeaderboardLoading ? (
                    <div style={{ color: "#475569" }}>{labels.leaderboardLoading}</div>
                  ) : null}
                  {leaderboardError ? (
                    <div style={{ color: "#b91c1c", fontWeight: 700 }}>{leaderboardError}</div>
                  ) : null}

                  {currentPlayerBoardEntry ? (
                    <div
                      style={{
                        borderRadius: "20px",
                        border: "1px solid rgba(8, 145, 178, 0.18)",
                        background:
                          "linear-gradient(135deg, rgba(236, 254, 255, 0.95) 0%, rgba(224, 242, 254, 0.86) 100%)",
                        padding: "clamp(16px, 3.6vw, 20px)",
                        display: "grid",
                        gap: "12px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                        }}
                      >
                        <div style={{ display: "grid", gap: "6px" }}>
                          <div style={{ fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 800, color: "#0f766e" }}>
                            {labels.yourResultLabel}
                          </div>
                          <div style={{ fontSize: "clamp(22px, 5.5vw, 24px)", fontWeight: 900, color: "#0f172a", lineHeight: 1.1 }}>
                            {currentPlayerBoardEntry.name ?? (playerName || "You")}
                          </div>
                        </div>
                        <div
                          style={{
                            borderRadius: "999px",
                            background: "#0f172a",
                            color: "#f8fafc",
                            padding: "8px 12px",
                            fontSize: "12px",
                            fontWeight: 800,
                          }}
                        >
                          {currentPlayerRank ? `${labels.rankLabel} #${currentPlayerRank}` : labels.rankPendingLabel}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gap: "10px",
                          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                        }}
                      >
                        <div className="ds-card" style={{ padding: "12px 12px 14px", borderRadius: "16px" }}>
                          <div style={{ fontSize: "12px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                            {labels.score}
                          </div>
                          <div style={{ fontSize: "clamp(20px, 5.5vw, 24px)", fontWeight: 900 }}>{currentPlayerScore}</div>
                        </div>
                        <div className="ds-card" style={{ padding: "12px 12px 14px", borderRadius: "16px" }}>
                          <div style={{ fontSize: "12px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                            {labels.correctState}
                          </div>
                          <div style={{ fontSize: "clamp(20px, 5.5vw, 24px)", fontWeight: 900 }}>{currentPlayerCorrect}</div>
                        </div>
                        <div className="ds-card" style={{ padding: "12px 12px 14px", borderRadius: "16px" }}>
                          <div style={{ fontSize: "12px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                            {labels.question}
                          </div>
                          <div style={{ fontSize: "clamp(20px, 5.5vw, 24px)", fontWeight: 900 }}>{currentPlayerAnswersCount}</div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {podiumPlayers.length > 0 ? (
                    <div
                      style={{
                        display: "grid",
                        gap: "12px",
                        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                      }}
                    >
                      {podiumPlayers.map((player, index) => {
                        const accent =
                          index === 0
                            ? "linear-gradient(135deg, rgba(254, 240, 138, 0.95) 0%, rgba(251, 191, 36, 0.88) 100%)"
                            : index === 1
                            ? "linear-gradient(135deg, rgba(226, 232, 240, 0.96) 0%, rgba(148, 163, 184, 0.86) 100%)"
                            : "linear-gradient(135deg, rgba(253, 186, 116, 0.94) 0%, rgba(249, 115, 22, 0.82) 100%)";

                        return (
                          <article
                            key={player.id ?? player.playerId ?? `${player.name ?? "podium"}-${index}`}
                            style={{
                              borderRadius: "20px",
                              padding: "16px",
                              background: accent,
                              color: index === 1 ? "#0f172a" : "#111827",
                              display: "grid",
                              gap: "8px",
                              minHeight: "140px",
                              boxShadow: "0 18px 36px rgba(15, 23, 42, 0.10)",
                            }}
                          >
                            <div style={{ fontSize: "12px", fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.8 }}>
                              #{player.rank ?? index + 1}
                            </div>
                            <div style={{ fontSize: "clamp(22px, 5.8vw, 26px)", fontWeight: 900, lineHeight: 1.05 }}>
                              {player.name ?? "-"}
                            </div>
                            <div style={{ display: "grid", gap: "6px", marginTop: "auto" }}>
                              <div style={{ fontWeight: 700 }}>{labels.score}: {player.score ?? 0}</div>
                              <div style={{ opacity: 0.88 }}>{labels.correctState}: {player.correctAnswers ?? 0}</div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : null}

                  {leaderboard.length > 0 ? (
                    <div style={{ display: "grid", gap: "12px" }}>
                      {leaderboard.map((player, index) => (
                        <article
                          key={player.id ?? `${player.name ?? "player"}-${index}`}
                          style={{
                            borderRadius: "20px",
                            border:
                              player.playerId === joinedPlayer?.id || player.id === joinedPlayer?.id
                                ? "1px solid rgba(8, 145, 178, 0.26)"
                                : "1px solid rgba(148, 163, 184, 0.18)",
                            background:
                              player.playerId === joinedPlayer?.id || player.id === joinedPlayer?.id
                                ? "linear-gradient(135deg, rgba(236, 254, 255, 0.92) 0%, rgba(255,255,255,0.98) 100%)"
                                : "#fff",
                            padding: "16px 18px",
                            display: "grid",
                            gap: "10px",
                            boxShadow:
                              player.playerId === joinedPlayer?.id || player.id === joinedPlayer?.id
                                ? "0 14px 28px rgba(8, 145, 178, 0.08)"
                                : "none",
                          }}
                        >
                          <div
                            style={{
                              display: "grid",
                              gap: "10px",
                              gridTemplateColumns: "minmax(0, 1fr) auto",
                              alignItems: "center",
                            }}
                          >
                            <div style={{ display: "grid", gap: "6px" }}>
                              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px" }}>
                                <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 900, letterSpacing: "0.1em" }}>
                                  #{player.rank ?? index + 1}
                                </div>
                                {(player.playerId === joinedPlayer?.id || player.id === joinedPlayer?.id) ? (
                                  <div
                                    style={{
                                      borderRadius: "999px",
                                      background: "rgba(8, 145, 178, 0.12)",
                                      color: "#0f766e",
                                      padding: "4px 8px",
                                      fontSize: "11px",
                                      fontWeight: 800,
                                      textTransform: "uppercase",
                                      letterSpacing: "0.08em",
                                    }}
                                  >
                                    {labels.youLabel}
                                  </div>
                                ) : null}
                              </div>
                              <div style={{ fontSize: "20px", fontWeight: 800 }}>{player.name ?? "-"}</div>
                            </div>
                            <div style={{ fontSize: "24px", fontWeight: 900, color: "#0f172a" }}>
                              {player.score ?? 0}
                            </div>
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gap: "10px",
                              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                            }}
                          >
                            <div style={{ color: "#334155" }}>
                              <div style={{ fontSize: "12px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                {labels.score}
                              </div>
                              <div style={{ fontWeight: 800 }}>{player.score ?? 0}</div>
                            </div>
                            <div style={{ color: "#334155" }}>
                              <div style={{ fontSize: "12px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                {labels.correctState}
                              </div>
                              <div style={{ fontWeight: 800 }}>{player.correctAnswers ?? 0}</div>
                            </div>
                            <div style={{ color: "#334155" }}>
                              <div style={{ fontSize: "12px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                {labels.question}
                              </div>
                              <div style={{ fontWeight: 800 }}>{player.answersCount ?? 0}</div>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : !isLeaderboardLoading ? (
                    <div style={{ color: "#475569" }}>{labels.leaderboardEmpty}</div>
                  ) : null}
                </div>
              </section>
            </section>
          ) : null}
        </section>
      </section>
    </section>
  );
};
