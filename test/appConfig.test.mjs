import { mkdtemp, readFile, writeFile } from "node:fs/promises";
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

test("loadAppConfig loads and normalizes an existing JSON config file", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "daily-config-"));
  const configPath = path.join(root, "config.json");
  await writeFile(
    configPath,
    JSON.stringify({
      deepSeekApiKey: " secret ",
      outputDirectory: ` ${path.join(root, "reports")} `,
      codexEnabled: true,
      repositories: [
        {
          path: ` ${path.join(root, "repo")} `,
          businessName: " Project Alpha ",
          keywords: [" agent-image "],
        },
      ],
    }),
    "utf8",
  );

  const config = await loadAppConfig({ configPath });

  assert.equal(config.deepSeekApiKey, "secret");
  assert.equal(config.outputDirectory, path.join(root, "reports"));
  assert.equal(config.repositories[0].path, path.join(root, "repo"));
  assert.equal(config.repositories[0].businessName, "Project Alpha");
  assert.deepEqual(config.repositories[0].keywords, ["agent-image"]);
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

test("validateAppConfig rejects repositories without path", () => {
  assert.throws(
    () =>
      validateAppConfig({
        ...defaultConfig(),
        repositories: [{ path: " ", businessName: "Project", keywords: ["agent-image"] }],
      }),
    /path/,
  );
});

test("validateAppConfig rejects repositories without businessName", () => {
  assert.throws(
    () =>
      validateAppConfig({
        ...defaultConfig(),
        repositories: [{ path: "C:\\repo", businessName: " ", keywords: ["agent-image"] }],
      }),
    /businessName/,
  );
});
