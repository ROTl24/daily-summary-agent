import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

test("electron-builder config targets Windows NSIS", async () => {
  const config = JSON.parse(await readFile("electron-builder.json", "utf8"));

  assert.equal(config.appId, "com.daily-summary-agent.app");
  assert.deepEqual(config.win.target, ["nsis"]);
  assert.equal(config.win.signAndEditExecutable, false);
  assert.equal(config.files.includes("dist/**"), true);
  assert.equal(config.files.includes("electron/**"), true);
  assert.equal(config.files.includes("src/**"), true);
  assert.equal(config.files.includes("package.json"), true);
});

test("electron main starts the local server without spawning another process", async () => {
  const mainSource = await readFile("electron/main.cjs", "utf8");

  assert.match(mainSource, /createHttpServer/);
  assert.match(mainSource, /await\s+localServer\.listen\(8787\)/);
  assert.doesNotMatch(mainSource, /\bspawn\s*\(/);
  assert.match(mainSource, /ipcMain\.handle\("choose-directory"/);
});

test("electron preload exposes the folder picker bridge", async () => {
  const preloadSource = await readFile("electron/preload.cjs", "utf8");

  assert.match(preloadSource, /exposeInMainWorld\("dailySummary"/);
  assert.match(preloadSource, /chooseDirectory/);
});
