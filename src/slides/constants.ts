/**
 * 슬라이드 모듈 상수.
 * 호스트·API 경로·웹폰트를 한곳에 모아 도메인 파일이 문자열을 흩뿌리지 않게 한다.
 */

/** Cloudflare 우회용 브라우저 User-Agent */
export const DEFAULT_BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** genspark.ai 기본 origin */
export const DEFAULT_GENSPARK_ORIGIN = "https://www.genspark.ai";

/** 장면 HTML/메타데이터 API 경로 */
export const SLIDE_DATA_PATH = "/api/project/slide_data";

/** project_id 추출용 UUID */
export const PROJECT_ID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** 디자인 해상도를 모를 때 쓰는 기본 캔버스 */
export const DEFAULT_CANVAS = {
  width: 1920,
  height: 1080
} as const;

/** 한글 렌더용 웹폰트 (chrome.css 가 @font-face 를 안 줄 때 주입) */
export const SLIDE_FONT_HREFS = [
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css",
  "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap"
] as const;

/** 로컬 HTML에 그대로 둘 원격 자산 (CORS/캐시가 안정적인 CDN) */
export const KEEP_REMOTE_ASSET_RE =
  /fonts\.googleapis\.com|fonts\.gstatic\.com|jsdelivr\.net|unpkg\.com/i;
