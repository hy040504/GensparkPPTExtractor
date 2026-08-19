/**
 * 장면 HTML 보정·로컬 저장.
 *
 * 상대 자산 경로를 절대 URL 로 고친 뒤, 가능하면 파일을 받아
 * Playwright 가 file:// 로 안정적으로 렌더하게 만든다.
 */

import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { NormalizedSlide, SlideDeck } from "../types/slides.js";
import { KEEP_REMOTE_ASSET_RE, SLIDE_FONT_HREFS } from "./constants.js";
import { httpGetBuffer } from "./http.js";

const FONT_LINKS = SLIDE_FONT_HREFS.map((href) => `<link rel="stylesheet" href="${href}">`).join("\n");

const RESET_STYLE = `<style>
  html, body { margin: 0; padding: 0; overflow: hidden; background: #fff; }
  .slide-container { margin: 0 !important; }
</style>`;

/**
 * 상대 자산 경로를 절대 URL 로 바꾸고 웹폰트/리셋을 주입한다.
 * @param {SlideDeck} deck - 소속 덱
 * @param {NormalizedSlide} slide - 대상 장면
 * @returns {string} 브라우저에서 바로 열 수 있는 HTML
 */
export function rewriteSlideHtml(deck: SlideDeck, slide: NormalizedSlide): string {
  let html = slide.html;
  const assetBase = resolveAssetBase(deck, slide);

  html = html.replace(
    /((?:href|src)=["'])(\.\.\/assets\/|assets\/|\.\/assets\/)([^"']+)(["'])/gi,
    (_full, prefix: string, _rel: string, file: string, suffix: string) =>
      `${prefix}${assetBase}${file}${suffix}`
  );

  html = html.replace(
    /url\(\s*(['"]?)(\.\.\/assets\/|assets\/|\.\/assets\/)([^'")]+)\1\s*\)/gi,
    (_full, quote: string, _rel: string, file: string) => `url(${quote}${assetBase}${file}${quote})`
  );

  if (!/<link[^>]+pretendard/i.test(html)) {
    html = injectHead(html, `${FONT_LINKS}\n${RESET_STYLE}`);
  } else {
    html = injectHead(html, RESET_STYLE);
  }

  return html;
}

/**
 * 장면을 로컬 HTML 로 저장하고 자산을 옆에 받는다.
 * @param {SlideDeck} deck - 소속 덱
 * @param {NormalizedSlide} slide - 대상 장면
 * @param {string} htmlDir - html 출력 폴더
 * @param {string} [cookie] - 자산 다운로드용 Cookie
 * @returns {Promise<string>} 저장된 HTML 절대 경로
 */
export async function saveSlideHtml(
  deck: SlideDeck,
  slide: NormalizedSlide,
  htmlDir: string,
  cookie?: string
): Promise<string> {
  await mkdir(htmlDir, { recursive: true });
  const rewritten = await localizeAssets(rewriteSlideHtml(deck, slide), htmlDir, cookie);
  const filePath = path.join(htmlDir, padSlideName(slide.index, slide.filename));
  await writeFile(filePath, rewritten, "utf8");
  return filePath;
}

/**
 * 장면 번호를 붙인 안전한 파일명을 만든다.
 * @param {number} index - 장면 번호
 * @param {string} filename - 원본 파일명
 * @returns {string} slide_01_cover.html 형식
 */
export function padSlideName(index: number, filename: string): string {
  const ext = path.extname(filename) || ".html";
  const stem = path.basename(filename, ext).replace(/[^\w.-]+/g, "_");
  return `slide_${String(index).padStart(2, "0")}_${stem}${ext}`;
}

/**
 * 원격 자산을 html/assets 로 받고 경로를 상대 경로로 바꾼다.
 * 웹폰트 CDN 은 그대로 둔다.
 * @param {string} html - 절대 URL 이 들어간 HTML
 * @param {string} htmlDir - html 출력 폴더
 * @param {string} [cookie] - Cookie 헤더
 * @returns {Promise<string>} 로컬 경로가 반영된 HTML
 */
async function localizeAssets(html: string, htmlDir: string, cookie?: string): Promise<string> {
  const assetsDir = path.join(htmlDir, "assets");
  await mkdir(assetsDir, { recursive: true });

  const remoteUrls = new Set<string>();
  for (const match of html.matchAll(/(?:href|src)=["'](https?:\/\/[^"']+)["']/gi)) {
    remoteUrls.add(match[1]!);
  }
  for (const match of html.matchAll(/url\(\s*['"]?(https?:\/\/[^'")]+)['"]?\s*\)/gi)) {
    remoteUrls.add(match[1]!);
  }

  let localized = html;
  for (const url of remoteUrls) {
    if (KEEP_REMOTE_ASSET_RE.test(url)) continue;
    const filename = safeAssetName(url);
    const dest = path.join(assetsDir, filename);
    if (!(await fileExists(dest))) {
      try {
        await writeFile(dest, await httpGetBuffer(url, { cookie }));
      } catch {
        // 개별 자산 실패는 장면을 버리지 않고 원격 URL 을 유지한다.
        continue;
      }
    }
    localized = localized.split(url).join(`./assets/${filename}`);
  }
  return localized;
}

/**
 * URL 마지막 세그먼트를 파일명으로 쓴다.
 * @param {string} url - 자산 URL
 * @returns {string} 안전한 파일명
 */
function safeAssetName(url: string): string {
  try {
    const parsed = new URL(url);
    const base = path.basename(parsed.pathname) || "asset";
    return base.replace(/[^\w.-]+/g, "_");
  } catch {
    return `asset_${Math.random().toString(36).slice(2, 8)}`;
  }
}

/**
 * 경로 존재 여부를 확인한다.
 * @param {string} filePath - 검사할 경로
 * @returns {Promise<boolean>} 존재하면 true
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 장면 HTML 기준 자산 디렉터리 절대 URL 을 계산한다.
 * @param {SlideDeck} deck - 소속 덱
 * @param {NormalizedSlide} slide - 대상 장면
 * @returns {string} .../assets/ 로 끝나는 절대 URL
 */
function resolveAssetBase(deck: SlideDeck, slide: NormalizedSlide): string {
  if (slide.cdnUrl) {
    try {
      const url = new URL(slide.cdnUrl);
      url.search = "";
      url.hash = "";
      const trimmed = url.pathname.replace(/\/slides\/[^/]+$/, "");
      url.pathname = `${trimmed}/assets/`;
      return url.toString();
    } catch {
      // cdn_url 이 깨져 있으면 git API 규칙으로 내린다.
    }
  }

  if (deck.projectId && slide.deck) {
    return `${deck.origin}/api/slides_git/projects/${deck.projectId}/decks/${slide.deck}/assets/`;
  }

  return `${deck.origin}/`;
}

/**
 * <head> 가 있으면 그 안에, 없으면 만들어 스니펫을 넣는다.
 * @param {string} html - 원본 HTML
 * @param {string} snippet - 주입할 마크업
 * @returns {string} 주입된 HTML
 */
function injectHead(html: string, snippet: string): string {
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (tag) => `${tag}\n${snippet}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (tag) => `${tag}\n<head>${snippet}</head>`);
  }
  return `<!doctype html><html><head>${snippet}</head><body>${html}</body></html>`;
}
