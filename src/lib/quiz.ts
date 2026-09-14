import { AMINO_ACIDS, type AminoAcid } from '../data/aminoAcids';

export const QUIZ_MODES = [
  'structure-name',
  'structure-three',
  'structure-one',
  'name-three',
  'name-one',
  'three-name',
  'one-name',
  'mixed',
] as const;

export type QuizMode = (typeof QUIZ_MODES)[number];
export type ConcreteQuizMode = Exclude<QuizMode, 'mixed'>;

export interface QuizQuestion {
  acid: AminoAcid;
  mode: ConcreteQuizMode;
  options: AminoAcid[];
}

export const QUIZ_MODE_LABELS: Record<QuizMode, string> = {
  'structure-name': '구조 → 이름',
  'structure-three': '구조 → 3-letter',
  'structure-one': '구조 → 1-letter',
  'name-three': '이름 → 3-letter',
  'name-one': '이름 → 1-letter',
  'three-name': '3-letter → 이름',
  'one-name': '1-letter → 이름',
  mixed: '종합 랜덤',
};

const CONCRETE_MODES = QUIZ_MODES.filter((mode): mode is ConcreteQuizMode => mode !== 'mixed');

export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = result[index];
    result[index] = result[swapIndex] as T;
    result[swapIndex] = current as T;
  }
  return result;
}

export function createQuiz(
  mode: QuizMode,
  length: number,
  random: () => number = Math.random,
): QuizQuestion[] {
  return shuffle(AMINO_ACIDS, random)
    .slice(0, Math.min(length, AMINO_ACIDS.length))
    .map((acid) => {
      const concreteMode =
        mode === 'mixed'
          ? (CONCRETE_MODES[Math.floor(random() * CONCRETE_MODES.length)] as ConcreteQuizMode)
          : mode;
      const needsOptions = concreteMode === 'structure-name' || concreteMode.endsWith('-name');
      const distractors = shuffle(
        AMINO_ACIDS.filter((candidate) => candidate.id !== acid.id),
        random,
      ).slice(0, 3);
      return {
        acid,
        mode: concreteMode,
        options: needsOptions ? shuffle([acid, ...distractors], random) : [],
      };
    });
}

export function expectedAnswer(question: QuizQuestion): string {
  if (question.mode.endsWith('-name')) return question.acid.name;
  if (question.mode.endsWith('-three')) return question.acid.threeLetter;
  return question.acid.oneLetter;
}

export function normalizeAnswer(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

export function isCorrectAnswer(question: QuizQuestion, answer: string): boolean {
  return normalizeAnswer(answer) === normalizeAnswer(expectedAnswer(question));
}

