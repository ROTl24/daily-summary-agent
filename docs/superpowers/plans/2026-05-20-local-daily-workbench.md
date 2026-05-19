# Local Daily Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Windows-first local daily report workbench described in `docs/superpowers/specs/2026-05-20-local-daily-workbench-design.md`.

**Architecture:** Keep the existing CLI collectors as the core domain layer, add a local Node HTTP service around them, then build a React/Vite workbench that calls the service. Once the browser-based workflow works end to end, wrap it in Electron for Windows packaging and native folder pickers.

**Tech Stack:** Node.js 24 ESM, built-in `node:test`, React, Vite, Electron, Electron Builder, DeepSeek Chat Completions API, local filesystem JSON configuration, Git CLI.

---

## Scope Notes

This plan implements one coherent product slice: local configuration, evidence collection, DeepSeek generation, editable Markdown saving, a browser workbench, and a Windows Electron wrapper.

The implementation must preserve these product decisions:

- DeepSeek failures are visible errors in the workbench, not silent fallback reports.
- Codex reading is disabled by default.
- Uncommitted Git changes are pending evidence only.
- Manual context is always visible.
- App configuration is stored outside project repositories by default.
- The first usable milestone is the browser workbench; Electron packaging comes after that flow works.

## File Structure

Create or modify these files:

- Modify `package.json`: add React/Vite/Electron dependencies and app scripts.
- Modify `scripts/check-syntax.mjs`: keep backend syntax checks and avoid parsing JSX with `node --check`.
- Create `index.html`: Vite app entry.
- Create `vite.config.mjs`: Vite React build config.
- Create `web/src/main.jsx`: React mount point.
- Create `web/src/App.jsx`: top-level state and workbench composition.
- Create `web/src/apiClient.js`: browser-to-local-service API wrapper.
- Create `web/src/components/Sidebar.jsx`: API key, output directory, repository list, Codex toggle.
- Create `web/src/components/EvidencePanel.jsx`: detailed Git/Codex/manual evidence review.
- Create `web/src/components/MarkdownEditor.jsx`: editable Markdown and save actions.
- Create `web/src/styles.css`: restrained desktop workbench styling.
- Create `src/appConfig.mjs`: local app configuration path, load, save, validation, and secret-safe defaults.
- Create `src/evidenceService.mjs`: repository validation and evidence aggregation from Git, Codex, and manual context.
- Create `src/reportService.mjs`: DeepSeek generation orchestration and Markdown save behavior.
- Create `src/server/httpServer.mjs`: local HTTP API and static asset serving.
- Create `src/server/main.mjs`: command-line entry for local service.
- Create `electron/main.cjs`: Electron main process, local server startup, BrowserWindow, and folder dialog IPC.
- Create `electron/preload.cjs`: safe folder picker bridge for the renderer.
- Create `electron-builder.json`: Windows NSIS packaging config.
- Create `test/appConfig.test.mjs`: config tests.
- Create `test/evidenceService.test.mjs`: evidence aggregation tests.
- Create `test/reportService.test.mjs`: generation and save tests.
- Create `test/httpServer.test.mjs`: service endpoint tests.
- Create `test/electronConfig.test.mjs`: static Electron packaging config checks.

Existing files to reuse:

- `src/gitCollector.mjs`
- `src/codexCollector.mjs`
- `src/deepseekWriter.mjs`
- `src/reportWriter.mjs`
- `src/dateRange.mjs`

## Task 1: Package Scripts And Project Skeleton

**Files:**
- Modify: `package.json`
- Modify: `scripts/check-syntax.mjs`
- Create: `index.html`
- Create: `vite.config.mjs`
- Create: `web/src/main.jsx`
- Create: `web/src/App.jsx`
- Create: `web/src/styles.css`

- [ ] **Step 1: Update package scripts and dependencies**

Replace `package.json` with:

```json
{
  "name": "daily-summary-agent",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "electron/main.cjs",
  "scripts": {
    "daily": "node src/cli.mjs",
    "dev": "concurrently \"pnpm dev:server\" \"pnpm dev:web\"",
    "dev:server": "node src/server/main.mjs --port 8787 --static web-dev",
    "dev:web": "vite --host 127.0.0.1 --port 5173",
    "start:server": "node src/server/main.mjs",
    "test": "node --test",
    "lint": "node scripts/check-syntax.mjs",
    "build": "vite build && node scripts/check-syntax.mjs",
    "electron": "pnpm build && electron .",
    "package:win": "pnpm build && electron-builder --win nsis"
  },
  "bin": {
    "daily-summary-agent": "src/cli.mjs"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^5.0.4",
    "vite": "^6.2.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "concurrently": "^9.2.1",
    "electron": "^33.4.11",
    "electron-builder": "^25.1.8"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `pnpm install`

Expected: command exits 0 and creates `pnpm-lock.yaml`.

- [ ] **Step 3: Adjust syntax checker**

Modify `scripts/check-syntax.mjs` so it checks Node-readable JavaScript files and skips Vite JSX files:

```js
import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const ignoredDirectories = new Set([".git", "node_modules", "reports", "dist", ".superpowers"]);
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
```

- [ ] **Step 4: Add Vite entry files**

Create `index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>日报工作台</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/web/src/main.jsx"></script>
  </body>
</html>
```

Create `vite.config.mjs`:

```js
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
});
```

Create `web/src/main.jsx`:

```jsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

Create `web/src/App.jsx`:

```jsx
export default function App() {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <h1>日报工作台</h1>
        <p className="muted">添加仓库后生成今天的 Markdown 日报。</p>
      </aside>
      <section className="workspace">
        <h2>今日日报</h2>
        <p className="muted">配置完成后，这里会展示证据、生成结果和编辑器。</p>
      </section>
    </main>
  );
}
```

