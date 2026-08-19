/**
 * 슬라이드/자산 HTTP 클라이언트.
 *
 * Node fetch 는 genspark.ai Cloudflare 에서 403 이 나므로
 * curl 을 우선하고, 없을 때만 fetch 로 내린다.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { errorMessage } from "../utils.js";
import { DEFAULT_BROWSER_USER_AGENT, DEFAULT_GENSPARK_ORIGIN } from "./constants.js";

const execFileAsync = promisify(execFile);

/** HTTP GET 옵션 */
export interface HttpOptions {
  cookie?: string; // Cookie 헤더
  timeoutMs?: number; // 제한 시간(ms)
  accept?: string; // Accept 헤더
  referer?: string; // Referer 헤더
}

/**
 * URL 본문을 UTF-8 텍스트로 가져온다.
 * @param {string} url - 요청 URL
 * @param {HttpOptions} [options] - 헤더/타임아웃
 * @returns {Promise<string>} 응답 본문
 */
export async function httpGetText(url: string, options: HttpOptions = {}): Promise<string> {
  const buf = await httpGetBuffer(url, options);
  return buf.toString("utf8");
}

/**
 * URL 본문을 Buffer 로 가져온다.
 * curl 실패 시 fetch 로 한 번 더 시도한다.
 * @param {string} url - 요청 URL
 * @param {HttpOptions} [options] - 헤더/타임아웃
 * @returns {Promise<Buffer>} 응답 바이트
 * @throws {Error} curl·fetch 모두 실패했을 때
 */
export async function httpGetBuffer(url: string, options: HttpOptions = {}): Promise<Buffer> {
  try {
    return await curlGet(url, options);
  } catch (curlError) {
    try {
      return await fetchGet(url, options);
    } catch (fetchError) {
      throw new Error(
        `요청 실패: ${url}\n  curl: ${errorMessage(curlError)}\n  fetch: ${errorMessage(fetchError)}`
      );
    }
  }
}

/**
 * 플랫폼별 curl 실행 파일 이름을 고른다.
 * @returns {string} curl 바이너리명
 */
function curlBin(): string {
  return process.platform === "win32" ? "curl.exe" : "curl";
}

/**
 * Referer 를 고른다. Genspark 는 same-origin Referer 가 없으면 막히는 경우가 있다.
 * @param {string} url - 요청 URL
 * @param {string} [explicit] - 호출부가 지정한 Referer
 * @returns {string} Referer 값
 */
function refererFor(url: string, explicit?: string): string {
  if (explicit) return explicit;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith("genspark.ai") || parsed.hostname.endsWith("gensparkspace.com")) {
      return `${parsed.origin}/`;
    }
    return parsed.origin;
  } catch {
    return `${DEFAULT_GENSPARK_ORIGIN}/`;
  }
}

/**
 * curl 로 GET 한다.
 * @param {string} url - 요청 URL
 * @param {HttpOptions} options - 헤더/타임아웃
 * @returns {Promise<Buffer>} 응답 바이트
 */
async function curlGet(url: string, options: HttpOptions): Promise<Buffer> {
  const timeoutSec = Math.max(10, Math.ceil((options.timeoutMs ?? 60_000) / 1000));
  const args = [
    "-sL",
    "--fail",
    "--compressed",
    "--max-time",
    String(timeoutSec),
    "-A",
    DEFAULT_BROWSER_USER_AGENT,
    "-H",
    `Accept: ${options.accept ?? "*/*"}`,
    "-H",
    "Accept-Language: ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "-H",
    `Referer: ${refererFor(url, options.referer)}`,
    "-H",
    `Origin: ${DEFAULT_GENSPARK_ORIGIN}`
  ];
  if (options.cookie) {
    args.push("-H", `Cookie: ${options.cookie}`);
  }
  args.push(url);

  const { stdout } = await execFileAsync(curlBin(), args, {
    encoding: "buffer",
    maxBuffer: 80 * 1024 * 1024,
    timeout: (options.timeoutMs ?? 60_000) + 5_000,
    windowsHide: true
  });
  if (!stdout.length) {
    throw new Error("빈 응답");
  }
  return stdout;
}

/**
 * Node fetch 폴백 GET.
 * Cloudflare 에 막힐 수 있어 주 경로가 아니다.
 * @param {string} url - 요청 URL
 * @param {HttpOptions} options - 헤더/타임아웃
 * @returns {Promise<Buffer>} 응답 바이트
 */
async function fetchGet(url: string, options: HttpOptions): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 60_000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": DEFAULT_BROWSER_USER_AGENT,
        Accept: options.accept ?? "*/*",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        Referer: refererFor(url, options.referer),
        Origin: DEFAULT_GENSPARK_ORIGIN,
        ...(options.cookie ? { Cookie: options.cookie } : {})
      }
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    return Buffer.from(await res.arrayBuffer());
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("요청 시간 초과");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
