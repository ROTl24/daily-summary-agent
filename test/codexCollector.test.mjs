import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { collectCodexSessions } from "../src/codexCollector.mjs";

test("collectCodexSessions keeps repo-related messages and skips injected context", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "codex-home-"));
  const sessionDir = path.join(root, "sessions", "2026", "05", "19");
  await mkdir(sessionDir, { recursive: true });

  const repoPath = path.join(root, "daily-summary-agent");
  const sessionPath = path.join(sessionDir, "rollout-2026-05-19T09-00-00-demo.jsonl");
  await writeFile(
    sessionPath,
    [
      JSON.stringify({
        timestamp: "2026-05-19T01:00:00.000Z",
        type: "session_meta",
        payload: { id: "session-1", cwd: repoPath },
      }),
      JSON.stringify({
        timestamp: "2026-05-19T01:01:00.000Z",
        type: "response_item",
        payload: {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: "# AGENTS.md instructions\n<environment_context>noise</environment_context>" },
            { type: "input_text", text: "确认日报 Agent 的 MVP 边界。" },
          ],
        },
      }),
      JSON.stringify({
        timestamp: "2026-05-19T01:02:00.000Z",
        type: "response_item",
        payload: {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "明确数据来源、筛选规则和 Markdown 输出。" }],
        },
      }),
    ].join("\n"),
    "utf8",
  );

  const snippets = await collectCodexSessions({
    codexHome: root,
    date: "2026-05-19",
    repositories: [
      {
        path: repoPath,
        businessName: "日报 Agent",
        keywords: ["daily-summary-agent", "日报 Agent"],
      },
    ],
  });

  assert.equal(snippets.length, 2);
  assert.equal(snippets[0].text, "确认日报 Agent 的 MVP 边界。");
  assert.equal(snippets[1].text, "明确数据来源、筛选规则和 Markdown 输出。");
});

test("collectCodexSessions conservatively includes only explicit keyword matches outside repo cwd", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "codex-home-"));
  const sessionDir = path.join(root, "sessions", "2026", "05", "19");
  await mkdir(sessionDir, { recursive: true });

  const sessionPath = path.join(sessionDir, "rollout-2026-05-19T10-00-00-demo.jsonl");
  await writeFile(
    sessionPath,
    [
      JSON.stringify({
        timestamp: "2026-05-19T02:00:00.000Z",
        type: "session_meta",
        payload: { id: "session-2", cwd: path.join(root, "other-project") },
      }),
      JSON.stringify({
        timestamp: "2026-05-19T02:01:00.000Z",
        type: "response_item",
        payload: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "日报工具需要把未提交内容放进待跟进。" }],
        },
      }),
      JSON.stringify({
        timestamp: "2026-05-19T02:02:00.000Z",
        type: "response_item",
        payload: {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "这是完全无关的聊天。" }],
        },
      }),
    ].join("\n"),
    "utf8",
  );

  const snippets = await collectCodexSessions({
    codexHome: root,
    date: "2026-05-19",
    repositories: [
      {
        path: path.join(root, "daily-summary-agent"),
        businessName: "日报 Agent",
        keywords: ["日报工具"],
      },
    ],
  });

  assert.deepEqual(
    snippets.map((snippet) => snippet.text),
    ["日报工具需要把未提交内容放进待跟进。"],
  );
});
