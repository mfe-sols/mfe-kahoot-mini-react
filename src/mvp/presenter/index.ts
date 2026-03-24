import type { AppModel } from "../model";
import { formatTitle } from "../usecase";
import { trKahootMini } from "../../i18n/domain-messages";

export type AppViewModel = {
  appName: string;
  title: string;
  subtitle: string;
  introEyebrow: string;
  introBody: string;
  questions: AppModel["questions"];
  timePerQuestionSec: number;
  pointsPerCorrect: number;
  labels: {
    pinTitle: string;
    pinSubtitle: string;
    pinLabel: string;
    pinPlaceholder: string;
    pinContinue: string;
    pinHint: string;
    pinError: string;
    pinLocked: string;
    pinLoading: string;
    pinUnavailable: string;
    pinQuizTitle: string;
    pinQuizDescription: string;
    pinQuizQuestions: string;
    pinQuizTimer: string;
    nameTitle: string;
    nameSubtitle: string;
    nameLabel: string;
    namePlaceholder: string;
    nameJoin: string;
    nameLoading: string;
    nameError: string;
    joinClosed: string;
    joinedTitle: string;
    joinedSubtitle: string;
    joinedPlayer: string;
    joinedStatus: string;
    joinedPhase: string;
    joinedPlayers: string;
    joinedRealtime: string;
    joinedLastPing: string;
    joinedPhaseLobbyLabel: string;
    joinedPhaseQuestionLiveLabel: string;
    joinedPhaseQuestionClosedLabel: string;
    joinedPhaseCompletedLabel: string;
    joinedReconnectTrue: string;
    joinedReconnectFalse: string;
    joinedLobby: string;
    joinedQuestionLive: string;
    joinedQuestionClosed: string;
    joinedCompleted: string;
    joinedWaiting: string;
    hostStart: string;
    hostStarting: string;
    hostNext: string;
    hostFinishing: string;
    answerSending: string;
    hostActionError: string;
    leaderboardTitle: string;
    leaderboardSubtitle: string;
    leaderboardLoading: string;
    leaderboardTopOne: string;
    leaderboardTopTwo: string;
    leaderboardEmpty: string;
    sessionCompleted: string;
    yourScoreLabel: string;
    rankLabel: string;
    performanceLabel: string;
    yourResultLabel: string;
    rankPendingLabel: string;
    youLabel: string;
    start: string;
    restart: string;
    submit: string;
    next: string;
    timer: string;
    question: string;
    score: string;
    correctAnswer: string;
    yourAnswer: string;
    unanswered: string;
    correctState: string;
    incorrectState: string;
    timeoutState: string;
    finalTitle: string;
    finalSubtitle: string;
    reviewTitle: string;
    badgePerfect: string;
    badgeSolid: string;
    badgeRetry: string;
  };
};

const toDomainKey = (commonKey: string) => `mfe.mfe-kahoot-mini-react.${commonKey}`;