Create `web/src/styles.css`:

```css
:root {
  color: #1e293b;
  background: #f6f7f9;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

button,
input,
textarea {
  font: inherit;
}

.app-shell {
  display: grid;
  grid-template-columns: minmax(300px, 360px) minmax(0, 1fr);
  min-height: 100vh;
}

.sidebar {
  border-right: 1px solid #d8dee8;
  background: #ffffff;
  padding: 24px;
}

.workspace {
  padding: 24px;
}

.muted {
  color: #64748b;
}
```

- [ ] **Step 5: Verify skeleton**

Run: `pnpm build`

Expected: Vite build exits 0 and syntax checker exits 0.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml scripts/check-syntax.mjs index.html vite.config.mjs web/src/main.jsx web/src/App.jsx web/src/styles.css
git commit -m "feat: scaffold local workbench app"
```

## Task 2: Local App Configuration

**Files:**
- Create: `src/appConfig.mjs`
- Create: `test/appConfig.test.mjs`

- [ ] **Step 1: Write failing config tests**

Create `test/appConfig.test.mjs`:

```js
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import {
  defaultConfig,
  getConfigPath,
  loadAppConfig,
  saveAppConfig,
  validateAppConfig,
} from "../src/appConfig.mjs";

test("getConfigPath stores config outside the repository by default", () => {
  const configPath = getConfigPath({
    appData: "C:\\Users\\User\\AppData\\Roaming",
    home: "C:\\Users\\User",
  });

  assert.equal(configPath, "C:\\Users\\User\\AppData\\Roaming\\DailySummaryAgent\\config.json");
});

test("loadAppConfig returns safe defaults when config file is missing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "daily-config-"));
  const config = await loadAppConfig({ configPath: path.join(root, "config.json") });

  assert.equal(config.deepSeekApiKey, "");
  assert.equal(config.codexEnabled, false);
  assert.deepEqual(config.repositories, []);
  assert.match(config.outputDirectory, /Daily Reports$/);
});

test("saveAppConfig persists normalized repositories and output directory", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "daily-config-"));
  const configPath = path.join(root, "config.json");
  const config = validateAppConfig({
    deepSeekApiKey: "secret",
    outputDirectory: path.join(root, "reports"),
    codexEnabled: true,
    repositories: [
      {
        path: path.join(root, "repo"),
        businessName: "AI 电商详情图生成平台",
        keywords: ["agent-image", "图片生成"],
      },
    ],
  });

  await saveAppConfig(config, { configPath });
  const saved = JSON.parse(await readFile(configPath, "utf8"));

  assert.equal(saved.deepSeekApiKey, "secret");
  assert.equal(saved.outputDirectory, path.join(root, "reports"));
  assert.equal(saved.repositories[0].businessName, "AI 电商详情图生成平台");
});

