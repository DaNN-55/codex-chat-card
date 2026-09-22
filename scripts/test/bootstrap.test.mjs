import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  classifyInstallFailure,
  ensureRuntimeDependencies,
  run,
} from "../run.mjs";

async function createFixture(t, { installFailure } = {}) {
  const rootDir = await mkdtemp(join(tmpdir(), "codex-chat-card-bootstrap-"));
  t.after(() => rm(rootDir, { recursive: true, force: true }));

  await mkdir(join(rootDir, "scripts", "dist"), { recursive: true });
  await writeFile(
    join(rootDir, "package.json"),
    JSON.stringify({
      name: "bootstrap-fixture",
      version: "1.0.0",
      dependencies: { "fake-runtime": "1.0.0" },
    }),
  );
  await writeFile(
    join(rootDir, "package-lock.json"),
    JSON.stringify({
      name: "bootstrap-fixture",
      version: "1.0.0",
      lockfileVersion: 3,
      packages: {
        "": {
          name: "bootstrap-fixture",
          version: "1.0.0",
          dependencies: { "fake-runtime": "1.0.0" },
        },
      },
    }),
  );

  const npmLog = join(rootDir, "npm.log");
  const cliLog = join(rootDir, "cli.log");
  const fakeNpm = join(rootDir, "fake-npm.mjs");
  const fakeCli = join(rootDir, "scripts", "dist", "cli.js");

  await writeFile(
    fakeNpm,
    `import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
await appendFile(process.env.FAKE_NPM_LOG, JSON.stringify(process.argv.slice(2)) + "\\n");
if (process.env.FAKE_NPM_FAILURE) {
  process.stderr.write(process.env.FAKE_NPM_FAILURE + "\\n");
  process.exit(1);
}
await new Promise((resolve) => setTimeout(resolve, 120));
const packageJson = JSON.parse(await readFile(join(process.cwd(), "package.json"), "utf8"));
for (const dependency of Object.keys(packageJson.dependencies ?? {})) {
  const dependencyDir = join(process.cwd(), "node_modules", ...dependency.split("/"));
  await mkdir(dependencyDir, { recursive: true });
  await writeFile(join(dependencyDir, "package.json"), JSON.stringify({ name: dependency }));
}
`,
  );
  await writeFile(
    fakeCli,
    `import { appendFile } from "node:fs/promises";
await appendFile(process.env.FAKE_CLI_LOG, JSON.stringify(process.argv.slice(2)) + "\\n");
`,
  );

  return {
    rootDir,
    npmLog,
    cliLog,
    options: {
      rootDir,
      npmCommand: process.execPath,
      npmPrefixArgs: [fakeNpm],
      cliPath: fakeCli,
      env: {
        ...process.env,
        FAKE_NPM_LOG: npmLog,
        FAKE_CLI_LOG: cliLog,
        ...(installFailure ? { FAKE_NPM_FAILURE: installFailure } : {}),
      },
      quiet: true,
    },
  };
}

async function readJsonLines(path) {
  try {
    return (await readFile(path, "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

test("首次调用安装运行依赖并继续命令，后续调用不重复安装", async (t) => {
  const fixture = await createFixture(t);

  assert.equal(await run(["list", "--current"], fixture.options), 0);
  assert.deepEqual(await readJsonLines(fixture.npmLog), [
    ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"],
  ]);
  assert.deepEqual(await readJsonLines(fixture.cliLog), [
    ["list", "--current"],
  ]);

  assert.equal(await run(["themes"], fixture.options), 0);
  assert.equal((await readJsonLines(fixture.npmLog)).length, 1);
  assert.deepEqual(await readJsonLines(fixture.cliLog), [
    ["list", "--current"],
    ["themes"],
  ]);

  await writeFile(
    join(fixture.rootDir, "package-lock.json"),
    `${await readFile(join(fixture.rootDir, "package-lock.json"), "utf8")}\n`,
  );
  assert.equal(await run(["themes"], fixture.options), 0);
  assert.equal((await readJsonLines(fixture.npmLog)).length, 2);
});

test("并发首次调用只安装一次运行依赖", async (t) => {
  const fixture = await createFixture(t);

  await Promise.all([
    ensureRuntimeDependencies(fixture.options),
    ensureRuntimeDependencies(fixture.options),
  ]);

  assert.equal((await readJsonLines(fixture.npmLog)).length, 1);
});

test("安装失败时指出网络问题并清理初始化锁", async (t) => {
  const fixture = await createFixture(t, {
    installFailure: "npm error code EAI_AGAIN: network request failed",
  });

  await assert.rejects(
    () => ensureRuntimeDependencies(fixture.options),
    /网络连接失败/,
  );
  await assert.rejects(
    () => access(join(fixture.rootDir, ".codex-chat-card-runtime-install.lock")),
    { code: "ENOENT" },
  );
});

test("安装错误能区分 npm 缺失、网络和写入权限", () => {
  assert.match(classifyInstallFailure("", "ENOENT"), /未找到 npm/);
  assert.match(classifyInstallFailure("npm error code ETIMEDOUT"), /网络连接失败/);
  assert.match(classifyInstallFailure("npm error code EACCES"), /写入权限不足/);
});

test("不支持的 Node 版本会在安装前停止", async (t) => {
  const fixture = await createFixture(t);

  await assert.rejects(
    () =>
      ensureRuntimeDependencies({
        ...fixture.options,
        nodeVersion: "18.20.0",
      }),
    /需要 Node\.js 20\+/,
  );
  assert.equal((await readJsonLines(fixture.npmLog)).length, 0);
});

test("npm 不存在时返回可操作的错误", async (t) => {
  const fixture = await createFixture(t);

  await assert.rejects(
    () =>
      ensureRuntimeDependencies({
        ...fixture.options,
        npmCommand: join(fixture.rootDir, "missing-npm"),
        npmPrefixArgs: [],
      }),
    /未找到 npm/,
  );
});
