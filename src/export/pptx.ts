/**
 * PPTX 산출물.
 *
 * CSS 효과를 네이티브 shape 로 바꾸지 않고, 장면 PNG 를 전체 화면에 넣는다.
 * pptxgenjs ESM 타입과 CJS 생성자 불일치는 createRequire 로 우회한다.
 */

import { createRequire } from "node:module";
import path from "node:path";
import type { CapturedSlide, SlideDeck } from "../types/slides.js";
import { sanitizeFilename } from "../utils.js";

/** pptxgenjs 인스턴스에서 실제로 쓰는 멤버만 좁힌 타입 */
interface Presentation {
  layout: string;
  title: string;
  author: string;
  subject: string;
  defineLayout(layout: { name: string; width: number; height: number }): void;
  addSlide(): {
    addImage(opts: { path: string; x: number; y: number; w: number; h: number }): void;
    addNotes(notes: string): void;
  };
  writeFile(opts: { fileName: string }): Promise<string>;
}

const require = createRequire(import.meta.url);
const PptxGenJS = require("pptxgenjs") as new () => Presentation;

/**
 * 캡처 이미지를 16:9(또는 원본 비율) PPTX 로 묶는다.
 * @param {SlideDeck} deck - 제목·캔버스 정보
 * @param {CapturedSlide[]} images - 장면 PNG
 * @param {string} outputDir - 저장 폴더
 * @returns {Promise<string>} 생성된 PPTX 경로
 */
export async function buildPptx(
  deck: SlideDeck,
  images: CapturedSlide[],
  outputDir: string
): Promise<string> {
  const pres = new PptxGenJS();
  const { widthIn, heightIn } = canvasToInches(deck.canvas.width, deck.canvas.height);

  pres.defineLayout({ name: "GENSPARK_CAPTURE", width: widthIn, height: heightIn });
  pres.layout = "GENSPARK_CAPTURE";
  pres.title = deck.title;
  pres.author = "Genspark PPT Extractor";
  pres.subject = deck.projectId ? `project_id=${deck.projectId}` : deck.title;

  for (const image of images) {
    const slide = pres.addSlide();
    slide.addImage({
      path: image.imagePath,
      x: 0,
      y: 0,
      w: widthIn,
      h: heightIn
    });
    slide.addNotes(`${image.index}. ${image.title}\n${image.filename}`);
  }

  const filePath = path.join(outputDir, `${sanitizeFilename(deck.title)}.pptx`);
  await pres.writeFile({ fileName: filePath });
  return filePath;
}

/**
 * 픽셀 캔버스를 PowerPoint 인치 레이아웃으로 환산한다.
 * @param {number} width - 캔버스 가로(px)
 * @param {number} height - 캔버스 세로(px)
 * @returns {{ widthIn: number; heightIn: number }} 슬라이드 인치 크기
 */
function canvasToInches(width: number, height: number): { widthIn: number; heightIn: number } {
  const ratio = width / height;
  if (Math.abs(ratio - 16 / 9) < 0.02) {
    return { widthIn: 13.333, heightIn: 7.5 };
  }
  if (Math.abs(ratio - 4 / 3) < 0.02) {
    return { widthIn: 10, heightIn: 7.5 };
  }
  const widthIn = 13.333;
  return { widthIn, heightIn: Number((widthIn / ratio).toFixed(3)) };
}
