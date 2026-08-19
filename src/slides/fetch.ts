/**
 * 슬라이드 데이터 수집.
 *
 * `/api/project/slide_data` 응답을 SlideDeck 으로 정규화한다.
 * HTML 렌더·캡처는 하지 않는다.
 */

import type { NormalizedSlide, ParsedSlideUrl, SlideDeck } from "../types/slides.js";
import { log } from "../logger.js";
import { toAbsoluteUrl } from "../utils.js";
import { DEFAULT_CANVAS, PROJECT_ID_RE, SLIDE_DATA_PATH } from "./constants.js";
import { httpGetText } from "./http.js";

/** slide_data API 의 장면 항목 (서버 필드명 그대로) */
interface RawSlide {
  index?: number;
  deck?: string;
  filename?: string;
  content?: string;
  html?: string;
  cdn_url?: string;
  poster_url?: string;
  title?: string;
}

/** slide_data API 최상위 페이로드 */
interface RawApiPayload {
  status?: number;
  message?: string;
  data?: {
    meta_data?: Record<string, unknown>;
    file_contents?: RawSlide[];
  };
}

/**
 * 파싱된 URL로 전체 덱을 가져온다.
 * @param {ParsedSlideUrl} parsed - parseSlideUrl 결과
 * @param {string} [cookie] - 비공개 프로젝트 Cookie
 * @returns {Promise<SlideDeck>} 정규화된 덱
 * @throws {Error} API 오류이거나 장면 HTML 이 비었을 때
 */
export async function loadSlideDeck(parsed: ParsedSlideUrl, cookie?: string): Promise<SlideDeck> {
  if (parsed.kind === "generic-html") {
    return loadGenericHtmlDeck(parsed, cookie);
  }

  const projectId = await resolveProjectId(parsed, cookie);
  const apiUrl = `${parsed.origin}${SLIDE_DATA_PATH}?project_id=${projectId}`;
  log.info(`슬라이드 API: ${apiUrl}`);

  const raw = JSON.parse(await httpGetText(apiUrl, { cookie, accept: "application/json" })) as RawApiPayload;
  if (typeof raw.status === "number" && raw.status !== 0) {
    throw new Error(`슬라이드 API 오류: ${raw.message ?? "알 수 없는 응답"}`);
  }

  const data = raw.data;
  if (!data?.file_contents?.length) {
    throw new Error("슬라이드 데이터가 비어 있습니다. 공개 링크인지, project_id가 맞는지 확인하세요.");
  }

  const meta = (data.meta_data ?? {}) as Record<string, unknown>;
  const canvas = readCanvas(meta);
  const currentDeck = pickString(meta, ["current_deck", "currentDeck"]);
  const title = pickString(meta, ["title", "file_name", "file_prefix"]) ?? "Genspark Slides";

  const slides = data.file_contents
    .map((item, i) => normalizeSlide(item, i, parsed.origin))
    .filter((slide) => slide.html.trim().length > 0)
    .sort((a, b) => a.index - b.index);

  if (!slides.length) {
    throw new Error("렌더링할 HTML 슬라이드를 찾지 못했습니다.");
  }

  return {
    title,
    projectId,
    origin: parsed.origin,
    canvas,
    slides,
    currentDeck
  };
}

/**
 * URL에 없으면 페이지 HTML 에서 UUID 를 찾는다.
 * @param {ParsedSlideUrl} parsed - 파싱된 URL
 * @param {string} [cookie] - Cookie 헤더
 * @returns {Promise<string>} project_id
 */
async function resolveProjectId(parsed: ParsedSlideUrl, cookie?: string): Promise<string> {
  if (parsed.projectId) return parsed.projectId;

  log.info(`페이지에서 project_id 추출 중: ${parsed.originalUrl}`);
  const html = await httpGetText(parsed.originalUrl, { cookie, accept: "text/html" });
  const match = html.match(PROJECT_ID_RE);
  if (!match) {
    throw new Error("페이지 HTML에서 project_id(UUID)를 찾지 못했습니다.");
  }
  return match[0];
}

/**
 * API 장면 항목을 NormalizedSlide 로 맞춘다.
 * @param {RawSlide} item - API 원본
 * @param {number} fallbackIndex - index 가 없을 때 쓸 0-base 위치
 * @param {string} origin - 상대 CDN 경로용 origin
 * @returns {NormalizedSlide} 정규화된 장면
 */
function normalizeSlide(item: RawSlide, fallbackIndex: number, origin: string): NormalizedSlide {
  const html = item.content ?? item.html ?? "";
  const index = Number(item.index ?? fallbackIndex + 1);
  const filename = item.filename ?? `slide_${String(index).padStart(2, "0")}.html`;
  return {
    index,
    filename,
    title: item.title || extractTitle(html) || `Slide ${index}`,
    deck: item.deck,
    html,
    cdnUrl: toAbsoluteUrl(origin, item.cdn_url),
    posterUrl: toAbsoluteUrl(origin, item.poster_url)
  };
}

/**
 * HTML <title> 을 읽는다.
 * @param {string} html - 장면 HTML
 * @returns {string | undefined} 정리된 제목
 */
function extractTitle(html: string): string | undefined {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  return match?.[1]?.replace(/\s+/g, " ").trim() || undefined;
}

/**
 * meta_data 에서 캔버스 크기를 읽는다.
 * @param {Record<string, unknown>} meta - API meta_data
 * @returns {{ width: number; height: number }} 유효한 픽셀 크기
 */
function readCanvas(meta: Record<string, unknown>): { width: number; height: number } {
  const canvas = (meta.canvas ?? {}) as Record<string, unknown>;
  const width = Number(canvas.width ?? meta.width ?? DEFAULT_CANVAS.width);
  const height = Number(canvas.height ?? meta.height ?? DEFAULT_CANVAS.height);
  return {
    width: Number.isFinite(width) && width > 0 ? width : DEFAULT_CANVAS.width,
    height: Number.isFinite(height) && height > 0 ? height : DEFAULT_CANVAS.height
  };
}

/**
 * 객체에서 첫 번째 비어 있지 않은 문자열 필드를 고른다.
 * @param {Record<string, unknown>} meta - 탐색 대상
 * @param {string[]} keys - 우선순위 키
 * @returns {string | undefined} 찾은 문자열
 */
function pickString(meta: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

/**
 * slide_data 가 없는 일반 HTML 페이지를 한 장짜리 덱으로 감싼다.
 * @param {ParsedSlideUrl} parsed - 원본 URL
 * @param {string} [cookie] - Cookie 헤더
 * @returns {Promise<SlideDeck>} 단일 장면 덱
 */
async function loadGenericHtmlDeck(parsed: ParsedSlideUrl, cookie?: string): Promise<SlideDeck> {
  const html = await httpGetText(parsed.originalUrl, { cookie, accept: "text/html" });
  const title = extractTitle(html) ?? "HTML Slides";
  return {
    title,
    origin: parsed.origin,
    canvas: { width: DEFAULT_CANVAS.width, height: DEFAULT_CANVAS.height },
    slides: [
      {
        index: 1,
        filename: "slide.html",
        title,
        html,
        cdnUrl: parsed.originalUrl
      }
    ]
  };
}
