/**
 * 슬라이드 URL 파서.
 * 호스트별 project_id 추출과 장면 범위 문자열 해석만 담당한다.
 */

import type { ParsedSlideUrl } from "../types/slides.js";
import { DEFAULT_GENSPARK_ORIGIN, PROJECT_ID_RE } from "./constants.js";

/**
 * 슬라이드 URL에서 호스트 종류와 project_id 를 뽑는다.
 * @param {string} rawUrl - 사용자가 넣은 링크
 * @returns {ParsedSlideUrl} 정규화된 URL 정보
 * @throws {Error} URL 형식이 아니거나 genspark.ai 에서 id 를 못 찾을 때
 */
export function parseSlideUrl(rawUrl: string): ParsedSlideUrl {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error(`유효한 URL이 아닙니다: ${rawUrl}`);
  }

  const origin = parsed.origin;
  const host = parsed.hostname.toLowerCase();
  const queryId = parsed.searchParams.get("project_id") ?? parsed.searchParams.get("id");

  if (host === "www.genspark.ai" || host === "genspark.ai") {
    const fromPath = parsed.pathname.match(PROJECT_ID_RE)?.[0];
    const projectId = queryId ?? fromPath;
    if (!projectId) {
      throw new Error(
        "Genspark URL에서 project_id를 찾지 못했습니다. 예: https://www.genspark.ai/slides?project_id=<uuid>"
      );
    }
    return {
      kind: "genspark-ai",
      originalUrl: parsed.toString(),
      origin: DEFAULT_GENSPARK_ORIGIN,
      projectId
    };
  }

  if (host.endsWith(".gensparkspace.com")) {
    return {
      kind: "genspark-space",
      originalUrl: parsed.toString(),
      origin,
      projectId: queryId ?? undefined
    };
  }

  return {
    kind: "generic-html",
    originalUrl: parsed.toString(),
    origin,
    projectId: queryId ?? undefined
  };
}

/**
 * `1-5` / `3` 형식의 장면 범위를 파싱한다.
 * @param {string} [input] - 사용자 입력. 비면 undefined
 * @returns {{ from: number; to: number } | undefined} 양쪽 포함 범위
 * @throws {Error} 형식이 잘못되었거나 from > to 일 때
 */
export function parseSlideRange(input?: string): { from: number; to: number } | undefined {
  if (!input) return undefined;
  const match = input.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
  if (!match) {
    throw new Error(`슬라이드 범위 형식이 잘못되었습니다: ${input}  (예: 1-5 또는 3)`);
  }
  const from = Number(match[1]);
  const to = Number(match[2] ?? match[1]);
  if (from < 1 || to < from) {
    throw new Error(`슬라이드 범위가 올바르지 않습니다: ${input}`);
  }
  return { from, to };
}
