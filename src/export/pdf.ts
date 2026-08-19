/**
 * PDF 산출물.
 * 각 PNG 를 페이지 크기에 맞춰 그대로 붙인다.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import type { CapturedSlide, SlideDeck } from "../types/slides.js";
import { sanitizeFilename } from "../utils.js";

/**
 * 캡처 이미지를 페이지마다 한 장씩 넣은 PDF 를 만든다.
 * @param {SlideDeck} deck - 제목 메타데이터
 * @param {CapturedSlide[]} images - 장면 PNG
 * @param {string} outputDir - 저장 폴더
 * @returns {Promise<string>} 생성된 PDF 경로
 */
export async function buildPdf(
  deck: SlideDeck,
  images: CapturedSlide[],
  outputDir: string
): Promise<string> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(deck.title);
  pdf.setAuthor("Genspark PPT Extractor");

  for (const image of images) {
    const bytes = await readFile(image.imagePath);
    const png = await pdf.embedPng(bytes);
    const page = pdf.addPage([png.width, png.height]);
    page.drawImage(png, {
      x: 0,
      y: 0,
      width: png.width,
      height: png.height
    });
  }

  const filePath = path.join(outputDir, `${sanitizeFilename(deck.title)}.pdf`);
  await writeFile(filePath, await pdf.save());
  return filePath;
}
