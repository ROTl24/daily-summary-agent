#!/usr/bin/env node
import { collectCodexSessions } from "./codexCollector.mjs";
import { loadConfig } from "./config.mjs";
import { getLocalDayRange } from "./dateRange.mjs";
import { collectRepositoryActivity } from "./gitCollector.mjs";
import { createDeepSeekDailySummary } from "./deepseekWriter.mjs";
import { writeReport } from "./reportWriter.mjs";
import { createDailySummary } from "./summarizer.mjs";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = await loadConfig(args.config);
  const range = getLocalDayRange(args.date || new Date());
  const repositoryActivities = await Promise.all(
    config.repositories.map((repository) => collectRepositoryActivity(repository, range)),
  );
  const codexSnippets = await collectCodexSessions({
    date: range.date,
    repositories: config.repositories,
  });
  const summary = await createSummary({
    date: range.date,
    repositoryActivities,
    codexSnippets,
  });
  const outputPath = await writeReport(summary);

  console.log(`已生成日报: ${outputPath}`);
}

async function createSummary({ date, repositoryActivities, codexSnippets }) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.warn("未检测到 DEEPSEEK_API_KEY，已使用规则版生成。");
    return createDailySummary({ date, repositoryActivities, codexSnippets });
  }

  try {
    return await createDeepSeekDailySummary({
      apiKey,
      date,
      repositoryActivities,
      codexSnippets,
    });
  } catch (error) {
    console.warn(`DeepSeek 生成失败，已回退到规则版：${error.message}`);
    return createDailySummary({ date, repositoryActivities, codexSnippets });
  }
}

function parseArgs(args) {
  const parsed = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--config") {
      parsed.config = readArgValue(args, index, "--config");
      index += 1;
      continue;
    }

    if (arg === "--date") {
      parsed.date = readArgValue(args, index, "--date");
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function readArgValue(args, index, name) {
  const value = args[index + 1];
  if (!value) {
    throw new Error(`${name} requires a value.`);
  }

  return value;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
