/**
 * Playwright 브라우저 선택.
 *
 * 단일 exe 에는 Chromium 을 넣지 않는다 (200MB+).
 * Windows 는 기본 설치된 Edge → Chrome → 내장 Chromium 순으로 연다.
 */

import { chromium, type Browser, type LaunchOptions } from "playwright";
import { log } from "../logger.js";
import { errorMessage } from "../utils.js";

/** GENSPARK_BROWSER 로 강제할 수 있는 값 */
export type BrowserPreference = "msedge" | "chrome" | "chromium";

/**
 * 패키징된 실행 파일인지 판별한다.
 * caxa 런처가 GENSPARK_PACKAGED=1 을 넣는다.
 * @returns {boolean} 단일 exe 로 실행 중이면 true
 */
export function isPackaged(): boolean {
  return process.env.GENSPARK_PACKAGED === "1";
}

/**
 * 시도할 브라우저 채널 목록을 만든다.
 * undefined 는 Playwright 가 내려받은 내장 Chromium 이다.
 * @returns {Array<LaunchOptions["channel"] | undefined>} 우선순위 순 채널
 */
function resolveChannelOrder(): Array<LaunchOptions["channel"] | undefined> {
  const requested = (process.env.GENSPARK_BROWSER ?? "").toLowerCase();
  if (requested === "chromium") return [undefined];
  if (requested === "chrome") return ["chrome", "msedge", undefined];
  if (requested === "msedge") return ["msedge", "chrome", undefined];

  if (process.platform === "win32" || isPackaged()) {
    return ["msedge", "chrome", undefined];
  }
  return [undefined, "chrome", "msedge"];
}

/**
 * 사용 가능한 Chromium 계열 브라우저를 연다.
 * @param {boolean} headed - true 면 창을 띄운다
 * @returns {Promise<Browser>} Playwright Browser
 * @throws {Error} Edge/Chrome/내장 Chromium 모두 실패했을 때
 */
export async function launchChromium(headed: boolean): Promise<Browser> {
  const errors: string[] = [];

  for (const channel of resolveChannelOrder()) {
    const label = channel ?? "내장 Chromium";
    try {
      const browser = await chromium.launch({
        headless: !headed,
        ...(channel ? { channel } : {})
      });
      log.info(`브라우저: ${label}`);
      return browser;
    } catch (err) {
      errors.push(`${label}: ${errorMessage(err)}`);
    }
  }

  throw new Error(
    `브라우저를 열 수 없습니다. Windows Edge 또는 Chrome 이 설치돼 있는지 확인하세요.\n  ${errors.join("\n  ")}`
  );
}
