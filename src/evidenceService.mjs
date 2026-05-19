import { execFile } from "node:child_process";

import { collectCodexSessions } from "./codexCollector.mjs";
import { getLocalDayRange } from "./dateRange.mjs";
import { collectRepositoryActivity } from "./gitCollector.mjs";

const NOT_GIT_REPOSITORY_MESSAGE =
  "Selected folder is not a Git repository. Choose another folder or continue with manual context.";

export async function validateRepositoryPath(repositoryPath, runner = runGit) {
  try {
    const { stdout } = await runner("git", ["-C", repositoryPath, "rev-parse", "--is-inside-work-tree"]);
    if (stdout.trim() === "true") {
      return { ok: true, message: "Git repository detected." };
    }
  } catch {
    return { ok: false, message: NOT_GIT_REPOSITORY_MESSAGE };
  }

  return { ok: false, message: NOT_GIT_REPOSITORY_MESSAGE };
}

export async function collectEvidence({
  config,
  date = new Date(),
  manualContext = "",
  gitCollector = collectRepositoryActivity,
  codexCollector = collectCodexSessions,
}) {
  const range = getLocalDayRange(date);
  const repositories = config.repositories || [];
  const repositoryActivities = [];

  for (const repository of repositories) {
    repositoryActivities.push(await collectWith(gitCollector, repository, range));
  }

  const codexEnabled = config.codexEnabled === true;
  const codexSnippets = codexEnabled
    ? await collectCodexWith(codexCollector, { date: range.date, repositories })
    : [];

  return {
    date: range.date,
    manualContext: String(manualContext).trim(),
    codexEnabled,
    repositoryActivities,
    codexSnippets,
  };
}

export function runGit(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { encoding: "utf8" }, (error, stdout, stderr) => {
      if (error) {
        error.stderr = stderr;
        reject(error);
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

function collectWith(collector, repository, range) {
  if (typeof collector === "function") {
    return collector(repository, range);
  }

  return collector.collectRepositoryActivity(repository, range);
}

function collectCodexWith(collector, options) {
  if (typeof collector === "function") {
    return collector(options);
  }

  return collector.collectCodexSessions(options);
}
