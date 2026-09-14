import { describe, expect, it } from 'vitest';
import { createQuiz, isCorrectAnswer } from './quiz';

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

