/**
 * genspark-ppt-extractor 라이브러리 엔트리 포인트.
 * 슬라이드 수집·캡처·PPT 생성의 공개 인터페이스를 한곳에서 내보낸다.
 */

import path from "node:path";
import { extractSlides } from "./slides/extract.js";
import type { ExtractorClient, ExtractorClientOptions } from "./types/client.js";
import type { ExtractOptions, OutputFormat } from "./types/extract.js";

export type { ExtractorClient, ExtractorClientOptions } from "./types/client.js";
export type {
  ExtractOptions,
  ExtractPhase,
  ExtractProgress,
  ExtractResult,
  OutputFormat,
  SlideRange
} from "./types/extract.js";
export type {
  CanvasSize,
  CapturedSlide,
  NormalizedSlide,
  ParsedSlideUrl,
  SlideDeck,
  SlideSiteKind
} from "./types/slides.js";

export { errorMessage, parseFormats, sanitizeFilename, toAbsoluteUrl } from "./utils.js";
export {
  ANSI,
  ask,
  color,
  getProgressBar,
  openLocalFile,
  pickFromList,
  printErrorMessage,
  printInfo,
  printSection,
  printSuccess,
  printWarning
} from "./cli-ui.js";

const DEFAULT_OUTPUT_DIR = "./output";
const DEFAULT_FORMATS: OutputFormat[] = ["png", "pptx"];
const DEFAULT_SCALE = 2;
const DEFAULT_WAIT_MS = 1500;

/**
 * 슬라이드 추출 클라이언트를 만드는 팩토리.
 * seowon-client-api 의 createEcampusClient 와 같이 기본값을 묶고 extract() 만 노출한다.
 * @param {ExtractorClientOptions} [options={}] - 세션 기본 옵션
 * @returns {ExtractorClient} extract() 를 가진 클라이언트
 */
export function createExtractorClient(options: ExtractorClientOptions = {}): ExtractorClient {
  const outputDir = path.resolve(options.outputDir ?? DEFAULT_OUTPUT_DIR);
  const formats = options.formats ?? DEFAULT_FORMATS;
  const scale = options.scale ?? DEFAULT_SCALE;
  const waitMs = options.waitMs ?? DEFAULT_WAIT_MS;
  const headed = options.headed ?? false;
  const cookie = options.cookie;

  return {
    outputDir,
    /**
     * 슬라이드 URL을 받아 PNG/PPTX/PDF 를 만든다.
     * @param {string} url - Genspark 슬라이드 링크
     * @param {Partial<ExtractOptions>} [overrides] - 호출마다 덮어쓸 옵션
     * @returns {Promise<ExtractResult>} 추출 결과
     */
    extract(url, overrides = {}) {
      const merged: ExtractOptions = {
        url,
        outputDir,
        formats,
        scale,
        waitMs,
        headed,
        cookie,
        ...overrides
      };
      return extractSlides(merged);
    }
  };
}

// --- 핵심 비즈니스 로직 모듈 통합 수출 (Public API Surface) ---

export { extractSlides } from "./slides/extract.js";
export { loadSlideDeck } from "./slides/fetch.js";
export { parseSlideRange, parseSlideUrl } from "./slides/parse-url.js";
export { captureSlides } from "./slides/capture.js";
export { rewriteSlideHtml, saveSlideHtml } from "./slides/html.js";
export { buildPptx } from "./export/pptx.js";
export { buildPdf } from "./export/pdf.js";
export {
  DEFAULT_BROWSER_USER_AGENT,
  DEFAULT_CANVAS,
  DEFAULT_GENSPARK_ORIGIN,
  SLIDE_DATA_PATH
} from "./slides/constants.js";
