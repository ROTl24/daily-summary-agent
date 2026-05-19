import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { collectRepositoryActivity } from "../src/gitCollector.mjs";

test("collectRepositoryActivity parses commits and pending work", async () => {
  const calls = [];
  const runner = async (command, args) => {
    calls.push([command, args]);
    const joined = args.join(" ");
    if (joined.includes(" log ")) {
      return {
        stdout: [
          ["abc123", "Alice", "2026-05-19T09:00:00+08:00", "feat: clarify daily report MVP"].join("\x1f"),
          ["def456", "Alice", "2026-05-19T10:00:00+08:00", "fix: handle Codex session filtering"].join("\x1f"),
        ].join("\x1e"),
      };
    }
    if (joined.includes(" status ")) {
      return { stdout: " M src/cli.mjs\n?? reports/draft.md\n" };
    }
    if (joined.includes(" diff ")) {
      return { stdout: " 2 files changed, 20 insertions(+)\n" };
    }
    return { stdout: "" };
  };

  const activity = await collectRepositoryActivity(
    {
      path: path.join("C:", "work", "daily-summary-agent"),
      businessName: "日报 Agent",
      keywords: ["日报工具"],
    },
    {
      since: new Date("2026-05-19T00:00:00+08:00"),
      until: new Date("2026-05-19T23:59:59+08:00"),
    },
    runner,
  );

  assert.equal(activity.commits.length, 2);
  assert.equal(activity.commits[0].subject, "feat: clarify daily report MVP");
  assert.equal(activity.pendingWork.hasChanges, true);
  assert.equal(activity.pendingWork.changedItemCount, 2);
  assert.equal(activity.errors.length, 0);
  assert.equal(calls.length, 3);
});

test("collectRepositoryActivity records git errors without throwing", async () => {
  const activity = await collectRepositoryActivity(
    {
      path: path.join("C:", "missing", "repo"),
      businessName: "缺失项目",
      keywords: ["missing"],
    },
    {
      since: new Date("2026-05-19T00:00:00+08:00"),
      until: new Date("2026-05-19T23:59:59+08:00"),
    },
    async () => {
      throw new Error("not a git repository");
    },
  );

  assert.equal(activity.commits.length, 0);
  assert.equal(activity.pendingWork.hasChanges, false);
  assert.equal(activity.errors.length, 3);
});
