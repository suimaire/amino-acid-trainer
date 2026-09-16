import './styles.css';
import {
  AMINO_ACIDS,
  AMINO_ACID_BY_ID,
  CATEGORIES,
  CATEGORY_IDS,
  type AminoAcid,
  type CategoryId,
} from './data/aminoAcids';
import { masteredCount, updateMastery, type MasteryMap } from './lib/mastery';
import {
  createQuiz,
  isCorrectAnswer,
  QUIZ_MODE_LABELS,
  QUIZ_MODES,
  type QuizMode,
  type QuizQuestion,
  shuffle,
} from './lib/quiz';
import { createProgressStorage } from './lib/storage';
import { renderChemicalStructures } from './ui/structure';

type View = 'home' | 'overview' | 'flashcards' | 'quiz' | 'mastery';
type FlashCue = 'structure' | 'name' | 'threeLetter' | 'oneLetter';

interface FlashSession {
  order: AminoAcid[];
  index: number;
  revealed: boolean;
}

interface QuizSession {
  questions: QuizQuestion[];
  index: number;
  score: number;
  answered: boolean;
  lastCorrect: boolean | null;
  mistakes: string[];
}

const appRoot = document.querySelector<HTMLDivElement>('#app');
if (!appRoot) throw new Error('App root was not found.');
const app: HTMLDivElement = appRoot;

const progressStorage = createProgressStorage();
let mastery: MasteryMap = progressStorage.load();
let storageUnavailable = !progressStorage.isAvailable();
let activeView: View = viewFromHash();
let activeFilter: CategoryId | 'all' = 'all';
let selectedAcidId: string | null = null;
let resetDialogOpen = false;
let flashCue: FlashCue = 'structure';
let flashSession: FlashSession | null = null;
let quizMode: QuizMode = 'mixed';
let quizLength = 10;
let quizSession: QuizSession | null = null;

const VIEW_LABELS: Record<Exclude<View, 'home'>, string> = {
  overview: '전체 보기',
  flashcards: '플래시카드',
  quiz: '퀴즈',
  mastery: '암기 현황',
};

const FLASH_CUE_LABELS: Record<FlashCue, string> = {
  structure: '구조식',
  name: '이름',
  threeLetter: '3-letter',
  oneLetter: '1-letter',
};

