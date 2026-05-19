import { execFile } from "node:child_process";

import { collectCodexSessions } from "./codexCollector.mjs";
import { getLocalDayRange } from "./dateRange.mjs";
import { collectRepositoryActivity } from "./gitCollector.mjs";

const NOT_GIT_REPOSITORY_MESSAGE =
  "Selected folder is not a Git repository. Choose another folder or continue with manual context.";
const MISSING_REPOSITORY_PATH_MESSAGE = "Choose a folder path before validating the repository.";
const GIT_UNAVAILABLE_MESSAGE = "Git is not installed or is not available on PATH.";

export async function validateRepositoryPath(repositoryPath, runner = runGit) {
  if (!String(repositoryPath || "").trim()) {
    return { ok: false, message: MISSING_REPOSITORY_PATH_MESSAGE };
  }

  try {
    const { stdout } = await runner("git", ["-C", repositoryPath, "rev-parse", "--is-inside-work-tree"]);
    if (stdout.trim() === "true") {
      return { ok: true, message: "Git repository detected." };
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      return { ok: false, message: GIT_UNAVAILABLE_MESSAGE };
    }

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
    repositoryActivities.push(await collectRepositoryEvidence(gitCollector, repository, range));
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

async function collectRepositoryEvidence(collector, repository, range) {
  try {
    return await collectWith(collector, repository, range);
  } catch (error) {
    return {
      repository,
      commits: [],
      pendingWork: { hasChanges: false, changedItemCount: 0, stats: "" },
      errors: [formatCollectorError(error)],
    };
  }
}

function formatCollectorError(error) {
  return error?.message || String(error);
}

function collectCodexWith(collector, options) {
  if (typeof collector === "function") {
    return collector(options);
  }

  return collector.collectCodexSessions(options);
}
