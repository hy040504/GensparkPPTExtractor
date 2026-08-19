/**
 * 라이브러리 팩토리 사용 예시.
 * `npx tsx examples/basic.ts <슬라이드 URL>`
 */

import { createExtractorClient } from "../src/index.js";

const url = process.argv[2];
if (!url) {
  console.error("사용법: npx tsx examples/basic.ts <슬라이드 URL>");
  process.exit(1);
}

const client = createExtractorClient({
  outputDir: "./output",
  formats: ["png", "pptx"],
  scale: 2
});

const result = await client.extract(url);
console.log(result.pptxPath ?? result.outputDir);
