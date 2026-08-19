/**
 * Playwright 장면 캡처.
 *
 * 로컬 HTML 을 디자인 해상도 뷰포트로 렌더하고 PNG 로 찍는다.
 * CDN 직접 이동은 networkidle 에 묶이는 경우가 많아 보조 경로다.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { type Page } from "playwright";
import { log } from "../logger.js";
import { errorMessage } from "../utils.js";
import type { ExtractOptions } from "../types/extract.js";
import type { CapturedSlide, NormalizedSlide, SlideDeck } from "../types/slides.js";
import { launchChromium } from "./browser.js";
import { SLIDE_FONT_HREFS } from "./constants.js";
import { padSlideName, rewriteSlideHtml } from "./html.js";
import { httpGetBuffer } from "./http.js";

/**
 * 장면 목록을 순서대로 스크린샷한다.
 * @param {SlideDeck} deck - 캔버스 크기를 가진 덱
 * @param {NormalizedSlide[]} slides - 캡처할 장면
 * @param {Map<number, string>} htmlPaths - index → 로컬 HTML 경로
 * @param {ExtractOptions} options - 배율·대기·진행 콜백
 * @returns {Promise<CapturedSlide[]>} 저장된 PNG 정보
 */
export async function captureSlides(
  deck: SlideDeck,
  slides: NormalizedSlide[],
  htmlPaths: Map<number, string>,
  options: ExtractOptions
): Promise<CapturedSlide[]> {
  const imageDir = path.join(options.outputDir, "images");
  await mkdir(imageDir, { recursive: true });

  const browser = await launchChromium(options.headed);
  const captured: CapturedSlide[] = [];

  try {
    const context = await browser.newContext({
      viewport: { width: deck.canvas.width, height: deck.canvas.height },
      deviceScaleFactor: options.scale,
      extraHTTPHeaders: options.cookie ? { Cookie: options.cookie } : undefined
    });
    const page = await context.newPage();

    for (const [i, slide] of slides.entries()) {
      const imageName = padSlideName(slide.index, slide.filename).replace(/\.html?$/i, ".png");
      const imagePath = path.join(imageDir, imageName);
      log.info(`[${i + 1}/${slides.length}] ${slide.title}`);
      options.onProgress?.({
        phase: "capture",
        message: "장면 스크린샷",
        current: i + 1,
        total: slides.length,
        slideTitle: slide.title
      });

      const ok = await renderSlide(page, deck, slide, htmlPaths.get(slide.index), options);
      if (!ok) {
        await fallbackPoster(slide, imagePath, options.cookie);
      } else {
        await page.screenshot({
          path: imagePath,
          fullPage: false,
          type: "png",
          animations: "disabled"
        });
      }

      captured.push({
        index: slide.index,
        title: slide.title,
        filename: slide.filename,
        htmlPath: htmlPaths.get(slide.index) ?? "",
        imagePath
      });
    }

    await context.close();
  } finally {
    await browser.close();
  }

  return captured;
}

/**
 * 로컬 HTML 을 우선 렌더하고, 실패하면 CDN URL 로 재시도한다.
 * @param {Page} page - Playwright 페이지
 * @param {SlideDeck} deck - 캔버스 정보
 * @param {NormalizedSlide} slide - 대상 장면
 * @param {string | undefined} localHtmlPath - 로컬 HTML
 * @param {ExtractOptions} options - 대기 시간
 * @returns {Promise<boolean>} 렌더 성공 여부
 */
async function renderSlide(
  page: Page,
  deck: SlideDeck,
  slide: NormalizedSlide,
  localHtmlPath: string | undefined,
  options: ExtractOptions
): Promise<boolean> {
  const nav = { waitUntil: "load" as const, timeout: 45_000 };

  try {
    if (localHtmlPath) {
      await page.goto(pathToFileURL(localHtmlPath).toString(), nav);
    } else {
      await page.setContent(rewriteSlideHtml(deck, slide), nav);
    }

    await injectFonts(page);
    await waitForVisualReady(page, options.waitMs);
    await fitSlideToViewport(page, deck.canvas.width, deck.canvas.height);
    return true;
  } catch (error) {
    log.warn(`${slide.filename} 로컬 렌더 실패: ${errorMessage(error)}`);
    if (!slide.cdnUrl) return false;
    try {
      await page.goto(slide.cdnUrl, nav);
      await injectFonts(page);
      await waitForVisualReady(page, options.waitMs);
      await fitSlideToViewport(page, deck.canvas.width, deck.canvas.height);
      return true;
    } catch (cdnError) {
      log.warn(`${slide.filename} CDN 렌더 실패: ${errorMessage(cdnError)}`);
      return false;
    }
  }
}

/**
 * chrome.css 에 @font-face 가 없을 때를 대비해 웹폰트를 주입한다.
 * @param {Page} page - Playwright 페이지
 * @returns {Promise<void>} 주입 시도 완료
 */
async function injectFonts(page: Page): Promise<void> {
  for (const href of SLIDE_FONT_HREFS) {
    await page.addStyleTag({ url: href }).catch(() => undefined);
  }
}

/**
 * 웹폰트·이미지 로딩과 추가 대기를 끝낸다.
 * @param {Page} page - Playwright 페이지
 * @param {number} waitMs - 추가 대기(ms)
 * @returns {Promise<void>} 준비 완료
 */
async function waitForVisualReady(page: Page, waitMs: number): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images).map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        });
      })
    );
  });

  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

/**
 * 디자인 크기 컨테이너를 뷰포트에 맞게 스케일한다.
 * @param {Page} page - Playwright 페이지
 * @param {number} designWidth - 디자인 가로
 * @param {number} designHeight - 디자인 세로
 * @returns {Promise<void>} 스케일 적용 완료
 */
async function fitSlideToViewport(page: Page, designWidth: number, designHeight: number): Promise<void> {
  await page.evaluate(
    ({ designWidth: w, designHeight: h }) => {
      const root =
        (document.querySelector(".slide-container") as HTMLElement | null) ??
        (document.body.firstElementChild as HTMLElement | null);
      if (!root) return;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const scale = Math.min(vw / w, vh / h);
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      document.body.style.margin = "0";
      document.body.style.background = getComputedStyle(root).backgroundColor || "#fff";
      root.style.transformOrigin = "top left";
      root.style.transform = `scale(${scale})`;
    },
    { designWidth, designHeight }
  );
}

/**
 * 렌더 실패 시 poster_url 이미지를 그대로 저장한다.
 * @param {NormalizedSlide} slide - posterUrl 이 있는 장면
 * @param {string} imagePath - 저장 경로
 * @param {string} [cookie] - Cookie 헤더
 * @returns {Promise<void>} 저장 완료
 * @throws {Error} poster 도 없을 때
 */
async function fallbackPoster(slide: NormalizedSlide, imagePath: string, cookie?: string): Promise<void> {
  if (!slide.posterUrl) {
    throw new Error(`${slide.filename} 스크린샷과 poster 모두 실패했습니다.`);
  }
  log.warn(`${slide.filename}: poster 이미지로 대체합니다.`);
  const buf = await httpGetBuffer(slide.posterUrl, { cookie });
  await writeFile(imagePath, buf);
}
