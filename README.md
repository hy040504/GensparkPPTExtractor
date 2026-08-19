<div align="center">

# Genspark PPT Extractor

**Genspark AI Slides를 장면마다 캡처해, 화면과 같은 PPTX로 묶는 TypeScript CLI**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Playwright](https://img.shields.io/badge/Playwright-Chromium-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

[EXE로 쓰기](#windows-단일-exe) · [소스 설치](#소스에서-설치) · [매니저](#대화형-매니저) · [CLI](#일회성-cli) · [구조](#프로젝트-구조)

</div>

---

Genspark 내장 보내기(PPTX/PDF)는 CSS 그라데이션, 웹폰트, 절대 좌표 레이아웃을 자주 깨뜨립니다. 이 도구는 **포맷을 억지로 변환하지 않고**, 브라우저로 장면을 렌더한 뒤 픽셀 단위로 캡처합니다.

| 내장 보내기 | 이 도구 |
| --- | --- |
| 폰트 어긋남, 그라데이션 소실 | 브라우저 미리보기와 동일 |
| 복잡한 HTML → 네이티브 shape | 장면 PNG를 슬라이드에 가득 채움 |
| 유료 플랜이 필요한 경우 있음 | 공개 링크만 있으면 로컬에서 추출 |

## Windows 단일 EXE

Node.js를 설치하지 않아도 됩니다. **파일 하나만** 다른 Windows PC로 복사해서 바로 실행할 수 있습니다.

- 미리 빌드된 파일: [Releases의 GensparkPPT.exe](https://github.com/hy040504/GensparkPPTExtractor/releases/latest)
- 직접 빌드:

```bash
npm run build:exe
```

결과: `release/GensparkPPT.exe` (약 47MB)

1. exe를 USB·메신저·폴더 복사로 옮깁니다.
2. 탐색기에서 더블클릭합니다. 처음 한 번은 압축을 풉니다.
3. 링크를 입력하면 PPT가 만들어집니다. 저장 위치는 실행한 폴더의 `output/`입니다.

| 그 PC에 필요한 것 | 이유 |
| --- | --- |
| Windows 10/11 **64비트** | 이 exe는 Windows x64용입니다 |
| **Edge 또는 Chrome** | 장면 캡처에 씁니다. Win10/11에는 보통 Edge가 있습니다 |
| **인터넷** | Genspark에서 슬라이드를 받습니다 |

- Mac/Linux에서는 실행되지 않습니다.
- Chromium을 exe 안에 넣지 않습니다. 넣으면 200MB를 넘습니다.
- 서명되지 않아서 SmartScreen이 한 번 막을 수 있습니다. **추가 정보 → 실행**이면 됩니다.
- 강제로 내장 Chromium을 쓰려면 개발 환경에서 `GENSPARK_BROWSER=chromium`을 사용하세요.

## 소스에서 설치

Node.js 20 이상이 필요합니다.

```bash
git clone https://github.com/hy040504/GensparkPPTExtractor.git
cd GensparkPPTExtractor
npm install
```

`postinstall`에서 Playwright Chromium을 설치합니다. 실패하면:

```bash
npx playwright install chromium
```

## 지원 URL

| 형식 | 예 |
| --- | --- |
| Genspark Slides | `https://www.genspark.ai/slides?project_id=<uuid>` |
| slides_wrapper | `https://www.genspark.ai/slides_wrapper?project_id=<uuid>` |
| agents | `https://www.genspark.ai/agents?id=<uuid>` |
| 공유 스페이스 | `https://xxxxx.gensparkspace.com/` |

## 동작 방식

```mermaid
flowchart LR
  A[슬라이드 URL] --> B[project_id]
  B --> C["slide_data API"]
  C --> D[장면 HTML + 자산]
  D --> E[Playwright 캡처]
  E --> F[PPTX / PDF / PNG]
```

1. URL에서 `project_id`를 읽습니다.
2. `/api/project/slide_data`로 장면 HTML을 받습니다.
3. 상대 경로 CSS·이미지를 로컬로 받습니다.
4. Edge/Chrome(또는 내장 Chromium)이 디자인 해상도(기본 1920×1080)로 PNG를 찍습니다.
5. `pptxgenjs`가 16:9 전체 화면 이미지 PPT를 만듭니다.

## 대화형 매니저

권장 진입점입니다. 링크를 넣으면 장면을 모아 PPT를 만듭니다.

```bash
npm run auto:manager

# 링크를 바로 넘길 수도 있습니다
npm run auto:manager -- "https://www.genspark.ai/slides?project_id=<uuid>"
```

```
--- 📊 Genspark 슬라이드 PPT 추출 매니저 (TS) ---

[메인 메뉴]
1. 🔗 슬라이드 링크 입력 → PPT 만들기
2. 📁 최근 PPT 열기
3. ⚙️  추출 옵션 (해상도 / 포맷 / 출력 폴더)
0. 종료
```

색상·메뉴 톤은 `seowon-client-api`의 `auto:manager`와 같습니다. 제목은 파랑, 입력 라벨은 청록, 성공은 초록, 진행바는 청록입니다.

## 일회성 CLI

```bash
# PNG + PPTX
npm run extract -- "https://www.genspark.ai/slides?project_id=<uuid>"

# PDF까지
npm run extract -- "<url>" -f png,pptx,pdf

# 일부 장면만, 해상도 지정
npm run extract -- "<url>" -o ./output --scale 2 --slides 1-5

# 비공개 프로젝트
npm run extract -- "<url>" --cookie "session=..."
```

### 옵션

| 옵션 | 설명 | 기본값 |
| --- | --- | --- |
| `-o, --output` | 출력 폴더 | `./output` |
| `-f, --format` | `png`, `pptx`, `pdf` | `png,pptx` |
| `--scale` | 캡처 배율 (1 / 2 / 3) | `2` |
| `--wait` | 폰트·이미지 추가 대기(ms) | `1800` |
| `--slides` | 범위 (`1-5`, `3`) | 전체 |
| `--deck` | 특정 덱 이름만 | — |
| `--cookie` | 인증 Cookie 헤더 | — |
| `--headed` | 브라우저 창 표시 | 꺼짐 |

## 출력

```
output/
├── 발표제목.pptx
├── manifest.json
├── html/
│   ├── slide_01_cover.html
│   └── assets/
└── images/
    ├── slide_01_cover.png
    └── ...
```

PPT의 각 슬라이드는 캡처 이미지가 꽉 차게 들어가므로, 화면에서 본 레이아웃이 그대로 유지됩니다.

## 코드에서 쓰기

```ts
import { createExtractorClient } from "./src/index.ts";

const client = createExtractorClient({ outputDir: "./output", scale: 2 });
const result = await client.extract(
  "https://www.genspark.ai/slides?project_id=<uuid>"
);

console.log(result.pptxPath);
```

예제: `npx tsx examples/basic.ts <슬라이드 URL>`

## 프로젝트 구조

```
cli/                  인터랙티브·일회성 CLI
  auto-manager.ts
  extract.ts
  launch-manager.ts   단일 exe 진입점
scripts/
  build-exe.mjs       Windows exe 패키징
src/
  index.ts            팩토리 + 공개 API
  utils.ts            공통 헬퍼
  cli-ui.ts           매니저 색상/프롬프트
  logger.ts
  types/              인터페이스만
  slides/             URL · API · HTML · 캡처 · 파이프라인
  export/             PPTX / PDF
examples/basic.ts
docs/architecture.md
```

모듈 역할과 주석 규칙은 [`docs/architecture.md`](./docs/architecture.md)를 참고하세요.

## 주의

- 공개된 프로젝트 링크, 또는 **본인 계정 Cookie**가 있는 프로젝트만 추출하세요.
- 폰트가 깨지면 `--wait 4000`으로 대기 시간을 늘리세요.
- 한글은 Pretendard / Noto Sans KR 웹폰트를 주입해 렌더합니다.
- `output/`, `release/`, Cookie는 git에 올리지 않습니다.

## 라이선스

[MIT](./LICENSE)
