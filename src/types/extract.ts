import type { CapturedSlide, SlideDeck } from "./slides.js";

/** 추출 산출물 포맷 */
export type OutputFormat = "png" | "pptx" | "pdf";

/** 파이프라인 단계. auto:manager 진행바 라벨로도 쓴다. */
export type ExtractPhase =
  | "analyze"
  | "fetch"
  | "save-html"
  | "capture"
  | "pptx"
  | "pdf"
  | "done";

/** 장면 번호 범위 (양쪽 포함) */
export interface SlideRange {
  from: number; // 시작 장면 (1-base)
  to: number; // 끝 장면 (1-base)
}

/** 추출 진행 콜백 페이로드 */
export interface ExtractProgress {
  phase: ExtractPhase; // 현재 단계
  message: string; // 사람용 상태 문구
  current?: number; // 현재 처리 번호
  total?: number; // 전체 개수
  slideTitle?: string; // 현재 장면 제목
}

/**
 * 추출 파이프라인 옵션.
 * CLI / auto:manager / 라이브러리 팩토리가 같은 타입을 쓴다.
 */
export interface ExtractOptions {
  url: string; // 슬라이드 페이지 URL
  outputDir: string; // 출력 폴더
  formats: OutputFormat[]; // 만들 포맷
  scale: number; // Playwright deviceScaleFactor
  waitMs: number; // 장면당 추가 대기(ms)
  headed: boolean; // true면 브라우저 창 표시
  cookie?: string; // 비공개 프로젝트 Cookie 헤더
  deck?: string; // 특정 덱만
  slideRange?: SlideRange; // 장면 범위
  quiet?: boolean; // 기본 로그 숨김 (매니저가 UI를 맡을 때)
  onProgress?: (progress: ExtractProgress) => void; // 진행 콜백
}

/** 추출 완료 결과 */
export interface ExtractResult {
  deck: SlideDeck; // 정규화된 덱
  outputDir: string; // 실제 출력 폴더
  images: CapturedSlide[]; // 캡처된 장면
  pptxPath?: string; // 생성된 PPTX 경로
  pdfPath?: string; // 생성된 PDF 경로
}
