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
  const safeDate = normalizeReportDate(date);
  const resolvedOutputDirectory = path.resolve(outputDirectory);
  await mkdir(resolvedOutputDirectory, { recursive: true });
  const outputPath = path.resolve(resolvedOutputDirectory, `${safeDate}-daily.md`);
  if (!isPathInside(resolvedOutputDirectory, outputPath)) {
    throw validationError("Report output path must stay inside the output directory.");
  }

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

function normalizeReportDate(date) {
  const text = String(date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw validationError("Report date must be YYYY-MM-DD.");
  }

  const [year, month, day] = text.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw validationError("Report date must be a valid calendar date.");
  }

  return text;
}

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function isPathInside(parentDirectory, filePath) {
  const relative = path.relative(parentDirectory, filePath);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
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
