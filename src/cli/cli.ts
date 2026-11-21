#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runCli } from "./runCli";

// Read version from the package.json above the built bin (dist/cli/cli.js ->
// ../../package.json). Works for both CJS and ESM output and any install
// layout; falls back gracefully if it can't be resolved.
function readVersion(): string {
  try {
    const scriptPath = process.argv[1];
    const pkgPath = resolve(dirname(scriptPath), "../../package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

function readStdin(): Promise<string> {
  return new Promise((resolveFn) => {
    if (process.stdin.isTTY) {
      resolveFn("");
      return;
    }
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolveFn(data));
    process.stdin.on("error", () => resolveFn(data));
  });
}

function write(stream: NodeJS.WriteStream, text: string): void {
  stream.write(text.endsWith("\n") ? text : `${text}\n`);
}

runCli(process.argv.slice(2), {
  stdout: (text) => write(process.stdout, text),
  stderr: (text) => write(process.stderr, text),
  readStdin,
  version: readVersion(),
})
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    process.stderr.write(`Fatal: ${error?.message ?? String(error)}\n`);
    process.exitCode = 1;
  });