function viewFromHash(): View {
  const candidate = window.location.hash.slice(1) as View;
  return ['overview', 'flashcards', 'quiz', 'mastery'].includes(candidate) ? candidate : 'home';
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function structureSvg(acid: AminoAcid, size: 'card' | 'large' = 'card', concealName = false): string {
  const label = concealName
    ? '정체를 맞힐 아미노산의 이차원 구조식'
    : `${acid.name}, ${acid.threeLetter}, ${acid.oneLetter}의 이차원 구조식`;
  return `
    <div class="structure-frame structure-frame--${size}">
      <svg
        data-smiles="${escapeHtml(acid.smiles)}"
        data-size="${size}"
        role="img"
        aria-label="${escapeHtml(label)}"
      ></svg>
    </div>
  `;
}

function persistMastery(): void {
  if (!progressStorage.save(mastery)) storageUnavailable = true;
}

function changeMastery(acidId: string, delta: number): void {
  mastery = updateMastery(mastery, acidId, delta);
  persistMastery();
}

function render(): void {
  const learned = masteredCount(mastery);
  app.innerHTML = `
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="#home" aria-label="아미노산 트레이너 홈">
          <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
          <span>AMINO ACID TRAINER</span>
        </a>
        <nav class="primary-nav" aria-label="주요 메뉴">
          ${Object.entries(VIEW_LABELS)
            .map(
              ([view, label]) => `
                <a href="#${view}" ${activeView === view ? 'aria-current="page"' : ''}>${label}</a>
              `,
            )
            .join('')}
        </nav>
        <a class="header-progress" href="#mastery" aria-label="암기 완료 ${learned}개, 전체 20개">
          <span>MASTERED</span>
          <strong>${learned}<small>/20</small></strong>
        </a>
      </div>
    </header>
    ${
      storageUnavailable
        ? '<div class="storage-notice" role="status">이 브라우저에서는 학습 기록을 저장할 수 없습니다. 현재 세션의 학습은 계속할 수 있습니다.</div>'
        : ''
    }
    <main id="main-content" tabindex="-1">
      ${renderView()}
    </main>
    <footer class="site-footer">
      <div class="scientific-note">
        <span class="eyebrow">SCIENTIFIC NOTE</span>
        <p>구조 비교와 암기를 쉽게 하기 위해 기본 구조식은 비이온화 형태를 중심으로 표시합니다. 실제 수용액에서는 pH와 각 작용기의 pKa에 따라 전하 상태가 달라질 수 있습니다.</p>
      </div>
      <div class="footer-bottom">
        <a href="https://suimaire.github.io/">← HAFS 생화학 자료</a>
        <span>Standard proteinogenic amino acids | 20</span>
      </div>
      <div class="footer-brand">
        <p class="footer-brand__name">HAFS Biology Lab</p>
        <p class="footer-brand__credit">Teacher-built interactive science tools · CH Park</p>
      </div>
    </footer>
    ${renderDetailDialog()}
    ${renderResetDialog()}
  `;

  queueMicrotask(() => {
    renderChemicalStructures(app);
    const detailDialog = app.querySelector<HTMLDialogElement>('#acid-detail-dialog');
    if (detailDialog && !detailDialog.open) detailDialog.showModal();
    const resetDialog = app.querySelector<HTMLDialogElement>('#reset-dialog');
    if (resetDialog && !resetDialog.open) resetDialog.showModal();
  });
}

function renderView(): string {
  switch (activeView) {
    case 'overview':
      return renderOverview();
    case 'flashcards':
      return renderFlashcards();
    case 'quiz':
      return renderQuiz();
    case 'mastery':
      return renderMastery();
    default:
      return renderHome();
  }
}

function renderHome(): string {
  const learned = masteredCount(mastery);
  const percentage = (learned / AMINO_ACIDS.length) * 100;
  return `
    <section class="home-hero page-shell" aria-labelledby="home-title">
      <div class="hero-copy">
        <span class="eyebrow">AMINO ACID TRAINER</span>
        <h1 id="home-title">Amino Acids,<br aria-hidden="true" /> by Heart.</h1>
        <p class="hero-lead">구조식, 이름, 3-letter, 1-letter를<br /> 서로 연결해 익혀 보세요.</p>
        <div class="hero-actions">
          <a class="button button--primary" href="#flashcards">플래시카드 시작</a>
          <a class="button button--secondary" href="#quiz">퀴즈 시작</a>
          <a class="text-link" href="#overview">20종 전체 보기 <span aria-hidden="true">→</span></a>
        </div>
      </div>
      <aside class="mastery-summary" aria-label="현재 암기 현황">
        <div class="summary-heading">
          <span class="eyebrow">MASTERED</span>
          <strong>${learned}<small>/ 20</small></strong>
        </div>
        <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="20" aria-valuenow="${learned}">
          <span style="width:${percentage}%"></span>
        </div>
        <div class="amino-ticks" aria-hidden="true">
          ${AMINO_ACIDS.map((acid) => `<i class="${mastery[acid.id] === 3 ? 'is-mastered' : ''}"></i>`).join('')}
        </div>
        <p>${learned === 0 ? '첫 학습을 시작해 보세요.' : `${20 - learned}종을 더 익히면 완성입니다.`}</p>
      </aside>
    </section>
    <section class="start-grid page-shell" aria-labelledby="start-heading">
      <div class="section-heading section-heading--compact">
        <span class="eyebrow">START STUDYING</span>
        <h2 id="start-heading">어디서 시작할까요?</h2>
      </div>
      <div class="route-grid">
        <a class="route-card" href="#overview">
          <span class="route-number">01</span>
          <h3>전체 보기</h3>
          <p>구조와 코드를 한눈에 비교하고 분류별로 살펴봅니다.</p>
          <span class="route-arrow" aria-hidden="true">→</span>
        </a>
        <a class="route-card route-card--accent" href="#flashcards">
          <span class="route-number">02</span>
          <h3>플래시카드</h3>
          <p>20종을 무작위 순서로 한 번씩 보고 기억을 점검합니다.</p>
          <span class="route-arrow" aria-hidden="true">→</span>
        </a>
        <a class="route-card" href="#quiz">
          <span class="route-number">03</span>
          <h3>퀴즈</h3>
          <p>7가지 연결 유형과 종합 문제로 실력을 확인합니다.</p>
          <span class="route-arrow" aria-hidden="true">→</span>
        </a>
      </div>
    </section>
    <section class="category-strip page-shell" aria-label="학습용 아미노산 분류">
      ${CATEGORY_IDS.map((id) => `<a href="#overview" data-filter-link="${id}"><span>${CATEGORIES[id].ko}</span><strong>${AMINO_ACIDS.filter((acid) => acid.category === id).length}</strong></a>`).join('')}
    </section>
  `;
}

function renderOverview(): string {
  const filtered =
    activeFilter === 'all' ? AMINO_ACIDS : AMINO_ACIDS.filter((acid) => acid.category === activeFilter);
  return `
    <section class="page-shell page-intro">
      <span class="eyebrow">REFERENCE | 20 AMINO ACIDS</span>
      <div class="page-title-row">
        <div>
          <h1>아미노산 전체 보기</h1>
          <p>카드를 선택하면 곁사슬의 핵심 특징을 더 크게 확인할 수 있습니다.</p>
        </div>
        <span class="result-count" aria-live="polite">${filtered.length} / 20</span>
      </div>
      <div class="filter-bar" role="group" aria-label="아미노산 분류 필터">
        ${filterButton('all', '전체')}
        ${CATEGORY_IDS.map((id) => filterButton(id, CATEGORIES[id].ko)).join('')}
      </div>
    </section>
    <section class="page-shell amino-grid" aria-label="아미노산 목록">
      ${filtered.map(renderAminoCard).join('')}
    </section>
    <section class="page-shell classification-caveat">
      <span class="eyebrow">CLASSIFICATION NOTE</span>
      <p>이 분류는 암기를 돕기 위한 대표 분류입니다. 예를 들어 Tyrosine은 방향족 고리와 페놀성 OH를 함께 가지므로, 각 범주가 모든 물리화학적 성질을 완전히 나누는 것은 아닙니다.</p>
    </section>
  `;
}

function filterButton(id: CategoryId | 'all', label: string): string {
  return `<button class="filter-button" data-action="filter" data-filter="${id}" aria-pressed="${activeFilter === id}">${label}</button>`;
}

function renderAminoCard(acid: AminoAcid): string {
  return `
    <button class="amino-card" data-action="open-acid" data-acid-id="${acid.id}" aria-label="${acid.name} 상세 보기">
      ${structureSvg(acid)}
      <span class="amino-name">${acid.name.toLocaleUpperCase('en-US')}</span>
      <span class="amino-korean">${acid.koreanName}</span>
      <span class="code-row"><strong>${acid.threeLetter}</strong><b>${acid.oneLetter}</b></span>
      <span class="category-label">${CATEGORIES[acid.category].en}</span>
    </button>
  `;
}

function renderFlashcards(): string {
  if (!flashSession) {
    return `
      <section class="page-shell study-shell">
        <div class="section-heading">
          <span class="eyebrow">FLASHCARDS</span>
          <h1>무엇을 보고 맞힐까요?</h1>
          <p>20종을 섞어 한 번씩 제시합니다. 답을 본 뒤 기억 정도를 직접 표시하세요.</p>
        </div>
        <div class="study-setup">
          <fieldset class="segmented-fieldset">
            <legend>CUE</legend>
            ${(['structure', 'name', 'threeLetter', 'oneLetter'] as const)
              .map(
                (cue) => `
                  <label>
                    <input type="radio" name="flash-cue" value="${cue}" ${flashCue === cue ? 'checked' : ''} />
                    <span>${FLASH_CUE_LABELS[cue]}</span>
                  </label>
                `,
              )
              .join('')}
          </fieldset>
          <button class="button button--primary button--wide" data-action="start-flash">20장 학습 시작</button>
          <p class="shortcut-note"><kbd>Space</kbd> 답 보기 <span aria-hidden="true">|</span> <kbd>1</kbd> 몰랐음 <span aria-hidden="true">|</span> <kbd>2</kbd> 헷갈림 <span aria-hidden="true">|</span> <kbd>3</kbd> 알았음</p>
        </div>
      </section>
    `;
  }

  if (flashSession.index >= flashSession.order.length) {
    return `
      <section class="page-shell completion-panel">
        <span class="eyebrow">SESSION COMPLETE</span>
        <strong class="completion-score">20<small>/20</small></strong>
        <h1>한 바퀴를 마쳤습니다.</h1>
        <p>자기평가 결과는 암기 현황에 반영되었습니다.</p>
        <div class="button-row">
          <button class="button button--primary" data-action="restart-flash">다시 섞어 학습</button>
          <a class="button button--secondary" href="#mastery">암기 현황 보기</a>
        </div>
      </section>
    `;
  }

  const acid = flashSession.order[flashSession.index] as AminoAcid;
  const cueLabel = `${FLASH_CUE_LABELS[flashCue].toLocaleUpperCase('en-US')} → ?`;
  return `
    <section class="page-shell study-shell">
      <div class="study-topline">
        <div>
          <span class="eyebrow">FLASHCARDS</span>
          <span class="study-count">${flashSession.index + 1} / 20</span>
        </div>
        <label class="compact-select">문제 단서
          <select id="flash-cue-select" aria-label="플래시카드 문제 단서">
            ${(['structure', 'name', 'threeLetter', 'oneLetter'] as const)
              .map((cue) => `<option value="${cue}" ${flashCue === cue ? 'selected' : ''}>${FLASH_CUE_LABELS[cue]}</option>`)
              .join('')}
          </select>
        </label>
      </div>
      <div class="study-progress"><span style="width:${((flashSession.index + 1) / 20) * 100}%"></span></div>
      <article class="flash-card ${flashSession.revealed ? 'is-revealed' : ''}" aria-live="polite">
        <span class="prompt-label">${cueLabel}</span>
        <div class="flash-cue">${renderFlashCue(acid)}</div>
        ${
          flashSession.revealed
            ? renderFlashAnswer(acid)
            : `
                <p class="question-copy">이 아미노산은?</p>
                <button class="button button--primary reveal-button" data-action="reveal">답 보기 <span class="key-hint">Space</span></button>
              `
        }
      </article>
      ${
        flashSession.revealed
          ? `
              <div class="rating-panel" aria-label="기억 정도 선택">
                <span>얼마나 잘 기억했나요?</span>
                <div class="rating-buttons">
                  <button data-action="rate" data-delta="-1"><kbd>1</kbd> 몰랐음</button>
                  <button data-action="rate" data-delta="0"><kbd>2</kbd> 헷갈림</button>
                  <button class="rating-known" data-action="rate" data-delta="1"><kbd>3</kbd> 알았음</button>
                </div>
              </div>
            `
          : '<p class="shortcut-note shortcut-note--center"><kbd>Space</kbd>를 눌러 답을 확인할 수 있습니다.</p>'
      }
    </section>
  `;
}

function renderFlashCue(acid: AminoAcid): string {
  switch (flashCue) {
    case 'name':
      return `<strong class="cue-word">${acid.name}</strong>`;
    case 'threeLetter':
      return `<strong class="cue-code cue-code--three">${acid.threeLetter}</strong>`;
    case 'oneLetter':
      return `<strong class="cue-code">${acid.oneLetter}</strong>`;
    default:
      return structureSvg(acid, 'large', true);
  }
}

function renderFlashAnswer(acid: AminoAcid): string {
  return `
    <div class="answer-rule"><span>ANSWER</span></div>
    <div class="flash-answer">
      <div>
        <h2>${acid.name.toLocaleUpperCase('en-US')}</h2>
        <p>${acid.koreanName}</p>
      </div>
      <div class="answer-codes"><strong>${acid.threeLetter}</strong><b>${acid.oneLetter}</b></div>
      <span class="category-pill">${CATEGORIES[acid.category].en}</span>
    </div>
  `;
}

function renderQuiz(): string {
  if (!quizSession) return renderQuizSetup();
  if (quizSession.index >= quizSession.questions.length) return renderQuizResult(quizSession);

  const question = quizSession.questions[quizSession.index] as QuizQuestion;
  const progress = ((quizSession.index + 1) / quizSession.questions.length) * 100;
  return `
    <section class="page-shell study-shell">
      <div class="study-topline">
        <div>
          <span class="eyebrow">QUIZ | ${QUIZ_MODE_LABELS[question.mode].toLocaleUpperCase('ko-KR')}</span>
          <span class="study-count">${quizSession.index + 1} / ${quizSession.questions.length}</span>
        </div>
        <span class="live-score">현재 ${quizSession.score}점</span>
      </div>
      <div class="study-progress"><span style="width:${progress}%"></span></div>
      <article class="quiz-card" aria-live="polite">
        <span class="prompt-label">${quizPrompt(question.mode)}</span>
        <div class="quiz-cue">${renderQuizCue(question)}</div>
        ${quizSession.answered ? renderQuizFeedback(question, quizSession.lastCorrect === true) : renderQuizAnswerForm(question)}
      </article>
    </section>
  `;
}

function renderQuizSetup(): string {
  return `
    <section class="page-shell study-shell">
      <div class="section-heading">
        <span class="eyebrow">QUIZ</span>
        <h1>연결 유형을 선택하세요.</h1>
        <p>각 문항을 제출하면 정답과 구조식을 바로 확인할 수 있습니다.</p>
      </div>
      <form class="quiz-setup" data-form="quiz-setup">
        <label>문제 유형
          <select id="quiz-mode" name="quiz-mode">
            ${QUIZ_MODES.map((mode) => `<option value="${mode}" ${quizMode === mode ? 'selected' : ''}>${QUIZ_MODE_LABELS[mode]}</option>`).join('')}
          </select>
        </label>
        <fieldset class="segmented-fieldset segmented-fieldset--length">
          <legend>문항 수</legend>
          ${[5, 10, 20]
            .map(
              (length) => `<label><input type="radio" name="quiz-length" value="${length}" ${quizLength === length ? 'checked' : ''} /><span>${length}</span></label>`,
            )
            .join('')}
        </fieldset>
        <button class="button button--primary button--wide" type="submit">퀴즈 시작</button>
      </form>
      <div class="quiz-type-list" aria-label="지원 문제 유형">
        ${QUIZ_MODES.filter((mode) => mode !== 'mixed').map((mode) => `<span>${QUIZ_MODE_LABELS[mode]}</span>`).join('')}
      </div>
    </section>
  `;
}

function quizPrompt(mode: QuizQuestion['mode']): string {
  if (mode.endsWith('-name')) return '정확한 영문 이름을 고르세요.';
  if (mode.endsWith('-three')) return '3-letter code를 입력하세요.';
  return '1-letter code를 입력하세요.';
}

function renderQuizCue(question: QuizQuestion): string {
  if (question.mode.startsWith('structure')) return structureSvg(question.acid, 'large', true);
  if (question.mode.startsWith('name')) return `<strong class="cue-word">${question.acid.name}</strong>`;
  if (question.mode.startsWith('three')) return `<strong class="cue-code cue-code--three">${question.acid.threeLetter}</strong>`;
  return `<strong class="cue-code">${question.acid.oneLetter}</strong>`;
}

function renderQuizAnswerForm(question: QuizQuestion): string {
  if (question.options.length > 0) {
    return `
      <form class="answer-form" data-form="quiz-answer">
        <div class="choice-grid">
          ${question.options
            .map(
              (acid, index) => `
                <label class="choice-option">
                  <input type="radio" name="answer" value="${acid.name}" ${index === 0 ? 'required' : ''} />
                  <span><i>${String.fromCharCode(65 + index)}</i>${acid.name}</span>
                </label>
              `,
            )
            .join('')}
        </div>
        <button class="button button--primary" type="submit">정답 제출</button>
      </form>
    `;
  }
  const maxLength = question.mode.endsWith('-one') ? 1 : 3;
  return `
    <form class="answer-form answer-form--text" data-form="quiz-answer">
      <label for="quiz-answer">정답</label>
      <div>
        <input id="quiz-answer" name="answer" type="text" maxlength="${maxLength}" autocomplete="off" autocapitalize="characters" spellcheck="false" required autofocus />
        <button class="button button--primary" type="submit">정답 제출</button>
      </div>
      <p>대소문자는 구분하지 않습니다.</p>
    </form>
  `;
}

function renderQuizFeedback(question: QuizQuestion, correct: boolean): string {
  const isLast = quizSession ? quizSession.index === quizSession.questions.length - 1 : false;
  return `
    <div class="quiz-feedback ${correct ? 'is-correct' : 'is-incorrect'}" role="status">
      <span class="feedback-status">${correct ? '정답' : '오답'}</span>
      <div class="feedback-answer">
        <div>
          <h2>${question.acid.name}</h2>
          <p>${question.acid.threeLetter} / ${question.acid.oneLetter}</p>
          <span>${CATEGORIES[question.acid.category].en}</span>
        </div>
        ${structureSvg(question.acid)}
      </div>
      <button class="button button--primary" data-action="next-question">${isLast ? '결과 보기' : '다음 문제'}</button>
    </div>
  `;
}

function renderQuizResult(session: QuizSession): string {
  const total = session.questions.length;
  const percent = Math.round((session.score / total) * 100);
  const mistakeIds = [...new Set(session.mistakes)];
  return `
    <section class="page-shell completion-panel completion-panel--quiz">
      <span class="eyebrow">QUIZ COMPLETE</span>
      <strong class="completion-score">${session.score}<small>/ ${total}</small></strong>
      <h1>${percent}%</h1>
      <p>${percent === 100 ? '20종의 연결을 정확히 기억하고 있습니다.' : '틀린 항목을 확인하고 한 번 더 도전해 보세요.'}</p>
      ${
        mistakeIds.length > 0
          ? `
              <div class="mistake-list">
                <h2>틀린 아미노산</h2>
                <ul>
                  ${mistakeIds
                    .map((id) => AMINO_ACID_BY_ID.get(id))
                    .filter((acid): acid is AminoAcid => Boolean(acid))
                    .map((acid) => `<li><span>${acid.name}</span><strong>${acid.threeLetter}</strong><b>${acid.oneLetter}</b></li>`)
                    .join('')}
                </ul>
              </div>
            `
          : '<div class="perfect-note">모든 문항을 맞혔습니다.</div>'
      }
      <div class="button-row">
        <button class="button button--primary" data-action="retry-quiz">같은 설정으로 다시</button>
        <a class="button button--secondary" href="#mastery">암기 현황 보기</a>
      </div>
    </section>
  `;
}

function renderMastery(): string {
  const learned = masteredCount(mastery);
  return `
    <section class="page-shell page-intro mastery-intro">
      <span class="eyebrow">MASTERY</span>
      <div class="page-title-row">
        <div>
          <h1>암기 현황</h1>
          <p>플래시카드 자기평가와 퀴즈 결과가 0–3단계로 반영됩니다.</p>
        </div>
        <div class="mastery-total"><strong>${learned}</strong><span>/ 20 MASTERED</span></div>
      </div>
      <div class="level-legend" aria-label="단계 안내">
        <span>0 처음</span><span>1 익숙해지는 중</span><span>2 거의 암기</span><span>3 MASTERED</span>
      </div>
    </section>
    <section class="page-shell mastery-list" aria-label="아미노산별 암기 단계">
      ${AMINO_ACIDS.map((acid) => renderMasteryRow(acid)).join('')}
    </section>
    <section class="page-shell reset-section">
      <div><h2>처음부터 다시 시작</h2><p>이 기기에 저장된 모든 암기 단계를 0으로 되돌립니다.</p></div>
      <button class="button button--danger" data-action="open-reset">학습 기록 초기화</button>
    </section>
  `;
}

function renderMasteryRow(acid: AminoAcid): string {
  const level = mastery[acid.id] ?? 0;
  return `
    <div class="mastery-row">
      <div class="mastery-identity">
        <b>${acid.oneLetter}</b>
        <span><strong>${acid.name}</strong><small>${acid.threeLetter} / ${CATEGORIES[acid.category].en}</small></span>
      </div>
      <div class="mastery-level" aria-label="${acid.name} 암기 단계 ${level} / 3">
        ${[1, 2, 3].map((step) => `<i class="${step <= level ? 'is-filled' : ''}"></i>`).join('')}
      </div>
      <span class="mastery-status ${level === 3 ? 'is-mastered' : ''}">${level === 3 ? 'MASTERED' : `LEVEL ${level}`}</span>
    </div>
  `;
}

function renderDetailDialog(): string {
  if (!selectedAcidId) return '';
  const acid = AMINO_ACID_BY_ID.get(selectedAcidId);
  if (!acid) return '';
  return `
    <dialog id="acid-detail-dialog" class="detail-dialog" aria-labelledby="detail-title">
      <button class="dialog-close" data-action="close-detail" aria-label="상세 보기 닫기">×</button>
      <div class="detail-layout">
        ${structureSvg(acid, 'large')}
        <div class="detail-copy">
          <span class="eyebrow">${CATEGORIES[acid.category].en}</span>
          <h2 id="detail-title">${acid.name}</h2>
          <p class="detail-korean">${acid.koreanName}</p>
          <div class="detail-codes"><span><small>3-LETTER</small><strong>${acid.threeLetter}</strong></span><span><small>1-LETTER</small><strong>${acid.oneLetter}</strong></span></div>
          <dl><div><dt>R GROUP</dt><dd>${acid.sideChain}</dd></div><div><dt>MEMORY NOTE</dt><dd>${acid.note}</dd></div></dl>
        </div>
      </div>
    </dialog>
  `;
}

function renderResetDialog(): string {
  if (!resetDialogOpen) return '';
  return `
    <dialog id="reset-dialog" class="confirm-dialog" aria-labelledby="reset-title">
      <span class="eyebrow">RESET PROGRESS</span>
      <h2 id="reset-title">학습 기록을 초기화할까요?</h2>
      <p>20종의 암기 단계가 모두 0으로 돌아갑니다. 이 작업은 되돌릴 수 없습니다.</p>
      <div class="button-row">
        <button class="button button--secondary" data-action="cancel-reset">취소</button>
        <button class="button button--danger" data-action="confirm-reset">초기화</button>
      </div>
    </dialog>
  `;
}

function startFlashSession(): void {
  flashSession = { order: shuffle(AMINO_ACIDS), index: 0, revealed: false };
  render();
}

function rateFlashCard(delta: number): void {
  if (!flashSession || !flashSession.revealed) return;
  const acid = flashSession.order[flashSession.index];
  if (!acid) return;
  changeMastery(acid.id, delta);
  flashSession.index += 1;
  flashSession.revealed = false;
  render();
}

function startQuiz(): void {
  quizSession = {
    questions: createQuiz(quizMode, quizLength),
    index: 0,
    score: 0,
    answered: false,
    lastCorrect: null,
    mistakes: [],
  };
  render();
}

function submitQuizAnswer(answer: string): void {
  if (!quizSession || quizSession.answered) return;
  const question = quizSession.questions[quizSession.index];
  if (!question) return;
  const correct = isCorrectAnswer(question, answer);
  quizSession.answered = true;
  quizSession.lastCorrect = correct;
  if (correct) quizSession.score += 1;
  else quizSession.mistakes.push(question.acid.id);
  changeMastery(question.acid.id, correct ? 1 : -1);
  render();
}

app.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action], [data-filter-link]');
  if (!target) return;

  const filterLink = target.dataset.filterLink as CategoryId | undefined;
  if (filterLink) activeFilter = filterLink;

  switch (target.dataset.action) {
    case 'filter':
      activeFilter = (target.dataset.filter as CategoryId | 'all') ?? 'all';
      render();
      break;
    case 'open-acid':
      selectedAcidId = target.dataset.acidId ?? null;
      render();
      break;
    case 'close-detail':
      selectedAcidId = null;
      render();
      break;
    case 'start-flash':
    case 'restart-flash':
      startFlashSession();
      break;
    case 'reveal':
      if (flashSession) {
        flashSession.revealed = true;
        render();
      }
      break;
    case 'rate':
      rateFlashCard(Number(target.dataset.delta ?? 0));
      break;
    case 'next-question':
      if (quizSession?.answered) {
        quizSession.index += 1;
        quizSession.answered = false;
        quizSession.lastCorrect = null;
        render();
      }
      break;
    case 'retry-quiz':
      startQuiz();
      break;
    case 'open-reset':
      resetDialogOpen = true;
      render();
      break;
    case 'cancel-reset':
      resetDialogOpen = false;
      render();
      break;
    case 'confirm-reset':
      mastery = Object.fromEntries(AMINO_ACIDS.map((acid) => [acid.id, 0])) as MasteryMap;
      if (!progressStorage.clear()) storageUnavailable = true;
      persistMastery();
      resetDialogOpen = false;
      render();
      break;
  }
});

