export const formatTitle = (title: string) => title.trim();

export const calculateMaxScore = (questionCount: number, pointsPerCorrect: number) =>
  questionCount * pointsPerCorrect;

export const calculateAccuracy = (correctCount: number, questionCount: number) =>
  questionCount === 0 ? 0 : Math.round((correctCount / questionCount) * 100);

export const calculateTimedCorrectPoints = (
  remainingSec: number,
  pointsPerCorrect: number,
  timePerQuestionSec: number
) => {
  const clampedRemaining = Math.max(0, Math.min(timePerQuestionSec, Math.floor(remainingSec)));
  const penaltySteps = Math.max(0, timePerQuestionSec - 1 - clampedRemaining);
  return Math.max(pointsPerCorrect - penaltySteps * 5, 0);
};
