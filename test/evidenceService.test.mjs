import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { collectEvidence, validateRepositoryPath } from "../src/evidenceService.mjs";

test("validateRepositoryPath returns ok for a git repository", async () => {
  const runner = async () => ({ stdout: "true\n" });
  const result = await validateRepositoryPath("C:\\work\\repo", runner);

  assert.deepEqual(result, { ok: true, message: "Git repository detected." });
});

test("validateRepositoryPath returns readable error for non-git folders", async () => {
  const runner = async () => {
    throw new Error("not a git repository");
  };
  const result = await validateRepositoryPath("C:\\work\\notes", runner);

  assert.equal(result.ok, false);
  assert.match(result.message, /not a Git repository/);
});

test("validateRepositoryPath returns readable error for blank paths", async () => {
  const result = await validateRepositoryPath("  ");

  assert.equal(result.ok, false);
  assert.match(result.message, /choose a folder/i);
});

test("validateRepositoryPath returns readable error when Git is unavailable", async () => {
  const runner = async () => {
    const error = new Error("spawn git ENOENT");
    error.code = "ENOENT";
    throw error;
  };
  const result = await validateRepositoryPath("C:\\work\\repo", runner);

  assert.equal(result.ok, false);
  assert.match(result.message, /Git is not installed/i);
});

test("collectEvidence combines git, manual context, and disabled Codex state", async () => {
  const repository = {
    path: path.join("C:", "work", "agent-image"),
    businessName: "AI 电商详情图生成平台",
    keywords: ["agent-image"],
  };
  const gitCollector = async () => ({
    repository,
    commits: [{ subject: "feat: 增加详情页文字一键优化", date: "2026-05-20T10:00:00+08:00" }],
    pendingWork: { hasChanges: true, changedItemCount: 2, stats: "" },
    errors: [],
  });

  const evidence = await collectEvidence({
    config: {
      repositories: [repository],
      codexEnabled: false,
    },
    date: "2026-05-20",
    manualContext: "上午完成了客户沟通，确认了下一版详情页风格。",
    gitCollector,
  });

  assert.equal(evidence.date, "2026-05-20");
  assert.equal(evidence.repositoryActivities.length, 1);
  assert.equal(evidence.codexSnippets.length, 0);
  assert.equal(evidence.codexEnabled, false);
  assert.match(evidence.manualContext, /客户沟通/);
});

test("collectEvidence calls Codex collector when enabled", async () => {
  const repository = {
    path: path.join("C:", "work", "daily-summary-agent"),
    businessName: "日报 Agent",
    keywords: ["daily-summary-agent"],
  };
  const calls = [];
  const gitCollector = async (repo, range) => {
    calls.push({ type: "git", repo, date: range.date });
    return {
      repository: repo,
      commits: [],
      pendingWork: { hasChanges: false, changedItemCount: 0, stats: "" },
      errors: [],
    };
  };
  const codexCollector = async ({ date, repositories }) => {
    calls.push({ type: "codex", date, repositories });
    return [{ text: "reviewed task plan", matchedRepositories: ["日报 Agent"] }];
  };

  const evidence = await collectEvidence({
    config: {
      repositories: [repository],
      codexEnabled: true,
    },
    date: new Date(2026, 4, 20, 15, 30),
    manualContext: "  finished review  ",
    gitCollector,
    codexCollector,
  });

  assert.equal(evidence.date, "2026-05-20");
  assert.equal(evidence.manualContext, "finished review");
  assert.equal(evidence.codexEnabled, true);
  assert.deepEqual(evidence.codexSnippets, [{ text: "reviewed task plan", matchedRepositories: ["日报 Agent"] }]);
  assert.deepEqual(calls, [
    { type: "git", repo: repository, date: "2026-05-20" },
    { type: "codex", date: "2026-05-20", repositories: [repository] },
  ]);
});

test("collectEvidence records one repository failure and continues collecting", async () => {
  const failedRepository = {
    path: path.join("C:", "work", "broken-repo"),
    businessName: "Broken Repository",
    keywords: ["broken-repo"],
  };
  const successfulRepository = {
    path: path.join("C:", "work", "working-repo"),
    businessName: "Working Repository",
    keywords: ["working-repo"],
  };
  const gitCollector = async (repository) => {
    if (repository === failedRepository) {
      throw new Error("git log failed");
    }

    return {
      repository,
      commits: [{ subject: "feat: keep collecting", date: "2026-05-20T11:00:00+08:00" }],
      pendingWork: { hasChanges: false, changedItemCount: 0, stats: "" },
      errors: [],
    };
  };

  const evidence = await collectEvidence({
    config: {
      repositories: [failedRepository, successfulRepository],
      codexEnabled: false,
    },
    date: "2026-05-20",
    manualContext: "  customer review finished  ",
    gitCollector,
  });

  assert.equal(evidence.manualContext, "customer review finished");
  assert.equal(evidence.repositoryActivities.length, 2);
  assert.deepEqual(evidence.repositoryActivities[0], {
    repository: failedRepository,
    commits: [],
    pendingWork: { hasChanges: false, changedItemCount: 0, stats: "" },
    errors: ["git log failed"],
  });
  assert.equal(evidence.repositoryActivities[1].repository, successfulRepository);
  assert.equal(evidence.repositoryActivities[1].commits[0].subject, "feat: keep collecting");
});