export const createPresenter = (model: AppModel): AppViewModel => ({
  appName: model.appName,
  title: formatTitle(trKahootMini(toDomainKey("title"), "title")),
  subtitle: trKahootMini(toDomainKey("subtitle"), "subtitle"),
  introEyebrow: trKahootMini(toDomainKey("introEyebrow"), "introEyebrow"),
  introBody: trKahootMini(toDomainKey("introBody"), "introBody"),
  questions: model.questions,
  timePerQuestionSec: model.timePerQuestionSec,
  pointsPerCorrect: model.pointsPerCorrect,
  labels: {
    pinTitle: trKahootMini(toDomainKey("pinTitle"), "pinTitle"),
    pinSubtitle: trKahootMini(toDomainKey("pinSubtitle"), "pinSubtitle"),
    pinLabel: trKahootMini(toDomainKey("pinLabel"), "pinLabel"),
    pinPlaceholder: trKahootMini(toDomainKey("pinPlaceholder"), "pinPlaceholder"),
    pinContinue: trKahootMini(toDomainKey("pinContinue"), "pinContinue"),
    pinHint: trKahootMini(toDomainKey("pinHint"), "pinHint"),
    pinError: trKahootMini(toDomainKey("pinError"), "pinError"),
    pinLocked: trKahootMini(toDomainKey("pinLocked"), "pinLocked"),
    pinLoading: trKahootMini(toDomainKey("pinLoading"), "pinLoading"),
    pinUnavailable: trKahootMini(toDomainKey("pinUnavailable"), "pinUnavailable"),
    pinQuizTitle: trKahootMini(toDomainKey("pinQuizTitle"), "pinQuizTitle"),
    pinQuizDescription: trKahootMini(toDomainKey("pinQuizDescription"), "pinQuizDescription"),
    pinQuizQuestions: trKahootMini(toDomainKey("pinQuizQuestions"), "pinQuizQuestions"),
    pinQuizTimer: trKahootMini(toDomainKey("pinQuizTimer"), "pinQuizTimer"),
    nameTitle: trKahootMini(toDomainKey("nameTitle"), "nameTitle"),
    nameSubtitle: trKahootMini(toDomainKey("nameSubtitle"), "nameSubtitle"),
    nameLabel: trKahootMini(toDomainKey("nameLabel"), "nameLabel"),
    namePlaceholder: trKahootMini(toDomainKey("namePlaceholder"), "namePlaceholder"),
    nameJoin: trKahootMini(toDomainKey("nameJoin"), "nameJoin"),
    nameLoading: trKahootMini(toDomainKey("nameLoading"), "nameLoading"),
    nameError: trKahootMini(toDomainKey("nameError"), "nameError"),
    joinClosed: trKahootMini(toDomainKey("joinClosed"), "joinClosed"),
    joinedTitle: trKahootMini(toDomainKey("joinedTitle"), "joinedTitle"),
    joinedSubtitle: trKahootMini(toDomainKey("joinedSubtitle"), "joinedSubtitle"),
    joinedPlayer: trKahootMini(toDomainKey("joinedPlayer"), "joinedPlayer"),
    joinedStatus: trKahootMini(toDomainKey("joinedStatus"), "joinedStatus"),
    joinedPhase: trKahootMini(toDomainKey("joinedPhase"), "joinedPhase"),
    joinedPlayers: trKahootMini(toDomainKey("joinedPlayers"), "joinedPlayers"),
    joinedRealtime: trKahootMini(toDomainKey("joinedRealtime"), "joinedRealtime"),
    joinedLastPing: trKahootMini(toDomainKey("joinedLastPing"), "joinedLastPing"),
    joinedPhaseLobbyLabel: trKahootMini(toDomainKey("joinedPhaseLobbyLabel"), "joinedPhaseLobbyLabel"),
    joinedPhaseQuestionLiveLabel: trKahootMini(toDomainKey("joinedPhaseQuestionLiveLabel"), "joinedPhaseQuestionLiveLabel"),
    joinedPhaseQuestionClosedLabel: trKahootMini(toDomainKey("joinedPhaseQuestionClosedLabel"), "joinedPhaseQuestionClosedLabel"),
    joinedPhaseCompletedLabel: trKahootMini(toDomainKey("joinedPhaseCompletedLabel"), "joinedPhaseCompletedLabel"),
    joinedReconnectTrue: trKahootMini(toDomainKey("joinedReconnectTrue"), "joinedReconnectTrue"),
    joinedReconnectFalse: trKahootMini(toDomainKey("joinedReconnectFalse"), "joinedReconnectFalse"),
    joinedLobby: trKahootMini(toDomainKey("joinedLobby"), "joinedLobby"),
    joinedQuestionLive: trKahootMini(toDomainKey("joinedQuestionLive"), "joinedQuestionLive"),
    joinedQuestionClosed: trKahootMini(toDomainKey("joinedQuestionClosed"), "joinedQuestionClosed"),
    joinedCompleted: trKahootMini(toDomainKey("joinedCompleted"), "joinedCompleted"),
    joinedWaiting: trKahootMini(toDomainKey("joinedWaiting"), "joinedWaiting"),
    hostStart: trKahootMini(toDomainKey("hostStart"), "hostStart"),
    hostStarting: trKahootMini(toDomainKey("hostStarting"), "hostStarting"),
    hostNext: trKahootMini(toDomainKey("hostNext"), "hostNext"),
    hostFinishing: trKahootMini(toDomainKey("hostFinishing"), "hostFinishing"),
    answerSending: trKahootMini(toDomainKey("answerSending"), "answerSending"),
    hostActionError: trKahootMini(toDomainKey("hostActionError"), "hostActionError"),
    leaderboardTitle: trKahootMini(toDomainKey("leaderboardTitle"), "leaderboardTitle"),
    leaderboardSubtitle: trKahootMini(toDomainKey("leaderboardSubtitle"), "leaderboardSubtitle"),
    leaderboardLoading: trKahootMini(toDomainKey("leaderboardLoading"), "leaderboardLoading"),
    leaderboardTopOne: trKahootMini(toDomainKey("leaderboardTopOne"), "leaderboardTopOne"),
    leaderboardTopTwo: trKahootMini(toDomainKey("leaderboardTopTwo"), "leaderboardTopTwo"),
    leaderboardEmpty: trKahootMini(toDomainKey("leaderboardEmpty"), "leaderboardEmpty"),
    sessionCompleted: trKahootMini(toDomainKey("sessionCompleted"), "sessionCompleted"),
    yourScoreLabel: trKahootMini(toDomainKey("yourScoreLabel"), "yourScoreLabel"),
    rankLabel: trKahootMini(toDomainKey("rankLabel"), "rankLabel"),
    performanceLabel: trKahootMini(toDomainKey("performanceLabel"), "performanceLabel"),
    yourResultLabel: trKahootMini(toDomainKey("yourResultLabel"), "yourResultLabel"),
    rankPendingLabel: trKahootMini(toDomainKey("rankPendingLabel"), "rankPendingLabel"),
    youLabel: trKahootMini(toDomainKey("youLabel"), "youLabel"),
    start: trKahootMini(toDomainKey("start"), "start"),
    restart: trKahootMini(toDomainKey("restart"), "restart"),
    submit: trKahootMini(toDomainKey("submit"), "submit"),
    next: trKahootMini(toDomainKey("next"), "next"),
    timer: trKahootMini(toDomainKey("timer"), "timer"),
    question: trKahootMini(toDomainKey("question"), "question"),
    score: trKahootMini(toDomainKey("score"), "score"),
    correctAnswer: trKahootMini(toDomainKey("correctAnswer"), "correctAnswer"),
    yourAnswer: trKahootMini(toDomainKey("yourAnswer"), "yourAnswer"),
    unanswered: trKahootMini(toDomainKey("unanswered"), "unanswered"),
    correctState: trKahootMini(toDomainKey("correctState"), "correctState"),
    incorrectState: trKahootMini(toDomainKey("incorrectState"), "incorrectState"),
    timeoutState: trKahootMini(toDomainKey("timeoutState"), "timeoutState"),
    finalTitle: trKahootMini(toDomainKey("finalTitle"), "finalTitle"),
    finalSubtitle: trKahootMini(toDomainKey("finalSubtitle"), "finalSubtitle"),
    reviewTitle: trKahootMini(toDomainKey("reviewTitle"), "reviewTitle"),
    badgePerfect: trKahootMini(toDomainKey("badgePerfect"), "badgePerfect"),
    badgeSolid: trKahootMini(toDomainKey("badgeSolid"), "badgeSolid"),
    badgeRetry: trKahootMini(toDomainKey("badgeRetry"), "badgeRetry"),
  },
});
