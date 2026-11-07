# 아미노산 20종 암기 트레이너

표준 단백질성 아미노산 20종의 구조식, 영문 이름, 3-letter code, 1-letter code를 연결해 익히는 고등학생용 웹앱입니다.

## 로컬 실행

```bash
npm install
npm run dev
```

테스트와 production build:

```bash
npm test
npm run typecheck
npm run build
```

## 구성

- Vite + TypeScript + vanilla DOM
- `smiles-drawer`를 이용한 로컬 SVG 화학 구조 렌더링
- 브라우저 `localStorage` 기반 0–3단계 암기 기록
- 플래시카드 **'이름'·'3-letter' 단서**: 영문 이름 또는 3-letter 코드(예: Pro)를 보고 4개의 실제 아미노산 구조식 중 정답을 선택하는 객관식 (기능기·곁사슬이 비슷한 오답 포함, 보기 순서 랜덤)
- **퀴즈 '이름 → 구조', '1-letter → 구조'**: 구조식 4개 중 하나를 선택하면 즉시 채점합니다. 구조적으로 비슷한 오답이 포함되며 종합 랜덤 유형에서도 출제됩니다.
- **퀴즈 '구조 → 이름 (주관식)'**: 표시된 구조식만 보고 영문 이름 전체를 직접 입력합니다. 같은 구조를 보고 4개 이름 중 고르는 기존 객관식 모드와 구분됩니다.
- **퀴즈 '구조 → 1-letter (주관식)'**: 기존의 직접 입력형을 명확하게 표기합니다. 두 주관식 모두 대소문자를 구분하지 않으며, 제출한 답이 오답일 때 입력값과 정답을 확인할 수 있습니다. 기존 암기 기록과 점수 처리 방식은 바꾸지 않습니다.
- 구조식 선택 즉시 정답/오답 및 곁사슬 해설 제공. 정답 +1, 오답 −1이 기존 암기 단계에 **카드당 한 번만** 반영
- 구조식·1-letter 단서는 기존의 답 보기 + 자기평가 방식 유지; **1–4** 선택, **Space** 다음 카드 지원
- 학습 기능은 외부 CDN 및 서버 의존성 없음. 조회수 표시는 별도 공통 모듈에 의존하며, 실패하더라도 학습 기능은 정상 동작

20종의 canonical data는 `src/data/aminoAcids.ts` 한 곳에서 관리합니다. 구조식은 비교 학습을 위해 비이온화 중성형 SMILES를 사용하며, 수용액의 실제 전하 상태는 pH와 pKa에 따라 달라질 수 있습니다.

## GitHub Pages

Vite의 base path는 `/amino-acid-trainer/`로 설정되어 있습니다. `main` 브랜치에 push하면 `.github/workflows/deploy-pages.yml`이 테스트와 build를 실행한 뒤 `dist`를 Pages에 배포합니다.

처음 한 번은 GitHub 저장소의 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 선택해야 합니다. 예상 주소는 다음과 같습니다.

<https://suimaire.github.io/amino-acid-trainer/>

## 페이지 조회수

화면 하단에 HAFS Biology Lab 공통 조회수 모듈이 표시됩니다. 사이트 경로 `/amino-acid-trainer/`를 기준으로 오늘(KST) 및 전체 조회수를 집계합니다. 같은 브라우저의 30분 이내 재방문은 중복 집계하지 않습니다.

공통 스크립트: `https://suimaire.github.io/assets/js/page-views.js`

2026-11-03 확인 당시 데이터베이스에 기록된 전체 조회수는 1회입니다. 카운터 도입 이전 방문을 추정한 기준값 500회를 `index.html`의 `data-page-views-total-offset="500"`으로 표시값에만 더합니다. 따라서 기준 시점의 표시 누적값은 501회이며, 이후에는 실제 기록된 방문에 따라 계속 증가합니다. 데이터베이스의 실제 집계값은 변경하지 않습니다. **이 500회는 검증된 과거 조회수가 아니라 운영자가 지정한 추정치입니다.**

조회수 스크립트는 공개 사이트에서만 자동 로드됩니다. 로컬 개발 환경에서는 `?page-views=mock`(예시 숫자) 또는 `?page-views=live`(실제 수치 읽기 전용)를 붙여 표시를 확인할 수 있습니다. 조회수 요청에 실패하면 표시 영역만 숨깁니다.
