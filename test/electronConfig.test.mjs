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
