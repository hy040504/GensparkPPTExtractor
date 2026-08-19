/**
 * 터미널 UI 공통 헬퍼.
 *
 * seowon-client-api `src/cli-ui.ts` 와 같은 색상·프롬프트 규칙을 쓴다.
 * CLI 진입점(auto-manager, extract)만 여기 의존하고, 도메인 모듈은 logger 만 쓴다.
 */

import { exec } from "node:child_process";
import path from "node:path";
import readline from "node:readline/promises";

/**
 * 터미널 UI의 시각적 구분과 정보 전달력을 높이기 위한 표준 색상 셋.
 */
export const ANSI = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  red: "\u001b[31m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  blue: "\u001b[34m",
  magenta: "\u001b[35m",
  cyan: "\u001b[36m",
  gray: "\u001b[90m",
};

const COLOR_ENABLED = process.stdout.isTTY && !process.env.NO_COLOR;

/**
 * 텍스트에 ANSI 이스케이프 코드를 적용하여 색상을 입힌다.
 * @param {string} text - 색상을 입힐 문자열
 * @param {...string} codes - 적용할 ANSI 색상/스타일 코드
 * @returns {string} 색상이 적용된 문자열 (TTY가 아닐 경우 원본)
 */
export function color(text: string, ...codes: string[]): string {
  if (!COLOR_ENABLED) return text;
  return `${codes.join("")}${text}${ANSI.reset}`;
}

/**
 * 섹션 제목을 강조 색상으로 출력한다.
 * @param {string} title - 표시할 섹션 제목
 * @returns {void} 반환값 없음
 */
export function printSection(title: string): void {
  console.log(color(title, ANSI.bold, ANSI.blue));
}

/**
 * 보조 안내 메시지를 낮은 강조도로 출력한다.
 * @param {string} message - 표시할 안내 메시지
 * @returns {void} 반환값 없음
 */
export function printInfo(message: string): void {
  console.log(color(message, ANSI.gray));
}

/**
 * 성공 메시지를 성공 색상으로 출력한다.
 * @param {string} message - 표시할 성공 메시지
 * @returns {void} 반환값 없음
 */
export function printSuccess(message: string): void {
  console.log(color(message, ANSI.green));
}

/**
 * 경고 메시지를 경고 색상으로 출력한다.
 * @param {string} message - 표시할 경고 메시지
 * @returns {void} 반환값 없음
 */
export function printWarning(message: string): void {
  console.log(color(message, ANSI.yellow));
}

/**
 * 에러 메시지를 표준 에러 스트림에 출력한다.
 * @param {string} message - 표시할 에러 메시지
 * @returns {void} 반환값 없음
 */
export function printErrorMessage(message: string): void {
  console.error(color(message, ANSI.red));
}

/**
 * 사용자에게 텍스트 입력을 요청한다.
 * @param {readline.Interface} rl - 활성화된 readline 인터페이스
 * @param {string} label - 입력 프롬프트 라벨
 * @param {string} [fallback=""] - 입력값이 없을 경우 사용할 기본값
 * @returns {Promise<string>} 입력 완료된 문자열
 */
export async function ask(
  rl: readline.Interface,
  label: string,
  fallback = "",
): Promise<string> {
  const suffix = fallback ? color(` [기본값: ${fallback}]`, ANSI.gray) : "";
  return (await rl.question(`${color(label, ANSI.cyan)}${suffix}: `)).trim() || fallback;
}

/**
 * 제공된 배열 목록을 터미널에 출력하고 사용자가 번호로 하나를 선택하게 한다.
 * @param {readline.Interface} rl - 인터페이스 인스턴스
 * @param {string} title - 목록의 제목
 * @param {T[]} items - 선택할 항목 배열
 * @param {(item: T) => string} labelMapper - 각 항목을 문자열 라벨로 변환하는 함수
 * @returns {Promise<T>} 선택된 항목 객체
 * @throws {Error} 목록이 비었거나 번호가 범위 밖일 때
 */
export async function pickFromList<T>(
  rl: readline.Interface,
  title: string,
  items: T[],
  labelMapper: (item: T) => string,
): Promise<T> {
  if (items.length === 0) {
    throw new Error(`${title} 목록이 비어 있습니다.`);
  }

  console.log("");
  printSection(`${title}:`);
  items.forEach((item, i) => {
    console.log(`${color(String(i + 1), ANSI.yellow)}. ${labelMapper(item)}`);
  });

  const answer = (await rl.question(`${title} 번호를 선택하세요: `)).trim();
  const selected = items[Number(answer) - 1];
  if (!selected) {
    throw new Error(`올바른 ${title} 번호를 선택하세요.`);
  }
  return selected;
}

/**
 * 시각적인 진행 상태 바 문자열을 생성한다.
 * @param {number} current - 현재 진행 수치
 * @param {number} total - 목표 전체 수치
 * @param {number} [width=30] - 터미널에 표시될 바의 너비
 * @returns {string} ASCII 진행바 문자열
 */
export function getProgressBar(current: number, total: number, width = 30): string {
  const percent = total <= 0 ? 0 : Math.min(Math.max(current / total, 0), 1);
  const filledWidth = Math.floor(percent * width);
  const emptyWidth = width - filledWidth;
  const bar = "█".repeat(filledWidth) + "░".repeat(emptyWidth);
  const percentText = `${(percent * 100).toFixed(1).padStart(5)}%`;
  return `|${color(bar, ANSI.cyan)}| ${color(percentText, ANSI.bold)}`;
}

/**
 * OS 기본 앱으로 로컬 파일을 연다 (이미지 뷰어/브라우저/PowerPoint).
 * @param {string} filePath - 파일 절대/상대 경로
 * @returns {Promise<void>} 프로세스 기동 후 resolve
 */
export async function openLocalFile(filePath: string): Promise<void> {
  const target = path.resolve(filePath);
  const command =
    process.platform === "win32"
      ? `explorer.exe "${target}"`
      : process.platform === "darwin"
        ? `open "${target}"`
        : `xdg-open "${target}"`;

  return new Promise<void>((resolve) => {
    exec(command, () => undefined);
    setTimeout(() => resolve(), 300);
  });
}
