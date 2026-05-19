import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createDeepSeekDailySummary } from "./deepseekWriter.mjs";
import { renderReport } from "./reportWriter.mjs";

export async function generateReportFromEvidence({ config, evidence, fetchImpl = fetch }) {
  if (!config?.deepSeekApiKey) {
    throw new Error("DeepSeek API key is required before generating a report.");
  }

  const manualContextSnippet = manualContextToSnippet(evidence.manualContext);
  const codexSnippets = manualContextSnippet
    ? [...evidence.codexSnippets, manualContextSnippet]
    : evidence.codexSnippets;

  const summary = await createDeepSeekDailySummary({
    apiKey: config.deepSeekApiKey,
    date: evidence.date,
    repositoryActivities: evidence.repositoryActivities,
    codexSnippets,
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

  try {
    await writeFile(outputPath, markdown, overwrite ? "utf8" : { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (!overwrite && error?.code === "EEXIST") {
      throw new Error(`${outputPath} already exists.`);
    }
    throw error;
  }

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
