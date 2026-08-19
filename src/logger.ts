/**
 * 패키지 기본 콘솔 로거.
 *
 * 색상은 cli-ui 팔레트를 재사용한다.
 * auto:manager 가 자체 UI 를 쓸 때는 setQuiet(true) 로 숨긴다.
 */

import { ANSI, color } from "./cli-ui.js";

let quiet = false;

/**
 * 이후 로그 출력을 켜거나 끈다.
 * @param {boolean} value - true 면 출력 억제
 * @returns {boolean} 호출 전 quiet 값 (복원용)
 */
export function setQuiet(value: boolean): boolean {
  const previous = quiet;
  quiet = value;
  return previous;
}

export const log = {
  /**
   * 보조 정보 (회색)
   * @param {string} message - 출력할 메시지
   * @returns {void} 반환값 없음
   */
  info(message: string): void {
    if (quiet) return;
    console.log(color(`ℹ  ${message}`, ANSI.gray));
  },
  /**
   * 성공 (초록)
   * @param {string} message - 출력할 메시지
   * @returns {void} 반환값 없음
   */
  ok(message: string): void {
    if (quiet) return;
    console.log(color(`✔  ${message}`, ANSI.green));
  },
  /**
   * 경고 (노랑)
   * @param {string} message - 출력할 메시지
   * @returns {void} 반환값 없음
   */
  warn(message: string): void {
    if (quiet) return;
    console.warn(color(`⚠  ${message}`, ANSI.yellow));
  },
  /**
   * 단계 제목 (파랑 + bold)
   * @param {string} message - 출력할 메시지
   * @returns {void} 반환값 없음
   */
  step(message: string): void {
    if (quiet) return;
    console.log(`\n${color(`▸  ${message}`, ANSI.bold, ANSI.blue)}`);
  }
};
