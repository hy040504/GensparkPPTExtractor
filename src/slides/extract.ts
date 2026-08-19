/**
 * 추출 파이프라인 오케스트레이터.
 *
 * URL 분석 → API 수집 → HTML 저장 → 캡처 → PPTX/PDF.
 * 세션 상태는 갖지 않고, 옵션 객체만 받아 한 번 실행한다.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildPdf } from "../export/pdf.js";
import { buildPptx } from "../export/pptx.js";
import { log, setQuiet } from "../logger.js";
import type { ExtractOptions, ExtractProgress, ExtractResult } from "../types/extract.js";
import type { NormalizedSlide } from "../types/slides.js";
import { captureSlides } from "./capture.js";
import { loadSlideDeck } from "./fetch.js";
import { saveSlideHtml } from "./html.js";
import { parseSlideUrl } from "./parse-url.js";

/**
 * 진행 콜백이 있으면 한 번 호출한다.
 * @param {ExtractOptions} options - 파이프라인 옵션
 * @param {ExtractProgress} progress - 진행 페이로드
 * @returns {void} 반환값 없음
 */
function emit(options: ExtractOptions, progress: ExtractProgress): void {
  options.onProgress?.(progress);
}

/**
 * 슬라이드 URL 을 받아 장면 캡처와 산출물을 만든다.
 * @param {ExtractOptions} options - 추출 옵션
 * @returns {Promise<ExtractResult>} 출력 경로가 채워진 결과
 */
export async function extractSlides(options: ExtractOptions): Promise<ExtractResult> {
  const previousQuiet = setQuiet(Boolean(options.quiet));
  try {
    return await extractSlidesInner(options);
  } finally {
    setQuiet(previousQuiet);
  }
}

/**
 * quiet 플래그가 적용된 상태에서 실제 파이프라인을 돌린다.
 * @param {ExtractOptions} options - 추출 옵션
 * @returns {Promise<ExtractResult>} 추출 결과
 */
async function extractSlidesInner(options: ExtractOptions): Promise<ExtractResult> {
  const parsed = parseSlideUrl(options.url);
  log.step("슬라이드 사이트 분석");
  log.info(`종류: ${parsed.kind}`);
  log.info(`원본: ${parsed.originalUrl}`);
  if (parsed.projectId) log.info(`project_id: ${parsed.projectId}`);
  emit(options, {
    phase: "analyze",
    message: `링크 분석 중 (${parsed.kind})`
  });

  emit(options, { phase: "fetch", message: "슬라이드 데이터 수집 중" });
  const deck = await loadSlideDeck(parsed, options.cookie);
  const slides = selectSlides(deck.slides, options);

  log.ok(`제목: ${deck.title}`);
  log.ok(`장면 수: ${slides.length} / ${deck.slides.length}  (캔버스 ${deck.canvas.width}×${deck.canvas.height})`);
  emit(options, {
    phase: "fetch",
    message: `${deck.title} · ${slides.length}장 · ${deck.canvas.width}×${deck.canvas.height}`,
    current: slides.length,
    total: deck.slides.length
  });

  await mkdir(options.outputDir, { recursive: true });
  const htmlDir = path.join(options.outputDir, "html");
  const htmlPaths = new Map<number, string>();

  log.step("장면 HTML 저장");
  for (const [i, slide] of slides.entries()) {
    emit(options, {
      phase: "save-html",
      message: "장면 HTML 저장",
      current: i + 1,
      total: slides.length,
      slideTitle: slide.title
    });
    htmlPaths.set(slide.index, await saveSlideHtml(deck, slide, htmlDir, options.cookie));
  }
  log.ok(`${slides.length}개 HTML 저장 → ${htmlDir}`);

  await writeFile(
    path.join(options.outputDir, "manifest.json"),
    JSON.stringify(
      {
        title: deck.title,
        projectId: deck.projectId,
        origin: deck.origin,
        canvas: deck.canvas,
        source: parsed.originalUrl,
        slides: slides.map((slide) => ({
          index: slide.index,
          title: slide.title,
          filename: slide.filename,
          cdnUrl: slide.cdnUrl
        }))
      },
      null,
      2
    ),
    "utf8"
  );

  log.step("장면 스크린샷");
  const images = await captureSlides(deck, slides, htmlPaths, options);
  log.ok(`${images.length}장 PNG 저장 → ${path.join(options.outputDir, "images")}`);

  const result: ExtractResult = {
    deck,
    outputDir: options.outputDir,
    images
  };

  if (options.formats.includes("pptx")) {
    log.step("PPTX 생성");
    emit(options, { phase: "pptx", message: "PPTX 생성 중" });
    result.pptxPath = await buildPptx(deck, images, options.outputDir);
    log.ok(result.pptxPath);
  }

  if (options.formats.includes("pdf")) {
    log.step("PDF 생성");
    emit(options, { phase: "pdf", message: "PDF 생성 중" });
    result.pdfPath = await buildPdf(deck, images, options.outputDir);
    log.ok(result.pdfPath);
  }

  log.step("완료");
  log.ok(`출력 폴더: ${path.resolve(options.outputDir)}`);
  emit(options, {
    phase: "done",
    message: "추출 완료",
    current: images.length,
    total: images.length
  });
  return result;
}

/**
 * 덱/범위 옵션으로 장면을 거른다.
 * @param {NormalizedSlide[]} slides - 전체 장면
 * @param {ExtractOptions} options - deck / slideRange
 * @returns {NormalizedSlide[]} 선택된 장면
 * @throws {Error} 조건에 맞는 장면이 없을 때
 */
function selectSlides(slides: NormalizedSlide[], options: ExtractOptions): NormalizedSlide[] {
  let selected = slides;
  if (options.deck) {
    selected = selected.filter((slide) => slide.deck === options.deck);
  }
  if (options.slideRange) {
    selected = selected.filter(
      (slide) => slide.index >= options.slideRange!.from && slide.index <= options.slideRange!.to
    );
  }
  if (!selected.length) {
    throw new Error("선택한 조건에 맞는 슬라이드가 없습니다.");
  }
  return selected;
}
