#!/usr/bin/env node
/**
 * 일회성 CLI 진입점.
 * 인터랙티브 작업은 `cli/auto-manager.ts` (`npm run auto:manager`) 를 쓴다.
 */

import { Command } from "commander";
import path from "node:path";
import { extractSlides } from "../src/slides/extract.js";
import { parseSlideRange } from "../src/slides/parse-url.js";
import { errorMessage, parseFormats } from "../src/utils.js";

const program = new Command();

program
  .name("genspark-ppt")
  .description("Genspark 등 HTML 슬라이드 사이트의 각 장면을 캡처해 PPTX로 만듭니다.")
  .argument("<url>", "슬라이드 URL 또는 project_id가 포함된 Genspark 링크")
  .option("-o, --output <dir>", "출력 폴더", "./output")
  .option("-f, --format <list>", "출력 포맷 (png,pptx,pdf)", "png,pptx")
  .option("--scale <n>", "스크린샷 배율 (1=표준, 2=레티나, 3=초고해상도)", "2")
  .option("--wait <ms>", "폰트/이미지 추가 대기 시간(ms)", "1800")
  .option("--deck <name>", "특정 덱만 추출")
  .option("--slides <range>", "슬라이드 범위 (예: 1-5 또는 3)")
  .option("--cookie <value>", "비공개 프로젝트용 Cookie 헤더")
  .option("--headed", "브라우저 창을 띄워 캡처", false)
  .action(async (url: string, opts: Record<string, string | boolean>) => {
    try {
      const result = await extractSlides({
        url,
        outputDir: path.resolve(String(opts.output)),
        formats: parseFormats(String(opts.format)),
        scale: Number(opts.scale),
        waitMs: Number(opts.wait),
        headed: Boolean(opts.headed),
        cookie: opts.cookie ? String(opts.cookie) : undefined,
        deck: opts.deck ? String(opts.deck) : undefined,
        slideRange: parseSlideRange(opts.slides ? String(opts.slides) : undefined)
      });

      console.log("");
      console.log(`PNG  : ${result.images.length}장`);
      if (result.pptxPath) console.log(`PPTX : ${result.pptxPath}`);
      if (result.pdfPath) console.log(`PDF  : ${result.pdfPath}`);
    } catch (error) {
      console.error(`\n오류: ${errorMessage(error)}`);
      process.exitCode = 1;
    }
  });

void program.parseAsync(process.argv);
