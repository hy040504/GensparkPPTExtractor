/**
 * 슬라이드 사이트 분석·정규화에 쓰는 공통 타입.
 * 추출 파이프라인 옵션은 `types/extract.ts` 에 둔다.
 */

/** 지원하는 슬라이드 호스트 종류 */
export type SlideSiteKind = "genspark-ai" | "genspark-space" | "generic-html";

/** URL 파서가 돌려주는 정규화 결과 */
export interface ParsedSlideUrl {
  kind: SlideSiteKind; // 호스트 분류
  originalUrl: string; // 사용자가 넣은 원본 URL
  origin: string; // API 호출에 쓸 origin
  projectId?: string; // Genspark 프로젝트 UUID
}

/** 슬라이드 캔버스 픽셀 크기 */
export interface CanvasSize {
  width: number; // 가로(px)
  height: number; // 세로(px)
}

/** API/HTML에서 뽑은 한 장면 */
export interface NormalizedSlide {
  index: number; // 1부터 시작하는 장면 번호
  filename: string; // 원본 파일명 (cover.html 등)
  title: string; // <title> 또는 fallback
  deck?: string; // 덱 이름 (slides_agent_git)
  html: string; // 장면 HTML 원문
  cdnUrl?: string; // 서버가 내려준 장면 CDN URL
  posterUrl?: string; // 렌더 실패 시 대체 포스터
}

/** 한 프로젝트의 슬라이드 묶음 */
export interface SlideDeck {
  title: string; // 발표 제목
  projectId?: string; // project_id
  origin: string; // 자산 절대경로 기준 origin
  canvas: CanvasSize; // 디자인 해상도
  slides: NormalizedSlide[]; // 정규화된 장면 목록
  currentDeck?: string; // 현재 덱 이름
}

/** Playwright 캡처가 끝난 장면 */
export interface CapturedSlide {
  index: number; // 장면 번호
  title: string; // 장면 제목
  filename: string; // 원본 HTML 파일명
  htmlPath: string; // 로컬 저장 HTML 경로
  imagePath: string; // 캡처 PNG 경로
}
