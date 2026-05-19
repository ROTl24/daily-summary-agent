import { execFile } from "node:child_process";

export async function collectRepositoryActivity(repository, range, runner = runCommand) {
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
  const detail = error.stderr?.trim() || error.message;
  return `${command}: ${detail}`;
}
