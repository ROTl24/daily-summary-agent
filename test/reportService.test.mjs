import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { generateReportFromEvidence, saveReportFile } from "../src/reportService.mjs";

const baseEvidence = {
  date: "2026-05-20",
  manualContext: "完成客户沟通。",
  codexEnabled: false,
  repositoryActivities: [],
  codexSnippets: [],
};

test("generateReportFromEvidence requires DeepSeek key and does not silently fallback", async () => {
  await assert.rejects(
    generateReportFromEvidence({
      config: { deepSeekApiKey: "" },
      evidence: baseEvidence,
      fetchImpl: async () => {
        throw new Error("fetch should not be called without a key");
      },
    }),
    /DeepSeek API key/,
  );
});

test("generateReportFromEvidence sends manual context with evidence", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      async json() {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  sections: [
                    {
                      heading: "项目进展",
                      items: ["完成客户沟通并确认下一版方向。"],
                    },
                  ],
                }),
              },
            },
          ],
        };
      },
    };
  };

  const result = await generateReportFromEvidence({
    config: { deepSeekApiKey: "test-key" },
    evidence: {
      ...baseEvidence,
      manualContext: "完成客户沟通并确认下一版方向。",
    },
    fetchImpl,
  });

  assert.match(result.markdown, /2026-05-20 日报/);
  assert.match(result.markdown, /完成客户沟通/);
  assert.equal(calls.length, 1);
  assert.match(JSON.parse(calls[0].options.body).messages[1].content, /完成客户沟通并确认下一版方向。/);
});

test("saveReportFile refuses overwrite unless overwrite true", async () => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), "daily-summary-report-"));
  const outputPath = path.join(outputDirectory, "2026-05-20-daily.md");
  await writeFile(outputPath, "old", "utf8");

  await assert.rejects(
    saveReportFile({
      outputDirectory,
      date: "2026-05-20",
      markdown: "new",
      overwrite: false,
    }),
    /already exists/,
  );

  const result = await saveReportFile({
    outputDirectory,
    date: "2026-05-20",
    markdown: "new",
    overwrite: true,
  });

  assert.equal(result.outputPath, outputPath);
  assert.equal(await readFile(result.outputPath, "utf8"), "new");
});

test("saveReportFile rejects dates that could escape the output directory", async () => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), "daily-summary-report-"));

  await assert.rejects(
    saveReportFile({
      outputDirectory,
      date: "..\\..\\Desktop\\pwn",
      markdown: "new",
      overwrite: true,
    }),
    /date must be YYYY-MM-DD/,
  );
});

test("saveReportFile rejects invalid calendar dates", async () => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), "daily-summary-report-"));

  await assert.rejects(
    saveReportFile({
      outputDirectory,
      date: "2026-02-30",
      markdown: "new",
      overwrite: true,
    }),
    /date must be a valid calendar date/,
  );
});