test("validateAppConfig rejects repositories without keywords", () => {
  assert.throws(
    () =>
      validateAppConfig({
        ...defaultConfig(),
        repositories: [{ path: "C:\\repo", businessName: "项目", keywords: [] }],
      }),
    /keywords/,
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test test/appConfig.test.mjs`

Expected: FAIL with module not found for `src/appConfig.mjs`.

- [ ] **Step 3: Implement config module**

Create `src/appConfig.mjs`:

```js
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const appDirectoryName = "DailySummaryAgent";

export function getConfigPath({
  appData = process.env.APPDATA,
  home = os.homedir(),
  override = process.env.DAILY_SUMMARY_CONFIG,
} = {}) {
  if (override) {
    return path.resolve(override);
  }

  const baseDirectory = appData || path.join(home, ".daily-summary-agent");
  return path.join(baseDirectory, appDirectoryName, "config.json");
}

export function defaultConfig({ home = os.homedir() } = {}) {
  return {
    deepSeekApiKey: "",
    outputDirectory: path.join(home, "Documents", "Daily Reports"),
    codexEnabled: false,
    repositories: [],
  };
}

export async function loadAppConfig({ configPath = getConfigPath() } = {}) {
  try {
    const raw = await readFile(configPath, "utf8");
    return validateAppConfig(JSON.parse(raw));
  } catch (error) {
    if (error.code === "ENOENT") {
      return defaultConfig();
    }
    throw error;
  }
}

export async function saveAppConfig(config, { configPath = getConfigPath() } = {}) {
  const normalized = validateAppConfig(config);
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}

export function validateAppConfig(value) {
  const base = defaultConfig();
  const config = {
    ...base,
    ...(value || {}),
  };

  return {
    deepSeekApiKey: readString(config.deepSeekApiKey, "deepSeekApiKey"),
    outputDirectory: readRequiredString(config.outputDirectory, "outputDirectory"),
    codexEnabled: Boolean(config.codexEnabled),
    repositories: readRepositories(config.repositories),
  };
}

function readRepositories(repositories) {
  if (!Array.isArray(repositories)) {
    throw new Error("repositories must be an array.");
  }

  return repositories.map((repository, index) => ({
    path: readRequiredString(repository?.path, `repositories[${index}].path`),
    businessName: readRequiredString(repository?.businessName, `repositories[${index}].businessName`),
    keywords: readKeywords(repository?.keywords, index),
  }));
}

function readKeywords(keywords, repositoryIndex) {
  if (!Array.isArray(keywords) || keywords.length === 0) {
    throw new Error(`repositories[${repositoryIndex}].keywords must be a non-empty array.`);
  }

  return keywords.map((keyword, index) =>
    readRequiredString(keyword, `repositories[${repositoryIndex}].keywords[${index}]`),
  );
}

function readString(value, fieldName) {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string.`);
  }
  return value.trim();
}

function readRequiredString(value, fieldName) {
  const text = readString(value, fieldName);
  if (!text) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }
  return text;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test test/appConfig.test.mjs`

Expected: PASS with 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/appConfig.mjs test/appConfig.test.mjs
git commit -m "feat: add local app config"
```

## Task 3: Evidence Service

**Files:**
- Create: `src/evidenceService.mjs`
- Create: `test/evidenceService.test.mjs`

- [ ] **Step 1: Write failing evidence tests**

Create `test/evidenceService.test.mjs`:

```js
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { collectEvidence, validateRepositoryPath } from "../src/evidenceService.mjs";

test("validateRepositoryPath returns ok for a git repository", async () => {
  const runner = async () => ({ stdout: "true\n" });
  const result = await validateRepositoryPath("C:\\work\\repo", runner);

  assert.deepEqual(result, { ok: true, message: "Git repository detected." });
});

test("validateRepositoryPath returns readable error for non-git folders", async () => {
  const runner = async () => {
    throw new Error("not a git repository");
  };
  const result = await validateRepositoryPath("C:\\work\\notes", runner);

  assert.equal(result.ok, false);
  assert.match(result.message, /not a Git repository/);
});

test("collectEvidence combines git, manual context, and disabled Codex state", async () => {
  const repository = {
    path: path.join("C:", "work", "agent-image"),
    businessName: "AI 电商详情图生成平台",
    keywords: ["agent-image"],
  };
  const gitCollector = async () => ({
    repository,
    commits: [{ subject: "feat: 增加详情页文字一键优化", date: "2026-05-20T10:00:00+08:00" }],
    pendingWork: { hasChanges: true, changedItemCount: 2, stats: "" },
    errors: [],
  });

  const evidence = await collectEvidence({
    config: {
      repositories: [repository],
      codexEnabled: false,
    },
    date: "2026-05-20",
    manualContext: "上午完成了客户沟通，确认了下一版详情页风格。",
    gitCollector,
  });

  assert.equal(evidence.date, "2026-05-20");
  assert.equal(evidence.repositoryActivities.length, 1);
  assert.equal(evidence.codexSnippets.length, 0);
  assert.equal(evidence.codexEnabled, false);
  assert.match(evidence.manualContext, /客户沟通/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test test/evidenceService.test.mjs`

Expected: FAIL with module not found for `src/evidenceService.mjs`.

- [ ] **Step 3: Implement evidence service**

Create `src/evidenceService.mjs`:

```js
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { collectCodexSessions } from "./codexCollector.mjs";
import { getLocalDayRange } from "./dateRange.mjs";
import { collectRepositoryActivity } from "./gitCollector.mjs";

const execFileAsync = promisify(execFile);

export async function validateRepositoryPath(repositoryPath, runner = runGit) {
  try {
    await runner("git", ["-C", repositoryPath, "rev-parse", "--is-inside-work-tree"]);
    return { ok: true, message: "Git repository detected." };
  } catch {
    return {
      ok: false,
      message: "Selected folder is not a Git repository. Choose another folder or continue with manual context.",
    };
  }
}

export async function collectEvidence({
  config,
  date = undefined,
  manualContext = "",
  gitCollector = collectRepositoryActivity,
  codexCollector = collectCodexSessions,
}) {
  const range = getLocalDayRange(date || new Date());
  const repositoryActivities = await Promise.all(
    config.repositories.map((repository) => gitCollector(repository, range)),
  );
  const codexSnippets = config.codexEnabled
    ? await codexCollector({
        date: range.date,
        repositories: config.repositories,
      })
    : [];

  return {
    date: range.date,
    manualContext: String(manualContext || "").trim(),
    codexEnabled: Boolean(config.codexEnabled),
    repositoryActivities,
    codexSnippets,
  };
}

async function runGit(command, args) {
  const { stdout, stderr } = await execFileAsync(command, args, { encoding: "utf8" });
  return { stdout, stderr };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test test/evidenceService.test.mjs`

Expected: PASS with 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/evidenceService.mjs test/evidenceService.test.mjs
git commit -m "feat: add evidence service"
```

## Task 4: Report Service With DeepSeek Errors And Save Conflicts

**Files:**
- Create: `src/reportService.mjs`
- Create: `test/reportService.test.mjs`

- [ ] **Step 1: Write failing report service tests**

Create `test/reportService.test.mjs`:

```js
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { generateReportFromEvidence, saveReportFile } from "../src/reportService.mjs";

test("generateReportFromEvidence requires DeepSeek key and does not silently fallback", async () => {
  await assert.rejects(
    () =>
      generateReportFromEvidence({
        config: { deepSeekApiKey: "" },
        evidence: {
          date: "2026-05-20",
          repositoryActivities: [],
          codexSnippets: [],
          manualContext: "完成客户沟通。",
        },
      }),
    /DeepSeek API key/,
  );
});

test("generateReportFromEvidence sends manual context with evidence", async () => {
  const fetchImpl = async () => ({
    ok: true,
    async json() {
      return {
        choices: [
          {
            message: {
              content: JSON.stringify({
                sections: [{ heading: "项目进展", items: ["完成客户沟通并确认下一版方向。"] }],
              }),
            },
          },
        ],
      };
    },
  });

  const result = await generateReportFromEvidence({
    config: { deepSeekApiKey: "test-key" },
    evidence: {
      date: "2026-05-20",
      repositoryActivities: [],
      codexSnippets: [],
      manualContext: "完成客户沟通并确认下一版方向。",
    },
    fetchImpl,
  });

  assert.match(result.markdown, /2026-05-20 日报/);
  assert.match(result.markdown, /完成客户沟通/);
});

test("saveReportFile refuses to overwrite existing files unless overwrite is true", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "daily-report-save-"));
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, "2026-05-20-daily.md"), "old", "utf8");

  await assert.rejects(
    () =>
      saveReportFile({
        outputDirectory: root,
        date: "2026-05-20",
        markdown: "new",
        overwrite: false,
      }),
    /already exists/,
  );

  const result = await saveReportFile({
    outputDirectory: root,
    date: "2026-05-20",
    markdown: "new",
    overwrite: true,
  });

  assert.equal(await readFile(result.outputPath, "utf8"), "new");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test test/reportService.test.mjs`

Expected: FAIL with module not found for `src/reportService.mjs`.

- [ ] **Step 3: Implement report service**

Create `src/reportService.mjs`:

```js
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { createDeepSeekDailySummary } from "./deepseekWriter.mjs";
import { renderReport } from "./reportWriter.mjs";

export async function generateReportFromEvidence({ config, evidence, fetchImpl = fetch }) {
  if (!config.deepSeekApiKey) {
    throw new Error("DeepSeek API key is required before generating a report.");
  }

  const summary = await createDeepSeekDailySummary({
    apiKey: config.deepSeekApiKey,
    date: evidence.date,
    repositoryActivities: evidence.repositoryActivities,
    codexSnippets: [
      ...evidence.codexSnippets,
      manualContextToSnippet(evidence.manualContext),
    ].filter(Boolean),
    fetchImpl,
  });

  return {
    date: evidence.date,
    summary,
    markdown: renderReport(summary),
  };
}

export async function saveReportFile({ outputDirectory, date, markdown, overwrite = false }) {
  await mkdir(outputDirectory, { recursive: true });
  const outputPath = path.join(outputDirectory, `${date}-daily.md`);

  if (!overwrite && (await exists(outputPath))) {
    throw new Error(`${outputPath} already exists.`);
  }

  await writeFile(outputPath, markdown, "utf8");
  return { outputPath };
}

function manualContextToSnippet(manualContext) {
  const text = String(manualContext || "").trim();
  if (!text) {
    return null;
  }

  return {
    text,
    matchedRepositories: [],
    role: "user",
    source: "manual-context",
  };
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test test/reportService.test.mjs`

Expected: PASS with 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/reportService.mjs test/reportService.test.mjs
git commit -m "feat: add report generation service"
```

## Task 5: Local HTTP Service

**Files:**
- Create: `src/server/httpServer.mjs`
- Create: `src/server/main.mjs`
- Create: `test/httpServer.test.mjs`

- [ ] **Step 1: Write failing HTTP tests**

Create `test/httpServer.test.mjs`:

```js
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { createHttpServer } from "../src/server/httpServer.mjs";

test("local service reads and saves config", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "daily-http-"));
  const server = createHttpServer({
    configPath: path.join(root, "config.json"),
  });
  await server.listen(0);

  const baseUrl = `http://127.0.0.1:${server.port}`;
  const readResponse = await fetch(`${baseUrl}/api/config`);
  const initialConfig = await readResponse.json();
  assert.equal(initialConfig.codexEnabled, false);

  const saveResponse = await fetch(`${baseUrl}/api/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...initialConfig,
      deepSeekApiKey: "secret",
      outputDirectory: path.join(root, "reports"),
      repositories: [
        {
          path: path.join(root, "repo"),
          businessName: "项目",
          keywords: ["repo"],
        },
      ],
    }),
  });

  assert.equal(saveResponse.status, 200);
  const saved = await saveResponse.json();
  assert.equal(saved.deepSeekApiKey, "secret");

  await server.close();
});

test("local service returns JSON errors", async () => {
  const server = createHttpServer();
  await server.listen(0);

  const response = await fetch(`http://127.0.0.1:${server.port}/api/unknown`);
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.match(body.error, /Not found/);

  await server.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test test/httpServer.test.mjs`

Expected: FAIL with module not found for `src/server/httpServer.mjs`.

- [ ] **Step 3: Implement HTTP server**

Create `src/server/httpServer.mjs`:

```js
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { loadAppConfig, saveAppConfig } from "../appConfig.mjs";
import { collectEvidence, validateRepositoryPath } from "../evidenceService.mjs";
import { generateReportFromEvidence, saveReportFile } from "../reportService.mjs";

export function createHttpServer({ configPath, staticDirectory = path.join(process.cwd(), "dist") } = {}) {
  const server = http.createServer(async (request, response) => {
    try {
      await handleRequest({ request, response, configPath, staticDirectory });
    } catch (error) {
      sendJson(response, error.statusCode || 500, { error: error.message });
    }
  });

  return {
    get port() {
      return server.address().port;
    },
    listen(port = 0) {
      return new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
    },
    close() {
      return new Promise((resolve) => server.close(resolve));
    },
  };
}

async function handleRequest({ request, response, configPath, staticDirectory }) {
  const url = new URL(request.url, "http://127.0.0.1");

  if (request.method === "GET" && url.pathname === "/api/config") {
    sendJson(response, 200, await loadAppConfig({ configPath }));
    return;
  }

  if (request.method === "PUT" && url.pathname === "/api/config") {
    const body = await readJson(request);
    sendJson(response, 200, await saveAppConfig(body, { configPath }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/repositories/validate") {
    const body = await readJson(request);
    sendJson(response, 200, await validateRepositoryPath(body.path));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/evidence") {
    const body = await readJson(request);
    const config = await loadAppConfig({ configPath });
    sendJson(response, 200, await collectEvidence({ config, manualContext: body.manualContext, date: body.date }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/generate") {
    const evidence = await readJson(request);
    const config = await loadAppConfig({ configPath });
    sendJson(response, 200, await generateReportFromEvidence({ config, evidence }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/report/save") {
    const body = await readJson(request);
    const config = await loadAppConfig({ configPath });
    sendJson(
      response,
      200,
      await saveReportFile({
        outputDirectory: config.outputDirectory,
        date: body.date,
        markdown: body.markdown,
        overwrite: Boolean(body.overwrite),
      }),
    );
    return;
  }

  if (request.method === "GET" && !url.pathname.startsWith("/api/")) {
    await serveStatic({ response, staticDirectory, pathname: url.pathname });
    return;
  }

  sendJson(response, 404, { error: "Not found." });
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function serveStatic({ response, staticDirectory, pathname }) {
  const filePath = path.join(staticDirectory, pathname === "/" ? "index.html" : pathname);
  if (!(await exists(filePath))) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  const content = await readFile(filePath);
  response.writeHead(200, { "Content-Type": contentTypeFor(filePath) });
  response.end(content);
}

function contentTypeFor(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  return "application/octet-stream";
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
```

Create `src/server/main.mjs`:

```js
import { createHttpServer } from "./httpServer.mjs";

const port = readPort(process.argv);
const server = createHttpServer();
await server.listen(port);

console.log(`Daily Summary Agent service listening on http://127.0.0.1:${server.port}`);

function readPort(args) {
  const index = args.indexOf("--port");
  if (index === -1) {
    return Number(process.env.PORT || 8787);
  }
  return Number(args[index + 1]);
}
```

- [ ] **Step 4: Run HTTP tests**

Run: `pnpm test test/httpServer.test.mjs`

Expected: PASS with 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/server/httpServer.mjs src/server/main.mjs test/httpServer.test.mjs
git commit -m "feat: add local workbench service"
```

## Task 6: Browser API Client And Workbench State

**Files:**
- Create: `web/src/apiClient.js`
- Modify: `web/src/App.jsx`

- [ ] **Step 1: Add API client**

Create `web/src/apiClient.js`:

```js
export async function getConfig() {
  return request("/api/config");
}

export async function saveConfig(config) {
  return request("/api/config", {
    method: "PUT",
    body: config,
  });
}

export async function validateRepository(path) {
  return request("/api/repositories/validate", {
    method: "POST",
    body: { path },
  });
}

export async function collectEvidence({ manualContext, date }) {
  return request("/api/evidence", {
    method: "POST",
    body: { manualContext, date },
  });
}

export async function generateReport(evidence) {
  return request("/api/generate", {
    method: "POST",
    body: evidence,
  });
}

export async function saveReport({ date, markdown, overwrite }) {
  return request("/api/report/save", {
    method: "POST",
    body: { date, markdown, overwrite },
  });
}

async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }

  return payload;
}
```

- [ ] **Step 2: Replace App with stateful shell**

Modify `web/src/App.jsx`:

```jsx
import { useEffect, useState } from "react";

import { collectEvidence, generateReport, getConfig, saveConfig, saveReport } from "./apiClient.js";

const emptyEvidence = {
  repositoryActivities: [],
  codexSnippets: [],
  manualContext: "",
};

export default function App() {
  const [config, setConfig] = useState(null);
  const [manualContext, setManualContext] = useState("");
  const [evidence, setEvidence] = useState(emptyEvidence);
  const [markdown, setMarkdown] = useState("");
  const [status, setStatus] = useState("正在加载配置...");
  const [error, setError] = useState("");

  useEffect(() => {
    getConfig()
      .then((loaded) => {
        setConfig(loaded);
        setStatus(loaded.repositories.length === 0 ? "添加第一个仓库开始使用。" : "配置已加载。");
      })
      .catch((loadError) => setError(loadError.message));
  }, []);

  async function handleSaveConfig(nextConfig) {
    const saved = await saveConfig(nextConfig);
    setConfig(saved);
    setStatus("配置已保存。");
  }

  async function handleCollectEvidence() {
    setError("");
    setStatus("正在读取今日证据...");
    const nextEvidence = await collectEvidence({ manualContext });
    setEvidence(nextEvidence);
    setStatus("证据已更新，可以生成日报。");
  }

  async function handleGenerate() {
    setError("");
    setStatus("正在调用 DeepSeek...");
    const result = await generateReport(evidence);
    setMarkdown(result.markdown);
    setStatus("日报已生成，可以编辑后保存。");
  }

  async function handleSaveReport(overwrite = false) {
    setError("");
    const result = await saveReport({ date: evidence.date, markdown, overwrite });
    setStatus(`已保存到 ${result.outputPath}`);
  }

  if (!config) {
    return <main className="loading">{error || status}</main>;
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <h1>日报工作台</h1>
        <p className="muted">{status}</p>
        <pre className="debug-panel">{JSON.stringify(config, null, 2)}</pre>
        <button onClick={() => handleSaveConfig(config)}>保存配置</button>
      </aside>
      <section className="workspace">
        {error ? <div className="error">{error}</div> : null}
        <h2>今日证据</h2>
        <textarea
          className="manual-context"
          value={manualContext}
          onChange={(event) => setManualContext(event.target.value)}
          aria-label="补充会议、沟通、非代码工作..."
        />
        <button onClick={handleCollectEvidence}>读取证据</button>
        <button onClick={handleGenerate}>生成日报</button>
        <h2>Markdown</h2>
        <textarea
          className="markdown-editor"
          value={markdown}
          onChange={(event) => setMarkdown(event.target.value)}
        />
        <button onClick={() => handleSaveReport(false)}>保存日报</button>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Build to verify browser code**

Run: `pnpm build`

Expected: Vite build and syntax checker exit 0.

- [ ] **Step 4: Commit**

```bash
git add web/src/apiClient.js web/src/App.jsx
git commit -m "feat: connect workbench to local service"
```

## Task 7: Workbench UI Components

**Files:**
- Create: `web/src/components/Sidebar.jsx`
- Create: `web/src/components/EvidencePanel.jsx`
- Create: `web/src/components/MarkdownEditor.jsx`
- Modify: `web/src/App.jsx`
- Modify: `web/src/styles.css`

- [ ] **Step 1: Create Sidebar component**

Create `web/src/components/Sidebar.jsx`:

```jsx
export default function Sidebar({ config, onChange, onSave }) {
  const repositories = config.repositories;

  function updateField(field, value) {
    onChange({ ...config, [field]: value });
  }

  function addRepository() {
    onChange({
      ...config,
      repositories: [
        ...repositories,
        {
          path: "",
          businessName: "",
          keywords: [],
        },
      ],
    });
  }

  function updateRepository(index, patch) {
    onChange({
      ...config,
      repositories: repositories.map((repository, repositoryIndex) =>
        repositoryIndex === index ? { ...repository, ...patch } : repository,
      ),
    });
  }

  return (
    <aside className="sidebar">
      <h1>日报工作台</h1>
      <label>
        DeepSeek API Key
        <input
          type="password"
          value={config.deepSeekApiKey}
          onChange={(event) => updateField("deepSeekApiKey", event.target.value)}
          aria-label="sk-..."
        />
      </label>
      <label>
        日报输出目录
        <input
          value={config.outputDirectory}
          onChange={(event) => updateField("outputDirectory", event.target.value)}
          aria-label="C:\\Users\\you\\Documents\\Daily Reports"
        />
      </label>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={config.codexEnabled}
          onChange={(event) => updateField("codexEnabled", event.target.checked)}
        />
        读取 Codex 今日对话
      </label>
      <section className="repository-list">
        <div className="section-header">
          <h2>仓库</h2>
          <button onClick={addRepository}>添加仓库</button>
        </div>
        {repositories.length === 0 ? <p className="empty">添加第一个仓库开始生成日报。</p> : null}
        {repositories.map((repository, index) => (
          <div className="repository-card" key={index}>
            <input
              value={repository.path}
              onChange={(event) => updateRepository(index, { path: event.target.value })}
              aria-label="仓库路径"
            />
            <input
              value={repository.businessName}
              onChange={(event) => updateRepository(index, { businessName: event.target.value })}
              aria-label="项目名称"
            />
            <input
              value={repository.keywords.join(", ")}
              onChange={(event) =>
                updateRepository(index, {
                  keywords: event.target.value
                    .split(",")
                    .map((keyword) => keyword.trim())
                    .filter(Boolean),
                })
              }
              aria-label="关键词，用逗号分隔"
            />
          </div>
        ))}
      </section>
      <button className="primary" onClick={onSave}>保存配置</button>
      <p className="hint">API Key 只保存在本机配置文件里，不要提交配置文件。</p>
    </aside>
  );
}
```

- [ ] **Step 2: Create EvidencePanel component**

Create `web/src/components/EvidencePanel.jsx`:

```jsx
export default function EvidencePanel({ evidence, manualContext, onManualContextChange, onRefresh, onGenerate }) {
  const activities = evidence.repositoryActivities || [];

  return (
    <section className="panel">
      <div className="section-header">
        <h2>今日证据</h2>
        <button onClick={onRefresh}>读取证据</button>
      </div>
      <textarea
        className="manual-context"
        value={manualContext}
        onChange={(event) => onManualContextChange(event.target.value)}
        aria-label="补充会议、沟通、产品决策、临时支持、非代码工作..."
      />
      {activities.map((activity) => (
        <article className="evidence-card" key={activity.repository.path}>
          <h3>{activity.repository.businessName}</h3>
          {activity.errors.length > 0 ? (
            <div className="warning">{activity.errors.join("\n")}</div>
          ) : null}
          <p className="muted">今日提交：{activity.commits.length} 条</p>
          <ul>
            {activity.commits.map((commit) => (
              <li key={`${commit.hash}-${commit.subject}`}>{commit.subject}</li>
            ))}
          </ul>
          <p className="muted">
            未提交变更：
            {activity.pendingWork.hasChanges ? `${activity.pendingWork.changedItemCount} 项，将作为待跟进` : "无"}
          </p>
        </article>
      ))}
      {evidence.codexEnabled ? (
        <article className="evidence-card">
          <h3>Codex 命中片段</h3>
          <ul>
            {(evidence.codexSnippets || []).map((snippet, index) => (
              <li key={index}>{snippet.text}</li>
            ))}
          </ul>
        </article>
      ) : (
        <p className="muted">Codex 读取已关闭。</p>
      )}
      <button className="primary" onClick={onGenerate}>生成日报</button>
    </section>
  );
}
```

- [ ] **Step 3: Create MarkdownEditor component**

Create `web/src/components/MarkdownEditor.jsx`:

```jsx
export default function MarkdownEditor({ markdown, onChange, onSave }) {
  return (
    <section className="panel markdown-panel">
      <div className="section-header">
        <h2>Markdown 日报</h2>
        <button onClick={() => onSave(false)}>保存</button>
      </div>
      <textarea
        className="markdown-editor"
        value={markdown}
        onChange={(event) => onChange(event.target.value)}
        aria-label="生成后的日报会显示在这里，可以直接编辑。"
      />
    </section>
  );
}
```

- [ ] **Step 4: Wire components in App**

Modify `web/src/App.jsx` to import and render components:

```jsx
import { useEffect, useState } from "react";

import { collectEvidence, generateReport, getConfig, saveConfig, saveReport } from "./apiClient.js";
import EvidencePanel from "./components/EvidencePanel.jsx";
import MarkdownEditor from "./components/MarkdownEditor.jsx";
import Sidebar from "./components/Sidebar.jsx";

const emptyEvidence = {
  date: "",
  repositoryActivities: [],
  codexSnippets: [],
  manualContext: "",
  codexEnabled: false,
};

export default function App() {
  const [config, setConfig] = useState(null);
  const [manualContext, setManualContext] = useState("");
  const [evidence, setEvidence] = useState(emptyEvidence);
  const [markdown, setMarkdown] = useState("");
  const [status, setStatus] = useState("正在加载配置...");
  const [error, setError] = useState("");

  useEffect(() => {
    getConfig()
      .then((loaded) => {
        setConfig(loaded);
        setStatus(loaded.repositories.length === 0 ? "添加第一个仓库开始使用。" : "配置已加载。");
      })
      .catch((loadError) => setError(loadError.message));
  }, []);

  async function handleSaveConfig() {
    setError("");
    try {
      setConfig(await saveConfig(config));
      setStatus("配置已保存。");
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  async function handleCollectEvidence() {
    setError("");
    try {
      setStatus("正在读取今日证据...");
      const nextEvidence = await collectEvidence({ manualContext });
      setEvidence(nextEvidence);
      setStatus("证据已更新，可以生成日报。");
    } catch (collectError) {
      setError(collectError.message);
    }
  }

  async function handleGenerate() {
    setError("");
    try {
      setStatus("正在调用 DeepSeek...");
      const result = await generateReport(evidence);
      setMarkdown(result.markdown);
      setStatus("日报已生成，可以编辑后保存。");
    } catch (generateError) {
      setError(generateError.message);
    }
  }

  async function handleSaveReport(overwrite = false) {
    setError("");
    try {
      const result = await saveReport({ date: evidence.date, markdown, overwrite });
      setStatus(`已保存到 ${result.outputPath}`);
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  if (!config) {
    return <main className="loading">{error || status}</main>;
  }

  return (
    <main className="app-shell">
      <Sidebar config={config} onChange={setConfig} onSave={handleSaveConfig} />
      <section className="workspace">
        <div className="status-bar">
          <span>{status}</span>
          {error ? <strong>{error}</strong> : null}
        </div>
        <EvidencePanel
          evidence={evidence}
          manualContext={manualContext}
          onManualContextChange={setManualContext}
          onRefresh={handleCollectEvidence}
          onGenerate={handleGenerate}
        />
        <MarkdownEditor markdown={markdown} onChange={setMarkdown} onSave={handleSaveReport} />
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Add desktop styling**

Modify `web/src/styles.css` with the full desktop layout:

```css
:root {
  color: #1e293b;
  background: #f6f7f9;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

button,
input,
textarea {
  font: inherit;
}

button {
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #ffffff;
  color: #1e293b;
  cursor: pointer;
  padding: 8px 12px;
}

button.primary {
  border-color: #14532d;
  background: #166534;
  color: #ffffff;
}

input,
textarea {
  width: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 9px 10px;
}

label {
  display: grid;
  gap: 6px;
  margin: 14px 0;
  font-size: 14px;
  font-weight: 600;
}

.app-shell {
  display: grid;
  grid-template-columns: minmax(320px, 380px) minmax(0, 1fr);
  min-height: 100vh;
}

.sidebar {
  border-right: 1px solid #d8dee8;
  background: #ffffff;
  padding: 24px;
  overflow-y: auto;
}

.workspace {
  display: grid;
  grid-template-rows: auto minmax(260px, 1fr) minmax(280px, 1fr);
  gap: 16px;
  padding: 24px;
  min-width: 0;
}

.panel,
.repository-card,
.evidence-card,
.status-bar {
  border: 1px solid #d8dee8;
  border-radius: 8px;
  background: #ffffff;
}

.panel {
  padding: 18px;
  overflow: auto;
}

.repository-card,
.evidence-card {
  padding: 12px;
  margin: 10px 0;
}

.section-header,
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.status-bar {
  padding: 10px 14px;
}

.muted,
.hint,
.empty {
  color: #64748b;
}

.warning,
.error,
.status-bar strong {
  color: #b45309;
  white-space: pre-wrap;
}

.manual-context {
  min-height: 90px;
  resize: vertical;
}

.markdown-editor {
  min-height: 220px;
  resize: vertical;
  font-family: "Cascadia Mono", "SFMono-Regular", Consolas, monospace;
  line-height: 1.6;
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.checkbox-row input {
  width: auto;
}
```

- [ ] **Step 6: Build**

Run: `pnpm build`

Expected: Vite build and syntax checker exit 0.

- [ ] **Step 7: Commit**

```bash
git add web/src/components/Sidebar.jsx web/src/components/EvidencePanel.jsx web/src/components/MarkdownEditor.jsx web/src/App.jsx web/src/styles.css
git commit -m "feat: build workbench interface"
```

## Task 8: Electron Shell And Folder Pickers

**Files:**
- Create: `electron/main.cjs`
- Create: `electron/preload.cjs`
- Create: `electron-builder.json`
- Create: `test/electronConfig.test.mjs`
- Modify: `web/src/components/Sidebar.jsx`

- [ ] **Step 1: Write packaging config test**

Create `test/electronConfig.test.mjs`:

```js
import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

test("electron-builder config targets Windows NSIS", async () => {
  const config = JSON.parse(await readFile("electron-builder.json", "utf8"));

  assert.equal(config.appId, "com.daily-summary-agent.app");
  assert.deepEqual(config.win.target, ["nsis"]);
  assert.equal(config.files.includes("dist/**"), true);
  assert.equal(config.files.includes("electron/**"), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test test/electronConfig.test.mjs`

Expected: FAIL with missing `electron-builder.json`.

- [ ] **Step 3: Add Electron files**

Create `electron/main.cjs`:

```js
const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("node:path");
const { spawn } = require("node:child_process");

let serviceProcess;

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1040,
    minHeight: 720,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.loadURL("http://127.0.0.1:8787");
}

function startService() {
  serviceProcess = spawn(process.execPath, [path.join(__dirname, "..", "src", "server", "main.mjs")], {
    stdio: "ignore",
    windowsHide: true,
  });
}

app.whenReady().then(() => {
  startService();
  createWindow();

  ipcMain.handle("choose-directory", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });

    return result.canceled ? "" : result.filePaths[0];
  });
});

app.on("before-quit", () => {
  if (serviceProcess && !serviceProcess.killed) {
    serviceProcess.kill();
  }
});
```

Create `electron/preload.cjs`:

```js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("dailySummary", {
  chooseDirectory: () => ipcRenderer.invoke("choose-directory"),
});
```

Create `electron-builder.json`:

```json
{
  "appId": "com.daily-summary-agent.app",
  "productName": "Daily Summary Agent",
  "directories": {
    "output": "release"
  },
  "files": [
    "dist/**",
    "electron/**",
    "src/**",
    "package.json"
  ],
  "win": {
    "target": ["nsis"]
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true
  }
}
```

- [ ] **Step 4: Wire folder picker in Sidebar**

Modify `web/src/components/Sidebar.jsx` so repository path and output directory can call Electron when available:

```jsx
async function chooseDirectory() {
  if (!window.dailySummary?.chooseDirectory) {
    return "";
  }
  return window.dailySummary.chooseDirectory();
}
```

Add buttons next to output directory and repository path inputs:

```jsx
<button
  type="button"
  onClick={async () => {
    const directory = await chooseDirectory();
    if (directory) updateField("outputDirectory", directory);
  }}
>
  选择
</button>
```

For each repository:

```jsx
<button
  type="button"
  onClick={async () => {
    const directory = await chooseDirectory();
    if (directory) updateRepository(index, { path: directory });
  }}
>
  选择文件夹
</button>
```

- [ ] **Step 5: Run tests and build**

Run: `pnpm test test/electronConfig.test.mjs`

Expected: PASS with 1 test passing.

Run: `pnpm build`

Expected: Vite build and syntax checker exit 0.

- [ ] **Step 6: Commit**

```bash
git add electron/main.cjs electron/preload.cjs electron-builder.json test/electronConfig.test.mjs web/src/components/Sidebar.jsx
git commit -m "feat: add electron shell"
```

## Task 9: End-To-End Browser Verification

**Files:**
- Modify only files needed to fix issues found during verification.

- [ ] **Step 1: Start local service**

Run in one terminal:

```bash
pnpm start:server
```

Expected: output contains `Daily Summary Agent service listening on http://127.0.0.1:8787`.

- [ ] **Step 2: Start Vite workbench**

Run in another terminal:

```bash
pnpm dev:web
```

Expected: output contains `http://127.0.0.1:5173`.

- [ ] **Step 3: Manual verification checklist**

Open `http://127.0.0.1:5173` and verify:

- First-run state says to add the first repository.
- DeepSeek API key can be entered and saved.
- Output directory can be entered and saved.
- A valid repository can be added with path, project name, and keywords.
- `读取证据` displays today's commit titles.
- Manual context remains visible before and after evidence refresh.
- Codex toggle stays off by default.
- With a valid DeepSeek key, `生成日报` fills the Markdown editor.
- Saving writes `YYYY-MM-DD-daily.md` to the output directory.
- If the report file already exists, the API returns a visible conflict error.

- [ ] **Step 4: Fix verification issues with tests first**

For each issue, add a test in the relevant existing test file before changing production code. Example for save conflict copy:

```js
test("save conflict message includes overwrite guidance", async () => {
  await assert.rejects(
    () =>
      saveReportFile({
        outputDirectory: existingDirectory,
        date: "2026-05-20",
        markdown: "new",
        overwrite: false,
      }),
    /already exists/,
  );
});
```

- [ ] **Step 5: Run full verification**

Run: `pnpm test`

Expected: all tests pass.

Run: `pnpm build`

Expected: Vite build and syntax checker exit 0.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "fix: polish workbench verification issues"
```

## Task 10: Windows Packaging Verification

**Files:**
- Modify only packaging files if packaging verification fails.

- [ ] **Step 1: Run Electron app locally**

Run: `pnpm electron`

Expected:

- Electron window opens.
- Local service starts automatically.
- Workbench loads without command-line browser steps.
- Folder picker buttons open Windows directory selection dialogs.

- [ ] **Step 2: Build Windows installer**

Run: `pnpm package:win`

Expected:

- Command exits 0.
- `release/` contains a Windows NSIS installer.

- [ ] **Step 3: Smoke test installer artifact**

Install the generated app on the same Windows machine and verify:

- App launches from Start menu or desktop shortcut.
- Configuration is stored under the app data directory.
- Existing project repository files are not modified by configuration changes.
- A report can be generated and saved.

- [ ] **Step 4: Commit packaging fixes**

If packaging files changed:

```bash
git add electron-builder.json electron/main.cjs electron/preload.cjs package.json
git commit -m "fix: stabilize windows packaging"
```

If no packaging files changed, do not create an empty commit.

## Final Verification

Run:

```bash
pnpm test
pnpm lint
pnpm build
```

Expected:

- `pnpm test`: all tests pass.
- `pnpm lint`: syntax checker exits 0.
- `pnpm build`: Vite build and syntax checker exit 0.

Manual acceptance:

- Browser workbench can generate and save a DeepSeek-written report.
- Electron app launches and displays the same workbench.
- Folder pickers work inside Electron.
- DeepSeek API failures appear as visible errors.
- Codex is off by default.
- Uncommitted changes are shown as pending evidence.

