/**
 * 실전 추출 매니저 (TS)
 *
 * 링크를 받아 장면을 캡처하고 PPTX 로 묶는 인터랙티브 CLI.
 * seowon-client-api `cli/auto-manager.ts` 와 같은 색상·메뉴 톤을 유지한다.
 */

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import {
  ANSI,
  ask,
  color,
  getProgressBar,
  openLocalFile,
  pickFromList,
  printErrorMessage,
  printInfo,
  printSection,
  printSuccess,
  printWarning
} from "../src/cli-ui.js";
import { isPackaged } from "../src/slides/browser.js";
import { extractSlides } from "../src/slides/extract.js";
import { parseSlideRange } from "../src/slides/parse-url.js";
import type { ExtractProgress, ExtractResult, OutputFormat } from "../src/types/extract.js";
import { errorMessage } from "../src/utils.js";

/** 매니저 세션 동안 유지하는 추출 옵션 */
interface ManagerSettings {
  outputDir: string; // 출력 폴더
  formats: OutputFormat[]; // 산출 포맷
  scale: number; // 캡처 배율
  waitMs: number; // 장면당 대기(ms)
  headed: boolean; // 브라우저 창 표시
}

/**
 * Genspark 슬라이드 링크를 받아 장면 캡처 후 PPT를 만드는 대화형 매니저.
 * seowon-client-api 의 `auto:manager` 와 같은 색상/메뉴 톤을 사용한다.
 */
async function run(): Promise<void> {
  const rl = readline.createInterface({ input, output });
  const settings: ManagerSettings = {
    outputDir: path.resolve("./output"),
    formats: ["png", "pptx"],
    scale: 2,
    waitMs: 1500,
    headed: false,
  };

  printSection("\n--- 📊 Genspark 슬라이드 PPT 추출 매니저 (TS) ---");
  printInfo("링크를 입력하면 각 장면을 캡처해 PPTX로 만듭니다.");
  if (isPackaged()) {
    printInfo("📦 단일 실행 파일 모드 · Windows Edge/Chrome 로 장면을 렌더합니다.");
  }
  printInfo(`⚙️  기본 설정: 해상도 ${settings.scale}x · 포맷 ${settings.formats.join(",")} · 출력 ${settings.outputDir}\n`);

  const initialUrl = process.argv.slice(2).find((arg) => !arg.startsWith("-"));

  try {
    if (initialUrl) {
      await runExtract(rl, settings, initialUrl);
    }

    while (true) {
      printSection("\n[메인 메뉴]");
      console.log(
        `${color("1", ANSI.yellow)}. ${color("🔗 슬라이드 링크 입력 → PPT 만들기", ANSI.bold)}`,
      );
      console.log(
        `${color("2", ANSI.yellow)}. ${color("📁 최근 PPT 열기", ANSI.bold)}`,
      );
      console.log(
        `${color("3", ANSI.yellow)}. ${color("⚙️  추출 옵션 (해상도 / 포맷 / 출력 폴더)", ANSI.bold)}`,
      );
      console.log(`${color("0", ANSI.yellow)}. ${color("종료", ANSI.bold)}`);

      const menu = (await rl.question("\n메뉴 선택: ")).trim();
      if (menu === "0") break;

      switch (menu) {
        case "1":
          await runExtract(rl, settings);
          break;
        case "2":
          await openLatestPptx(rl, settings.outputDir);
          break;
        case "3":
          await editSettings(rl, settings);
          break;
        default:
          printErrorMessage("올바른 메뉴를 선택하세요.");
      }
    }
  } catch (err) {
    printErrorMessage(`\n❌ 오류 발생: ${errorMessage(err)}`);
  } finally {
    // 탐색기에서 exe 를 더블클릭하면 창이 바로 닫히므로 한 번 멈춰 준다.
    if (isPackaged()) {
      await rl.question(color("\n종료하려면 Enter 를 누르세요...", ANSI.gray));
    }
    rl.close();
  }
}

/**
 * 링크를 받아 슬라이드를 수집하고 PPT를 생성한다.
 */
async function runExtract(
  rl: readline.Interface,
  settings: ManagerSettings,
  presetUrl?: string,
): Promise<void> {
  printSection("\n[슬라이드 → PPT]");
  printInfo("예: https://www.genspark.ai/slides?project_id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx");

  const url =
    presetUrl ??
    (await ask(rl, "슬라이드 링크"));
  if (!url) {
    printWarning("링크가 입력되지 않았습니다.");
    return;
  }

  const rangeInput = await ask(rl, "슬라이드 범위 (비우면 전체)", "전체");
  const slideRange =
    rangeInput && rangeInput !== "전체" ? parseSlideRange(rangeInput) : undefined;

  const cookie = await ask(rl, "비공개면 Cookie (없으면 Enter)", "");

  printInfo(
    `\n🚀 추출을 시작합니다. (해상도 ${settings.scale}x · ${settings.formats.join(",")} · 대기 ${settings.waitMs}ms)\n`,
  );

  let lastLineWasProgress = false;
  const onProgress = (progress: ExtractProgress) => {
    renderProgress(progress, () => {
      lastLineWasProgress = true;
    });
  };

  try {
    const result = await extractSlides({
      url,
      outputDir: settings.outputDir,
      formats: settings.formats,
      scale: settings.scale,
      waitMs: settings.waitMs,
      headed: settings.headed,
      cookie: cookie || undefined,
      slideRange,
      quiet: true,
      onProgress,
    });

    if (lastLineWasProgress) process.stdout.write("\n");
    printExtractSummary(result);

    const open = (await ask(rl, "PPT 파일을 지금 열까요? (y/N)", "n")).toLowerCase();
    if (open === "y" || open === "yes" || open === "ㅛ") {
      const target = result.pptxPath ?? result.pdfPath ?? result.outputDir;
      printInfo(`📂 여는 중: ${target}`);
      await openLocalFile(target);
    }
  } catch (err) {
    if (lastLineWasProgress) process.stdout.write("\n");
    printErrorMessage(`\n❌ 추출 실패: ${errorMessage(err)}`);
  }
}

