/**
 * 프로젝트 공통 유틸리티.
 *
 * slides / export / CLI 모듈이 서로를 직접 참조하지 않도록
 * 파일명·포맷·에러 메시지 헬퍼를 한곳에서 관리한다.
 */

import type { OutputFormat } from "./types/extract.js";

/**
 * 파일 시스템에서 안전하게 쓸 수 있는 이름으로 정제한다.
 * @param {string} name - 원본 파일 또는 폴더 이름
 * @returns {string} 저장 가능한 파일명
 */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 180) || "genspark-slides";
}

/**
 * CLI 포맷 문자열을 검증·정규화한다.
 * PNG 캡처는 PPT/PDF 의 입력이므로 목록에 없으면 앞에 넣는다.
 * @param {string | string[] | undefined} input - `png,pptx` 또는 배열
 * @returns {OutputFormat[]} 중복 없는 포맷 목록
 * @throws {Error} 지원하지 않는 포맷이 있을 때
 */
export function parseFormats(input: string | string[] | undefined): OutputFormat[] {
  const raw = Array.isArray(input) ? input.join(",") : (input ?? "png,pptx");
  const formats = raw
    .split(/[,\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const allowed = new Set<string>(["png", "pptx", "pdf"]);
  const invalid = formats.filter((item) => !allowed.has(item));
  if (invalid.length) {
    throw new Error(`지원하지 않는 포맷: ${invalid.join(", ")} (png, pptx, pdf)`);
  }

  const unique = [...new Set(formats)] as OutputFormat[];
  if (!unique.includes("png")) unique.unshift("png");
  return unique;
}

/**
 * unknown 에러에서 메시지 문자열을 안전하게 추출한다.
 * @param {unknown} err - catch 절의 unknown 값
 * @returns {string} 사람이 읽을 수 있는 메시지
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * 상대 경로를 origin 기준 절대 URL로 만든다.
 * @param {string} origin - 기준 origin
 * @param {string} [maybeRelative] - 상대 경로 또는 절대 URL
 * @returns {string | undefined} 변환 실패 시 undefined
 */
export function toAbsoluteUrl(origin: string, maybeRelative?: string): string | undefined {
  if (!maybeRelative) return undefined;
  try {
    return new URL(maybeRelative, origin).toString();
  } catch {
    return undefined;
  }
}
