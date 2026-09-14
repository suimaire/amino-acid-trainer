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
- 외부 CDN 및 서버 의존성 없음

20종의 canonical data는 `src/data/aminoAcids.ts` 한 곳에서 관리합니다. 구조식은 비교 학습을 위해 비이온화 중성형 SMILES를 사용하며, 수용액의 실제 전하 상태는 pH와 pKa에 따라 달라질 수 있습니다.

## GitHub Pages

Vite의 base path는 `/amino-acid-trainer/`로 설정되어 있습니다. `main` 브랜치에 push하면 `.github/workflows/deploy-pages.yml`이 테스트와 build를 실행한 뒤 `dist`를 Pages에 배포합니다.

처음 한 번은 GitHub 저장소의 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 선택해야 합니다. 예상 주소는 다음과 같습니다.

<https://suimaire.github.io/amino-acid-trainer/>