/**
 * 추출 진행 상태를 auto:manager 스타일 진행바로 한 줄 갱신한다.
 */
function renderProgress(progress: ExtractProgress, markProgress: () => void): void {
  const phaseLabel: Record<ExtractProgress["phase"], string> = {
    analyze: "분석",
    fetch: "수집",
    "save-html": "HTML",
    capture: "캡처",
    pptx: "PPTX",
    pdf: "PDF",
    done: "완료",
  };

  const prefix = `${color(`[${phaseLabel[progress.phase]}]`, ANSI.yellow)}`;
  let line: string;

  if (progress.current != null && progress.total != null && progress.phase !== "fetch") {
    const bar = getProgressBar(progress.current, progress.total, 24);
    const title = progress.slideTitle ? ` ${progress.slideTitle}` : "";
    line = `${prefix} ${bar} ${color(`${progress.current}/${progress.total}`, ANSI.cyan)}${color(title, ANSI.gray)}`;
  } else {
    line = `${prefix} ${color(progress.message, ANSI.gray)}`;
  }

  process.stdout.write(`\r\u001b[K${line}`);
  markProgress();
}

/**
 * 추출 결과를 색상으로 구분해서 출력한다.
 */
function printExtractSummary(result: ExtractResult): void {
  console.log("");
  printSuccess("✅ 모든 장면 추출이 성공적으로 완료되었습니다!");
  console.log(
    `  ${color("•", ANSI.gray)} ${color("제목", ANSI.cyan)}  ${result.deck.title}`,
  );
  console.log(
    `  ${color("•", ANSI.gray)} ${color("장면", ANSI.cyan)}  ${result.images.length}장  /  ${result.deck.canvas.width}×${result.deck.canvas.height}`,
  );
  if (result.pptxPath) {
    console.log(`  ${color("•", ANSI.gray)} ${color("PPTX", ANSI.cyan)}  ${result.pptxPath}`);
  }
  if (result.pdfPath) {
    console.log(`  ${color("•", ANSI.gray)} ${color("PDF ", ANSI.cyan)}  ${result.pdfPath}`);
  }
  console.log(
    `  ${color("•", ANSI.gray)} ${color("PNG ", ANSI.cyan)}  ${path.join(result.outputDir, "images")}`,
  );
}

/**
 * 출력 폴더에서 가장 최근 PPTX를 찾아 연다.
 */
async function openLatestPptx(rl: readline.Interface, outputDir: string): Promise<void> {
  if (!existsSync(outputDir)) {
    printWarning("출력 폴더가 아직 없습니다. 먼저 추출을 실행하세요.");
    return;
  }

  const files = readdirSync(outputDir)
    .filter((name) => name.toLowerCase().endsWith(".pptx"))
    .map((name) => path.join(outputDir, name));

  if (files.length === 0) {
    printWarning("PPTX 파일이 없습니다.");
    return;
  }

  const selected = await pickFromList(rl, "열 파일", files, (file) => path.basename(file));
  printInfo(`📂 여는 중: ${selected}`);
  await openLocalFile(selected);
}

/**
 * 세션 동안 유지되는 추출 옵션을 수정한다.
 */
async function editSettings(rl: readline.Interface, settings: ManagerSettings): Promise<void> {
  printSection("\n[추출 옵션]");
  printInfo(
    `현재: 해상도 ${settings.scale}x · 포맷 ${settings.formats.join(",")} · 대기 ${settings.waitMs}ms · 출력 ${settings.outputDir}`,
  );

  const scalePick = await pickFromList(
    rl,
    "해상도",
    [
      { value: 1, label: "1x  표준 (빠름)" },
      { value: 2, label: "2x  레티나 (권장)" },
      { value: 3, label: "3x  초고해상도" },
    ],
    (item) => item.label,
  );
  settings.scale = scalePick.value;

  const formatPick = await pickFromList(
    rl,
    "출력 포맷",
    [
      { value: ["png", "pptx"] as OutputFormat[], label: "PNG + PPTX (권장)" },
      { value: ["png", "pptx", "pdf"] as OutputFormat[], label: "PNG + PPTX + PDF" },
      { value: ["pptx"] as OutputFormat[], label: "PPTX만" },
      { value: ["png"] as OutputFormat[], label: "PNG만" },
    ],
    (item) => item.label,
  );
  settings.formats = formatPick.value;

  const outputDir = await ask(rl, "출력 폴더", settings.outputDir);
  settings.outputDir = path.resolve(outputDir);

  const waitMs = await ask(rl, "장면당 추가 대기(ms)", String(settings.waitMs));
  settings.waitMs = Math.max(0, Number(waitMs) || settings.waitMs);

  const headed = (await ask(rl, "브라우저 창 표시? (y/N)", "n")).toLowerCase();
  settings.headed = headed === "y" || headed === "yes" || headed === "ㅛ";

  printSuccess(
    `✅ 옵션 저장: ${settings.scale}x · ${settings.formats.join(",")} · ${settings.waitMs}ms · ${settings.outputDir}`,
  );
}

void run();
