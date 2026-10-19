import { describe, expect, it } from 'vitest';
import { AMINO_ACIDS } from '../data/aminoAcids';
import { createQuiz, isCorrectAnswer, QUIZ_MODES } from './quiz';

describe('quiz generation and answer normalization', () => {
  it('creates the requested number of unique amino-acid questions', () => {
    const questions = createQuiz('mixed', 10, () => 0.42);
    expect(questions).toHaveLength(10);
    expect(new Set(questions.map((question) => question.acid.id)).size).toBe(10);
  });

  it('creates four unique options for name questions', () => {
    const [question] = createQuiz('structure-name', 1, () => 0.42);
    expect(question?.options).toHaveLength(4);
    expect(new Set(question?.options.map((acid) => acid.id)).size).toBe(4);
    expect(question?.options.some((acid) => acid.id === question.acid.id)).toBe(true);
  });

  it('offers two new structural recognition modes among the quiz modes', () => {
    expect(QUIZ_MODES).toContain('name-structure');
    expect(QUIZ_MODES).toContain('one-structure');
  });

  it('makes four unique structures with one correct answer for every amino acid', () => {
    for (const mode of ['name-structure', 'one-structure'] as const) {
      const questions = createQuiz(mode, 20, () => 0.37);
      expect(questions).toHaveLength(AMINO_ACIDS.length);
      expect(new Set(questions.map((question) => question.acid.id)).size).toBe(20);
      for (const question of questions) {
        expect(question.mode).toBe(mode);
        expect(question.options).toHaveLength(4);
        expect(new Set(question.options.map((option) => option.id)).size).toBe(4);
        expect(new Set(question.options.map((option) => option.smiles)).size).toBe(4);
        expect(question.options.filter((option) => option.id === question.acid.id)).toHaveLength(1);
        expect(isCorrectAnswer(question, question.acid.id)).toBe(true);
        const wrong = question.options.find((option) => option.id !== question.acid.id);
        expect(wrong).toBeDefined();
        expect(isCorrectAnswer(question, wrong!.id)).toBe(false);
        expect(isCorrectAnswer(question, 'not-an-amino-acid')).toBe(false);
      }
    }
  });

  it('accepts 3-letter and 1-letter codes case-insensitively', () => {
    const threeQuestion = createQuiz('structure-three', 1, () => 0)[0];
    const oneQuestion = createQuiz('structure-one', 1, () => 0)[0];
    expect(threeQuestion).toBeDefined();
    expect(oneQuestion).toBeDefined();
    if (!threeQuestion || !oneQuestion) return;
    expect(isCorrectAnswer(threeQuestion, threeQuestion.acid.threeLetter.toLowerCase())).toBe(true);
    expect(isCorrectAnswer(threeQuestion, ` ${threeQuestion.acid.threeLetter.toUpperCase()} `)).toBe(true);
    expect(isCorrectAnswer(oneQuestion, oneQuestion.acid.oneLetter.toLowerCase())).toBe(true);
  });
});

