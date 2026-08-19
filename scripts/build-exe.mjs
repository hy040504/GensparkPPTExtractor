/**
 * Windows 단일 exe 패키징.
 *
 * 1) cli + src 를 pack/app 으로 컴파일
 * 2) 프로덕션 의존성만 pack/stage 에 설치 (playwright postinstall 생략)
 * 3) caxa 로 Node + 앱을 한 파일로 묶음
 *
 * 내장 Chromium 은 넣지 않는다. 실행 시 Edge/Chrome 을 사용한다.
 */

import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import caxa from "caxa";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packDir = path.join(root, "pack");
const stageDir = path.join(packDir, "stage");
const appDir = path.join(packDir, "app");
const releaseDir = path.join(root, "release");
const exePath = path.join(releaseDir, "GensparkPPT.exe");

/**
 * 명령이 실패하면 프로세스를 끝낸다.
 * @param {string} command - 실행 파일
 * @param {string[]} args - 인자
 * @param {string} [cwd] - 작업 폴더
 * @returns {void} 반환값 없음
 */
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: true });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

rmSync(packDir, { recursive: true, force: true });
mkdirSync(packDir, { recursive: true });
mkdirSync(releaseDir, { recursive: true });

console.log("▸  TypeScript 컴파일 (pack/app)");
run("npx", ["tsc", "-p", "tsconfig.pack.json"]);

const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));

mkdirSync(stageDir, { recursive: true });
writeFileSync(
  path.join(stageDir, "package.json"),
  JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      type: "module",
      private: true,
      dependencies: pkg.dependencies
    },
    null,
    2
  )
);

console.log("▸  프로덕션 의존성 설치 (Chromium 다운로드 생략)");
run("npm", ["install", "--omit=dev", "--ignore-scripts"], stageDir);

console.log("▸  컴파일 결과 복사");
cpSync(appDir, path.join(stageDir, "app"), { recursive: true });

console.log("▸  caxa 단일 exe 생성");
await caxa({
  input: stageDir,
  output: exePath,
  command: ["{{caxa}}/node_modules/.bin/node", "{{caxa}}/app/cli/launch-manager.js"],
  dedupe: false,
  uncompressionMessage: "처음 실행 시 압축을 푸는 중입니다. 잠시만 기다려 주세요..."
});

console.log(`\n✔  ${exePath}`);
console.log("   Windows Edge 또는 Chrome 이 있으면 바로 실행할 수 있습니다.");
