# 구조

`genspark-ppt-extractor`는 seowon-client-api 와 같은 작은 TypeScript 패키지 구조로 구성합니다.

- `src/`: 외부로 공개할 패키지 소스 코드
- `cli/`: 인터랙티브·일회성 CLI 진입점 (auto-manager, extract)
- `examples/`: 실행 가능한 사용 예시
- `docs/`: 프로젝트 구조 메모
- `output/`: 런타임 생성물 (gitignore)

패키지는 먼저 클라이언트 팩토리(`createExtractorClient`)를 공개합니다. 이후 고수준 모듈은 URL을 여기저기에서 직접 부르지 않고, 이 클라이언트 또는 `extractSlides()`를 기반으로 확장합니다.

## 모듈 역할

| 구분 | 경로 | 역할 |
| ---- | ---- | ---- |
| 공개 API | `src/index.ts` | 팩토리와 재수출 |
| 공통 유틸 | `src/utils.ts`, `src/cli-ui.ts`, `src/logger.ts` | 파일명·색상·로그. 도메인이 서로를 직접 참조하지 않게 한다 |
| 타입 | `src/types/` | 인터페이스만. 구현 파일에 공개 타입을 흩뿌리지 않는다 |
| 슬라이드 도메인 | `src/slides/` | URL 파싱, API, HTML 보정, 캡처, 파이프라인 |
| 산출물 | `src/export/` | PPTX / PDF. 캡처 PNG 를 입력으로만 받는다 |
| CLI | `cli/auto-manager.ts`, `cli/extract.ts` | 인터랙티브 매니저 / 일회성 인자 CLI |
| 단일 exe | `scripts/build-exe.mjs` | tsc + 프로덕션 deps + caxa. 내장 Chromium 은 넣지 않음 |

## slides 모듈

- `constants.ts`: origin, API 경로, 웹폰트, User-Agent
- `http.ts`: curl 우선 GET (Cloudflare 403 회피)
- `parse-url.ts`: project_id / 장면 범위
- `fetch.ts`: `slide_data` → `SlideDeck` 정규화
- `html.ts`: 상대 자산 경로 보정, 로컬 저장
- `capture.ts`: Playwright PNG
- `extract.ts`: 오케스트레이터. 세션 상태 없음

## 주석 규칙

seowon-client-api 와 맞춘다.

- 파일 상단: 모듈이 **무엇을 하고 무엇을 하지 않는지**
- 함수: 한국어 JSDoc + `@param {type}` + `@returns` (+ 필요 시 `@throws`)
- 인터페이스 필드: 인라인 `// 설명`
- 구현 주석: 동작의 **이유** (Cloudflare, file://, poster fallback)
