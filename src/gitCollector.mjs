import { execFile } from "node:child_process";

const NOT_GIT_REPOSITORY_ERROR =
  "Selected folder is not a Git repository. Choose a Git repository folder or turn off Git reading.";
const GIT_UNAVAILABLE_ERROR = "Git is not installed or is not available on PATH.";

export async function collectRepositoryActivity(repository, range, runner = runCommand) {
  const repositoryError = await validateRepository(repository, runner);
  if (repositoryError) {
    return emptyActivity(repository, [repositoryError]);
  }

  const errors = [];
  const commits = await collectCommits(repository, range, runner, errors);
  const pendingWork = await collectPendingWork(repository, runner, errors);

  return {
    repository,
    commits,
    pendingWork,
    errors,
  };
}

async function validateRepository(repository, runner) {
  try {
    const { stdout } = await runner("git", ["-C", repository.path, "rev-parse", "--is-inside-work-tree"]);
    return stdout.trim() === "true" ? "" : NOT_GIT_REPOSITORY_ERROR;
  } catch (error) {
    if (error.code === "ENOENT") {
      return GIT_UNAVAILABLE_ERROR;
    }

    if (isNotGitRepositoryError(error)) {
      return NOT_GIT_REPOSITORY_ERROR;
    }

    return formatError("git rev-parse", error);
  }
}

function emptyActivity(repository, errors) {
  return {
    repository,
    commits: [],
    pendingWork: { hasChanges: false, changedItemCount: 0, stats: "" },
    errors,
  };
}

async function collectCommits(repository, range, runner, errors) {
  try {
    const { stdout } = await runner("git", [
      "-C",
      repository.path,
      "log",
      `--since=${range.since.toISOString()}`,
      `--until=${range.until.toISOString()}`,
      "--date=iso-strict",
      "--pretty=format:%H%x1f%an%x1f%ad%x1f%s%x1e",
    ]);

    return parseCommitLog(stdout);
  } catch (error) {
    errors.push(formatError("git log", error));
    return [];
  }
}

async function collectPendingWork(repository, runner, errors) {
  let statusOutput = "";
  let statsOutput = "";

  try {
    const { stdout } = await runner("git", ["-C", repository.path, "status", "--short"]);
    statusOutput = stdout;
  } catch (error) {
    errors.push(formatError("git status", error));
  }

  try {
    const { stdout } = await runner("git", ["-C", repository.path, "diff", "--stat"]);
    statsOutput = stdout;
  } catch (error) {
    errors.push(formatError("git diff", error));
  }

  const changedItemCount = statusOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;

  return {
    hasChanges: changedItemCount > 0,
    changedItemCount,
    stats: statsOutput.trim(),
  };
}

export function parseCommitLog(output) {
  return output
    .split("\x1e")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [hash, author, date, subject] = entry.split("\x1f");
      return { hash, author, date, subject };
    })
    .filter((commit) => commit.hash && commit.subject);
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        error.stderr = stderr;
        reject(error);
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

function formatError(command, error) {
  const detail = firstErrorLine(error.stderr) || error.message;
  return `${command}: ${detail}`;
}

function firstErrorLine(stderr = "") {
  return String(stderr)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
}

function isNotGitRepositoryError(error) {
  return /not a git repository/i.test(`${error.stderr || ""}\n${error.message || ""}`);
}