app.addEventListener('change', (event) => {
  const target = event.target as HTMLInputElement | HTMLSelectElement;
  if (target.name === 'flash-cue' || target.id === 'flash-cue-select') {
    flashCue = target.value as FlashCue;
    if (flashSession) flashSession.revealed = false;
    render();
  }
  if (target.name === 'quiz-mode') quizMode = target.value as QuizMode;
  if (target.name === 'quiz-length') quizLength = Number(target.value);
});

app.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target as HTMLFormElement;
  const data = new FormData(form);
  if (form.dataset.form === 'quiz-setup') {
    quizMode = data.get('quiz-mode') as QuizMode;
    quizLength = Number(data.get('quiz-length'));
    startQuiz();
  }
  if (form.dataset.form === 'quiz-answer') {
    const answer = data.get('answer');
    if (typeof answer === 'string') submitQuizAnswer(answer);
  }
});

window.addEventListener('hashchange', () => {
  activeView = viewFromHash();
  selectedAcidId = null;
  resetDialogOpen = false;
  render();
  document.querySelector<HTMLElement>('#main-content')?.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

window.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement | null;
  if (
    target?.matches('input, textarea, select, button, [contenteditable="true"]') ||
    activeView !== 'flashcards' ||
    !flashSession ||
    flashSession.index >= flashSession.order.length
  ) {
    return;
  }

  if (event.code === 'Space' && !flashSession.revealed) {
    event.preventDefault();
    flashSession.revealed = true;
    render();
  } else if (flashSession.revealed && ['1', '2', '3'].includes(event.key)) {
    event.preventDefault();
    rateFlashCard({ '1': -1, '2': 0, '3': 1 }[event.key] ?? 0);
  }
});

render();
