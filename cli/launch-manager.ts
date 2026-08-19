/**
 * 단일 exe 진입점.
 * caxa 가 이 파일을 실행하며, 패키징 플래그를 켠 뒤 매니저를 연다.
 */

process.env.GENSPARK_PACKAGED = "1";

await import("./auto-manager.js");
