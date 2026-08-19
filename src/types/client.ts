import type { ExtractOptions, ExtractResult, OutputFormat } from "./extract.js";

/**
 * 라이브러리 클라이언트 생성 옵션.
 * URL은 extract() 호출 때 넣고, 여기에는 세션 기본값만 둔다.
 */
export interface ExtractorClientOptions {
  outputDir?: string; // 기본 출력 폴더
  formats?: OutputFormat[]; // 기본 산출 포맷
  scale?: number; // 기본 캡처 배율
  waitMs?: number; // 기본 장면 대기(ms)
  headed?: boolean; // 기본 headed 여부
  cookie?: string; // 기본 Cookie 헤더
}

/**
 * 슬라이드 추출 클라이언트.
 * seowon-client-api 의 createEcampusClient 처럼 팩토리로 만든다.
 */
export interface ExtractorClient {
  readonly outputDir: string; // 정규화된 기본 출력 폴더
  /**
   * 슬라이드 URL을 받아 PNG/PPTX/PDF 를 만든다.
   * @param {string} url - Genspark 슬라이드 링크
   * @param {Partial<ExtractOptions>} [overrides] - 호출마다 덮어쓸 옵션
   * @returns {Promise<ExtractResult>} 추출 결과
   */
  extract(url: string, overrides?: Partial<Omit<ExtractOptions, "url">>): Promise<ExtractResult>;
}
