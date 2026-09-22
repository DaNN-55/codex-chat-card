#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  open,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MINIMUM_NODE_MAJOR = 20;
const INSTALL_LOCK = ".codex-chat-card-runtime-install.lock";
const INSTALL_STAMP = ".codex-chat-card-runtime.json";
const LOCK_STALE_AFTER_MS = 10 * 60 * 1000;
const LOCK_WAIT_TIMEOUT_MS = 5 * 60 * 1000;
const LOCK_POLL_INTERVAL_MS = 250;
const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function dependencyDirectory(rootDir, dependency) {
  return join(rootDir, "node_modules", ...dependency.split("/"));
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function readRuntimeMetadata(rootDir) {
  const [packageContent, lockContent] = await Promise.all([
    readFile(join(rootDir, "package.json"), "utf8"),
    readFile(join(rootDir, "package-lock.json"), "utf8"),
  ]);
  const packageJson = JSON.parse(packageContent);
  return {
    dependencies: Object.keys(packageJson.dependencies ?? {}),
    lockHash: sha256(lockContent),
  };
}

async function dependenciesPresent(rootDir, dependencies) {
  const checks = await Promise.all(
    dependencies.map((dependency) =>
      pathExists(join(dependencyDirectory(rootDir, dependency), "package.json")),
    ),
  );
  return checks.every(Boolean);
}

async function readStamp(rootDir) {
  try {
    return JSON.parse(
      await readFile(join(rootDir, "node_modules", INSTALL_STAMP), "utf8"),
    );
  } catch (error) {
    if (error?.code === "ENOENT" || error instanceof SyntaxError) return null;
    throw error;
  }
}

async function runtimeReady(rootDir, metadata) {
  const stamp = await readStamp(rootDir);
  if (stamp?.lockHash !== metadata.lockHash) return false;
  return dependenciesPresent(rootDir, metadata.dependencies);
}

async function acquireInstallLock(rootDir, readyCheck) {
  const lockPath = join(rootDir, INSTALL_LOCK);
  const startedAt = Date.now();

  while (Date.now() - startedAt < LOCK_WAIT_TIMEOUT_MS) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.writeFile(
        `${JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })}\n`,
      );
      return { handle, lockPath };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      if (await readyCheck()) return null;

      try {
        const lockStat = await stat(lockPath);
        if (Date.now() - lockStat.mtimeMs > LOCK_STALE_AFTER_MS) {
          await rm(lockPath, { force: true });
          continue;
        }
      } catch (statError) {
        if (statError?.code !== "ENOENT") throw statError;
      }
      await delay(LOCK_POLL_INTERVAL_MS);
    }
  }

  throw new Error(
    "等待另一个 Codex Chat Card 依赖安装任务超时，请确认没有残留的 npm 进程后重试。",
  );
}

function spawnCaptured(command, args, { cwd, env, quiet }) {
  return new Promise((resolveProcess, rejectProcess) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ["inherit", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      if (!quiet) process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      if (!quiet) process.stderr.write(text);
    });
    child.once("error", rejectProcess);
    child.once("close", (code) =>
      resolveProcess({ code: code ?? 1, stdout, stderr }),
    );
  });
}

function spawnInherited(command, args, { cwd, env, quiet }) {
  return new Promise((resolveProcess, rejectProcess) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: quiet ? "ignore" : "inherit",
    });
    child.once("error", rejectProcess);
    child.once("close", (code) => resolveProcess(code ?? 1));
  });
}

export function classifyInstallFailure(output, errorCode) {
  if (errorCode === "ENOENT") {
    return "未找到 npm。请安装 Node.js 20 或更高版本，并确认 npm 在 PATH 中。";
  }
  if (
    /\b(?:EAI_AGAIN|ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ERR_SOCKET)\b|network request failed/i.test(
      output,
    )
  ) {
    return "运行依赖安装失败：npm 网络连接失败。请检查网络、代理或 npm registry 后重试同一命令。";
  }
  if (/\b(?:EACCES|EPERM)\b|permission denied|operation not permitted/i.test(output)) {
    return "运行依赖安装失败：Skill 目录写入权限不足。请允许写入该 Skill 目录后重试同一命令。";
  }
  return "运行依赖安装失败。请查看上方 npm 输出，确认网络连接和 Skill 目录写入权限后重试同一命令。";
}

export function assertSupportedNode(version = process.versions.node) {
  const major = Number.parseInt(version.split(".")[0], 10);
  if (!Number.isInteger(major) || major < MINIMUM_NODE_MAJOR) {
    throw new Error(
      `Codex Chat Card 需要 Node.js ${MINIMUM_NODE_MAJOR}+，当前版本为 ${version}。`,
    );
  }
}

export async function ensureRuntimeDependencies(options = {}) {
  const rootDir = options.rootDir ?? DEFAULT_ROOT;
  const env = options.env ?? process.env;
  const quiet = options.quiet ?? false;
  const npmCommand =
    options.npmCommand ?? (process.platform === "win32" ? "npm.cmd" : "npm");
  const npmPrefixArgs = options.npmPrefixArgs ?? [];
  const metadata = await readRuntimeMetadata(rootDir);

  assertSupportedNode(options.nodeVersion);
  if (await runtimeReady(rootDir, metadata)) return;

  const lock = await acquireInstallLock(rootDir, () =>
    runtimeReady(rootDir, metadata),
  ).catch((error) => {
    if (error?.code === "EACCES" || error?.code === "EPERM") {
      throw new Error(classifyInstallFailure(error.message, error.code));
    }
    throw error;
  });
  if (!lock) return;

  try {
    if (await runtimeReady(rootDir, metadata)) return;

    if (!quiet) {
      process.stderr.write("首次运行：正在安装 Codex Chat Card 运行依赖…\n");
    }
    const installArgs = [
      ...npmPrefixArgs,
      "ci",
      "--omit=dev",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
    ];
    let result;
    try {
      result = await spawnCaptured(npmCommand, installArgs, {
        cwd: rootDir,
        env,
        quiet,
      });
    } catch (error) {
      throw new Error(classifyInstallFailure(error.message, error.code));
    }
    if (result.code !== 0) {
      throw new Error(
        classifyInstallFailure(`${result.stdout}\n${result.stderr}`),
      );
    }
    if (!(await dependenciesPresent(rootDir, metadata.dependencies))) {
      throw new Error(
        "npm 已结束，但运行依赖仍不完整。请删除 node_modules 后重试同一命令。",
      );
    }
    await writeFile(
      join(rootDir, "node_modules", INSTALL_STAMP),
      `${JSON.stringify({ lockHash: metadata.lockHash, installedAt: new Date().toISOString() })}\n`,
    );
    if (!quiet) {
      process.stderr.write("运行依赖安装完成，继续执行原命令。\n");
    }
  } finally {
    await lock.handle.close();
    await rm(lock.lockPath, { force: true });
  }
}

export async function run(argv, options = {}) {
  const rootDir = options.rootDir ?? DEFAULT_ROOT;
  const env = options.env ?? process.env;
  const quiet = options.quiet ?? false;
  await ensureRuntimeDependencies({ ...options, rootDir, env, quiet });
  return spawnInherited(
    process.execPath,
    [options.cliPath ?? join(rootDir, "scripts", "dist", "cli.js"), ...argv],
    { cwd: options.cwd ?? process.cwd(), env, quiet },
  );
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  run(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    });
}
