import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const ignoredDirectories = new Set([
  ".git",
  "node_modules",
  "reports",
  "dist",
  ".superpowers",
  ".worktrees",
]);
const checkedExtensions = new Set([".js", ".mjs", ".cjs"]);

async function listJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...(await listJavaScriptFiles(path.join(directory, entry.name))));
      }
      continue;
    }

    if (entry.isFile() && checkedExtensions.has(path.extname(entry.name))) {
      files.push(path.join(directory, entry.name));
    }
  }

  return files;
}

const files = await listJavaScriptFiles(root);

for (const file of files) {
  await execFileAsync(process.execPath, ["--check", file]);
}

console.log(`Checked ${files.length} JavaScript files.`);
