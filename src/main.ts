import './styles.css';
import {
  AMINO_ACIDS,
  AMINO_ACID_BY_ID,
  CATEGORIES,
  CATEGORY_IDS,
  type AminoAcid,
  type CategoryId,
} from './data/aminoAcids';
import { AMINO_ACID_PROPERTIES, filterProperties, type AminoAcidProperty } from './data/aminoAcidProperties';
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
import { createFlashStructureChoices, isStructureChoiceCue } from './lib/flashcards';
import { renderChemicalStructures } from './ui/structure';

type View = 'home' | 'overview' | 'properties' | 'flashcards' | 'quiz' | 'mastery';
type FlashCue = 'structure' | 'name' | 'threeLetter' | 'oneLetter';

interface FlashSession {
  order: AminoAcid[];
  structureChoices: AminoAcid[][];
  index: number;
  revealed: boolean;
  selectedStructureId: string | null;
  graded: boolean;
}

interface QuizSession {
  questions: QuizQuestion[];
  index: number;
  score: number;
  answered: boolean;
  lastCorrect: boolean | null;
  selectedAnswer: string | null;
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
let propertiesFilter: CategoryId | 'all' = 'all';
let propertiesSearch = '';
let selectedAcidId: string | null = null;
let resetDialogOpen = false;
let flashCue: FlashCue = 'structure';
let flashSession: FlashSession | null = null;
let quizMode: QuizMode = 'mixed';
let quizLength = 10;
let quizSession: QuizSession | null = null;

const VIEW_LABELS: Record<Exclude<View, 'home'>, string> = {
  overview: '전체 보기',
  properties: '특성표',
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
  return ['overview', 'properties', 'flashcards', 'quiz', 'mastery'].includes(candidate) ? candidate : 'home';
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function structureSvg(
  acid: AminoAcid,
  size: 'card' | 'large' = 'card',
  concealName = false,
  accessibleLabel?: string,
): string {
  const label = accessibleLabel ?? (concealName
    ? '정체를 맞힐 아미노산의 이차원 구조식'
    : `${acid.name}, ${acid.threeLetter}, ${acid.oneLetter}의 이차원 구조식`);
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
    case 'properties':
      return renderProperties();
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
      <figure class="hero-reference">
        <div class="hero-reference-scroll" tabindex="0" role="region" aria-label="20종 아미노산 구조 참고 그림" aria-describedby="hero-reference-hint">
          <a class="hero-reference-link" href="#properties" aria-label="20종 아미노산 구조와 곁사슬 분류 — 특성표 열기">
            <img src="${import.meta.env.BASE_URL}assets/amino_acids_reference.svg" width="1800" height="1340" alt="20종 아미노산 구조와 곁사슬 분류" />
          </a>
        </div>
        <figcaption id="hero-reference-hint"><span>구조와 분류를 한눈에<span class="hero-scroll-hint"> · 좌우로 스크롤해 보세요</span></span><a href="#properties">특성표 열기 <span aria-hidden="true">↗</span></a></figcaption>
      </figure>
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

function renderProperties(): string {
  const filtered = filterProperties(propertiesFilter, propertiesSearch);
  return `
    <section class="page-shell page-intro properties-intro" aria-labelledby="properties-title">
      <span class="eyebrow">REFERENCE</span>
      <div class="page-title-row">
        <div>
          <h1 id="properties-title">20가지 아미노산 특성표</h1>
          <p>20종 단백질 구성 아미노산의 주요 물리화학적 성질을 한눈에 비교해 보세요.</p>
        </div>
        <span id="properties-count" class="result-count" role="status" aria-atomic="true">${filtered.length} / 20종</span>
      </div>
      <section class="properties-structure-reference" aria-labelledby="properties-structure-title">
        <div class="properties-structure-heading">
          <h2 id="properties-structure-title" class="eyebrow">STRUCTURAL REFERENCE</h2>
          <a href="${import.meta.env.BASE_URL}assets/amino_acids_reference.svg" target="_blank" rel="noopener noreferrer" aria-label="구조 레퍼런스 크게 보기 (새 탭)">크게 보기 <span aria-hidden="true">↗</span></a>
        </div>
        <figure>
          <div class="properties-structure-scroll" role="region" aria-label="20종 아미노산 구조 레퍼런스, 좁은 화면에서 가로 스크롤 가능" aria-describedby="properties-structure-caption" tabindex="0">
            <img src="${import.meta.env.BASE_URL}assets/amino_acids_reference.svg" width="1800" height="1340" alt="20종 단백질 구성 아미노산의 구조와 R기 분류" />
          </div>
          <figcaption id="properties-structure-caption" class="properties-structure-caption">
            <span>20종 아미노산의 공통 골격과 서로 다른 R기를 비교한 구조 레퍼런스입니다.</span>
            <span class="properties-structure-scroll-hint">구조표를 좌우로 스크롤하세요 <span aria-hidden="true">↔</span></span>
          </figcaption>
        </figure>
      </section>
      <div class="properties-controls">
        <div class="filter-bar" role="group" aria-label="특성표 분류 필터">
          ${(['all', ...CATEGORY_IDS] as const).map((id) => {
            const count = id === 'all' ? 20 : AMINO_ACID_PROPERTIES.filter((acid) => acid.category === id).length;
            return `<button class="filter-button" data-action="properties-filter" data-filter="${id}" aria-pressed="${propertiesFilter === id}" aria-controls="properties-table">${id === 'all' ? '전체' : CATEGORIES[id].ko} <span>${count}</span></button>`;
          }).join('')}
        </div>
        <label class="properties-search" for="properties-search">
          <span>이름·약어 검색</span>
          <input id="properties-search" type="search" value="${escapeHtml(propertiesSearch)}" placeholder="아미노산 이름, 3-letter, 1-letter 검색..." autocomplete="off" spellcheck="false" aria-controls="properties-table" aria-describedby="properties-search-hint" />
          <small id="properties-search-hint">영문·한글 이름 또는 약어로 검색하세요. 영문 한 글자는 1-letter code로 찾습니다.</small>
        </label>
      </div>
    </section>
    <section class="page-shell properties-reference" aria-label="아미노산 물리화학적 특성">
      <div class="properties-table-guide"><span>자유 아미노산 참고값</span><span id="properties-scroll-hint">좁은 화면에서는 표를 좌우로 스크롤하세요 <span aria-hidden="true">↔</span></span></div>
      <div class="properties-table-scroll" role="region" aria-label="20가지 아미노산 특성표, 가로 스크롤 가능" aria-describedby="properties-scroll-hint" tabindex="0">
        <table id="properties-table" class="properties-table">
          <caption>20가지 아미노산의 분자량, 산–염기 특성, 등전점 및 Kyte–Doolittle hydropathy 비교</caption>
          <colgroup><col class="property-name-col" /><col class="property-code-col" /><col class="property-mr-col" /><col span="4" class="property-pk-col" /><col class="property-hydropathy-col" /><col class="property-features-col" /></colgroup>
          <thead><tr>
            <th scope="col">아미노산</th><th scope="col">약어</th><th scope="col" class="property-number">M<sub>r</sub></th>
            <th scope="col" class="property-number">pK<sub>1</sub><small>α-COOH</small></th>
            <th scope="col" class="property-number">pK<sub>2</sub><small>α-NH₃⁺</small></th>
            <th scope="col" class="property-number">pK<sub>R</sub><small>R group</small></th>
            <th scope="col" class="property-number">pI</th>
            <th scope="col" class="property-number">Hydropathy<small>Kyte–Doolittle</small></th>
            <th scope="col">핵심 특징</th>
          </tr></thead>
          ${renderPropertyBodies(filtered)}
        </table>
      </div>
      <aside class="properties-notes" aria-labelledby="properties-notes-title">
        <h2 id="properties-notes-title" class="eyebrow">REFERENCE NOTES</h2>
        <dl>
          <div><dt>M<sub>r</sub> · pKa · pI</dt><dd>M<sub>r</sub>은 상대 분자량(무차원)입니다. pKa 값과 pI는 자유 아미노산의 대표 참고값 및 등전점입니다. 실제 단백질 내부에서는 주변 미세환경에 의해 pKa가 달라질 수 있습니다. pK<sub>R</sub>의 —는 이 표에 곁사슬 pKa 값이 없음을 뜻합니다.</dd></div>
          <div><dt>Hydropathy</dt><dd>Kyte–Doolittle scale입니다. 양수일수록 상대적으로 소수성(hydrophobic), 음수일수록 상대적으로 친수성(hydrophilic)인 경향을 나타냅니다. 이 값들은 연속적인 물리화학적 척도이며, 단순한 소수성·친수성 이진 분류와 동일하지 않습니다.</dd></div>
        </dl>
      </aside>
    </section>
  `;
}

function renderPropertyBodies(acids: readonly AminoAcidProperty[]): string {
  if (acids.length === 0) return '<tbody><tr><td colspan="9" class="properties-empty"><span>일치하는 아미노산이 없습니다. 검색어 또는 분류를 바꿔 보세요.</span></td></tr></tbody>';
  return CATEGORY_IDS.map((category) => {
    const rows = acids.filter((acid) => acid.category === category);
    if (rows.length === 0) return '';
    return `<tbody>
      <tr class="property-group property-group--${category}"><th scope="rowgroup" colspan="9"><span>${CATEGORIES[category].ko} R 그룹</span><small>${rows.length}종</small></th></tr>
      ${rows.map((acid) => `<tr data-property-id="${acid.id}">
        <th scope="row"><strong>${escapeHtml(acid.name)}</strong><small>${escapeHtml(acid.koreanName)}</small></th>
        <td class="property-code">${acid.threeLetter} <span>· ${acid.oneLetter}</span></td>
        <td class="property-number">${acid.mr}</td>
        <td class="property-number">${acid.pK1.toFixed(2)}</td>
        <td class="property-number">${acid.pK2.toFixed(2)}</td>
        <td class="property-number">${acid.pKR === null ? '—' : acid.pKR.toFixed(2)}</td>
        <td class="property-number">${acid.pI.toFixed(2)}</td>
        <td class="property-number">${acid.hydropathy.toFixed(1)}</td>
        <td><div class="property-features">${acid.features.map((feature) => `<span>${escapeHtml(feature)}</span>`).join('')}</div></td>
      </tr>`).join('')}
    </tbody>`;
  }).join('');
}

function updatePropertiesResults(): void {
  const table = app.querySelector<HTMLTableElement>('#properties-table');
  if (!table) return;
  const filtered = filterProperties(propertiesFilter, propertiesSearch);
  // Keep the input, filters and scroll container mounted for keyboard/IME use.
  table.querySelectorAll('tbody').forEach((body) => body.remove());
  table.insertAdjacentHTML('beforeend', renderPropertyBodies(filtered));
  const count = app.querySelector('#properties-count');
  if (count) count.textContent = `${filtered.length} / 20종`;
  app.querySelectorAll<HTMLButtonElement>('[data-action="properties-filter"]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.filter === propertiesFilter));
  });
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
          <p>20종을 한 번씩 학습합니다. <b>이름·3-letter</b> 모드에서는 구조식 4개 중 정답을 고르고,
            구조식·1-letter 단서 모드에서는 답을 확인한 뒤 스스로 기억 정도를 평가하세요.</p>
        </div>
        <div class="study-setup">
          <fieldset class="segmented-fieldset">
            <legend>CUE</legend>
            ${(['structure', 'name', 'threeLetter', 'oneLetter'] as const)
              .map((cue) => `
                <label>
                  <input type="radio" name="flash-cue" value="${cue}" ${flashCue === cue ? 'checked' : ''} />
                  <span>${FLASH_CUE_LABELS[cue]}</span>
                </label>
              `).join('')}
          </fieldset>
          <button class="button button--primary button--wide" data-action="start-flash">20장 학습 시작</button>
          <p class="shortcut-note">${isStructureChoiceCue(flashCue)
            ? '<kbd>1</kbd>–<kbd>4</kbd> 구조 선택 <span aria-hidden="true">|</span> <kbd>Space</kbd> 다음 카드'
            : '<kbd>Space</kbd> 답 보기 <span aria-hidden="true">|</span> <kbd>1</kbd> 몰랐음 <span aria-hidden="true">|</span> <kbd>2</kbd> 헷갈림 <span aria-hidden="true">|</span> <kbd>3</kbd> 알았음'}</p>
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
        <p>학습 결과는 기존 암기 현황에 반영되었습니다.</p>
        <div class="button-row">
          <button class="button button--primary" data-action="restart-flash">다시 섞어 학습</button>
          <a class="button button--secondary" href="#mastery">암기 현황 보기</a>
        </div>
      </section>
    `;
  }

  const acid = flashSession.order[flashSession.index] as AminoAcid;
  const structureChoiceMode = isStructureChoiceCue(flashCue);
  const cueLabel = structureChoiceMode
    ? `${flashCue === 'name' ? 'NAME' : '3-LETTER'} → STRUCTURE · 4지선다`
    : `${FLASH_CUE_LABELS[flashCue].toLocaleUpperCase('en-US')} → ?`;

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
      <article class="flash-card ${structureChoiceMode ? 'flash-card--structure-choice' : ''} ${flashSession.revealed ? 'is-revealed' : ''}">
        <span class="prompt-label">${cueLabel}</span>
        <div class="flash-cue">${renderFlashCue(acid)}</div>
        ${structureChoiceMode
          ? renderFlashStructureChoices(
              acid,
              flashSession.structureChoices[flashSession.index] ?? [],
              flashSession.selectedStructureId,
            )
          : flashSession.revealed
            ? renderFlashAnswer(acid)
            : `
                <p class="question-copy">이 아미노산은?</p>
                <button class="button button--primary reveal-button" data-action="reveal">답 보기 <span class="key-hint">Space</span></button>
              `}
      </article>
      ${structureChoiceMode
        ? `<p class="shortcut-note shortcut-note--center">${flashSession.revealed
            ? '<kbd>Space</kbd>를 눌러 다음 카드로 넘어갈 수 있습니다.'
            : '<kbd>1</kbd>–<kbd>4</kbd>를 누르거나 구조식을 클릭해 선택하세요.'}</p>`
        : flashSession.revealed
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
          : '<p class="shortcut-note shortcut-note--center"><kbd>Space</kbd>를 눌러 답을 확인할 수 있습니다.</p>'}
    </section>
  `;
}

function renderFlashStructureChoices(
  acid: AminoAcid,
  options: readonly AminoAcid[],
  chosenId: string | null,
): string {
  const answered = chosenId !== null;
  const isCorrect = chosenId === acid.id;
  const chosen = answered ? options.find((candidate) => candidate.id === chosenId) : undefined;
  const optionMarkup = options.map((candidate, index) => {
    const letter = String.fromCharCode(65 + index);
    const correctChoice = answered && candidate.id === acid.id;
    const incorrectChoice = answered && chosenId === candidate.id && !correctChoice;
    return `
      <button type="button"
        class="flash-structure-option${correctChoice ? ' is-correct' : ''}${incorrectChoice ? ' is-incorrect' : ''}"
        data-action="choose-flash-structure" data-acid-id="${candidate.id}"
        aria-label="선택지 ${letter}의 구조식${correctChoice ? ' · 정답' : ''}${incorrectChoice ? ' · 선택한 오답' : ''}"
        ${answered ? 'disabled' : ''}>
        <span class="flash-option-letter" aria-hidden="true">${letter}</span>
        ${structureSvg(candidate, 'card', true, `선택지 ${letter}의 아미노산 구조식`)}
        ${correctChoice ? '<span class="flash-option-result">정답</span>' : ''}
        ${incorrectChoice ? '<span class="flash-option-result">선택한 답</span>' : ''}
      </button>
    `;
  }).join('');
  return `
    <p class="flash-structure-instruction">위 ${flashCue === 'threeLetter' ? '3-letter 표기' : '이름'}에 해당하는 아미노산의 구조식을 고르세요.</p>
    <div class="flash-structure-grid" role="group" aria-label="구조식 4개 중 하나 선택">
      ${optionMarkup}
    </div>
    ${answered ? `
      <div class="flash-choice-feedback ${isCorrect ? 'is-correct' : 'is-incorrect'}" role="status" aria-live="polite">
        <strong>${isCorrect ? '정답입니다!' : '오답입니다.'}</strong>
        ${!isCorrect && chosen ? `<p>선택한 구조: ${escapeHtml(chosen.name)} (${chosen.threeLetter})</p>` : ''}
        <p>정답: ${escapeHtml(acid.name)} (${acid.threeLetter} / ${acid.oneLetter})</p>
        <p><b>곁사슬(R기)</b> ${escapeHtml(acid.sideChain)} · ${escapeHtml(acid.note)}</p>
        <button class="button button--primary" data-action="next-flash">
          ${flashSession && flashSession.index === flashSession.order.length - 1 ? '학습 결과 보기' : '다음 카드'}
          <span class="key-hint">Space</span>
        </button>
      </div>
    ` : ''}
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
      <article class="quiz-card${question.mode.endsWith('-structure') ? ' quiz-card--structure-choice' : ''}" aria-live="polite">
        <span class="prompt-label">${quizPrompt(question.mode)}</span>
        <div class="quiz-cue">${renderQuizCue(question)}</div>
        ${question.mode.endsWith('-structure')
           ? renderQuizStructureChoices(question, quizSession.answered, quizSession.selectedAnswer)
           : quizSession.answered ? '' : renderQuizAnswerForm(question)}
         ${quizSession.answered ? renderQuizFeedback(question, quizSession.lastCorrect === true) : ''}
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
  if (mode.endsWith('-structure')) return '해당 아미노산의 구조식을 고르세요.';
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

function renderQuizStructureChoices(
  question: QuizQuestion,
  answered: boolean,
  selectedId: string | null,
): string {
  return `
    <div class="flash-structure-grid quiz-structure-grid" role="group" aria-label="아미노산 구조식 4개 중 정답 선택">
      ${question.options.map((acid, index) => {
        const letter = String.fromCharCode(65 + index);
        const correctChoice = answered && acid.id === question.acid.id;
        const incorrectChoice = answered && acid.id === selectedId && !correctChoice;
        return `
          <button type="button"
            class="flash-structure-option${correctChoice ? ' is-correct' : ''}${incorrectChoice ? ' is-incorrect' : ''}"
            data-action="choose-quiz-structure" data-acid-id="${acid.id}"
            aria-label="선택지 ${letter}의 아미노산 구조식${correctChoice ? ', 정답' : ''}${incorrectChoice ? ', 선택한 오답' : ''}"
            ${answered ? 'disabled' : ''}>
            <span class="flash-option-letter" aria-hidden="true">${letter}</span>
            ${structureSvg(acid, 'card', true, `선택지 ${letter}의 아미노산 구조식`)}
            ${correctChoice ? '<span class="flash-option-result">정답</span>' : ''}
            ${incorrectChoice ? '<span class="flash-option-result">선택한 오답</span>' : ''}
          </button>
        `;
      }).join('')}
    </div>
  `;
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
  const chosen = question.options.find((option) => option.id === quizSession?.selectedAnswer);
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
      ${chosen && chosen.id !== question.acid.id
        ? `<p class="quiz-choice-detail">선택한 구조: ${escapeHtml(chosen.name)} (${chosen.threeLetter})</p>`
        : ''}
      ${question.mode.endsWith('-structure')
        ? `<p class="quiz-choice-detail"><strong>곁사슬(R기)</strong> ${escapeHtml(question.acid.sideChain)} — ${escapeHtml(question.acid.note)}</p>`
        : ''}
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
  const order = shuffle(AMINO_ACIDS);
  flashSession = {
    order,
    structureChoices: order.map((acid) => createFlashStructureChoices(acid)),
    index: 0,
    revealed: false,
    selectedStructureId: null,
    graded: false,
  };
  render();
}

function advanceFlashCard(): void {
  if (!flashSession || !flashSession.revealed) return;
  flashSession.index += 1;
  flashSession.revealed = false;
  flashSession.selectedStructureId = null;
  flashSession.graded = false;
  render();
}

function selectFlashStructure(acidId: string): void {
  const session = flashSession;
  if (!session || !isStructureChoiceCue(flashCue) || session.revealed) return;
  const acid = session.order[session.index];
  if (!acid || !session.structureChoices[session.index]?.some((option) => option.id === acidId)) return;

  session.selectedStructureId = acidId;
  session.revealed = true;
  // A card can be viewed again by switching cues, but must never be graded twice.
  if (!session.graded) {
    changeMastery(acid.id, acidId === acid.id ? 1 : -1);
    session.graded = true;
  }
  render();
}

function rateFlashCard(delta: number): void {
  if (!flashSession || !flashSession.revealed || isStructureChoiceCue(flashCue)) return;
  const acid = flashSession.order[flashSession.index];
  if (!acid) return;
  if (!flashSession.graded) {
    changeMastery(acid.id, delta);
    flashSession.graded = true;
  }
  advanceFlashCard();
}

function startQuiz(): void {
  quizSession = {
    questions: createQuiz(quizMode, quizLength),
    index: 0,
    score: 0,
    answered: false,
    lastCorrect: null,
    selectedAnswer: null,
    mistakes: [],
  };
  render();
}

function submitQuizAnswer(answer: string): void {
  if (!quizSession || quizSession.answered) return;
  const question = quizSession.questions[quizSession.index];
  if (!question) return;
  if (question.mode.endsWith('-structure') && !question.options.some((option) => option.id === answer)) return;
  quizSession.selectedAnswer = answer;
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
    case 'properties-filter':
      propertiesFilter = (target.dataset.filter as CategoryId | 'all') ?? 'all';
      updatePropertiesResults();
      break;
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
      if (flashSession && !isStructureChoiceCue(flashCue)) {
        flashSession.revealed = true;
        render();
      }
      break;
    case 'choose-flash-structure':
      if (target.dataset.acidId) selectFlashStructure(target.dataset.acidId);
      break;
    case 'next-flash':
      if (isStructureChoiceCue(flashCue)) advanceFlashCard();
      break;
    case 'rate':
      rateFlashCard(Number(target.dataset.delta ?? 0));
      break;
    case 'choose-quiz-structure':
      if (target.dataset.acidId) submitQuizAnswer(target.dataset.acidId);
      break;
    case 'next-question':
      if (quizSession?.answered) {
        quizSession.index += 1;
        quizSession.answered = false;
        quizSession.lastCorrect = null;
        quizSession.selectedAnswer = null;
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

app.addEventListener('input', (event) => {
  const target = event.target as HTMLInputElement;
  if (target.id === 'properties-search') {
    propertiesSearch = target.value;
    updatePropertiesResults();
  }
});

app.addEventListener('change', (event) => {
  const target = event.target as HTMLInputElement | HTMLSelectElement;
  if (target.name === 'flash-cue' || target.id === 'flash-cue-select') {
    flashCue = target.value as FlashCue;
    if (flashSession) {
      flashSession.revealed = false;
      flashSession.selectedStructureId = null;
    }
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

  if (isStructureChoiceCue(flashCue)) {
    if (!flashSession.revealed && ['1', '2', '3', '4'].includes(event.key)) {
      event.preventDefault();
      const chosen = flashSession.structureChoices[flashSession.index]?.[Number(event.key) - 1];
      if (chosen) selectFlashStructure(chosen.id);
    } else if (flashSession.revealed && (event.code === 'Space' || event.key === 'Enter')) {
      event.preventDefault();
      advanceFlashCard();
    }
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
