import { AMINO_ACIDS, type AminoAcid } from '../data/aminoAcids';
import { createFlashStructureChoices } from './flashcards';
import { shuffle } from './random';

export { shuffle } from './random';

export const QUIZ_MODES = [
  'structure-name',
  'structure-three',
  'structure-one',
  'name-structure',
  'name-three',
  'name-one',
  'three-name',
  'one-structure',
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
  'name-structure': '이름 → 구조',
  'name-three': '이름 → 3-letter',
  'name-one': '이름 → 1-letter',
  'three-name': '3-letter → 이름',
  'one-structure': '1-letter → 구조',
  'one-name': '1-letter → 이름',
  mixed: '종합 랜덤',
};

const CONCRETE_MODES = QUIZ_MODES.filter((mode): mode is ConcreteQuizMode => mode !== 'mixed');

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
      const options = concreteMode.endsWith('-structure')
        ? createFlashStructureChoices(acid, random)
        : concreteMode === 'structure-name' || concreteMode.endsWith('-name')
          ? shuffle([
              acid,
              ...shuffle(AMINO_ACIDS.filter((candidate) => candidate.id !== acid.id), random).slice(0, 3),
            ], random)
          : [];
      return { acid, mode: concreteMode, options };
    });
}

export function expectedAnswer(question: QuizQuestion): string {
  if (question.mode.endsWith('-structure')) return question.acid.id;
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

