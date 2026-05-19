import test from "node:test";
import assert from "node:assert/strict";

import { createDeepSeekDailySummary } from "../src/deepseekWriter.mjs";

test("createDeepSeekDailySummary sends git evidence and parses JSON sections", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      async json() {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  sections: [
                    {
                      heading: "详情页生成能力优化",
                      items: [
                        "完成详情页文案一键优化能力建设，并修复生成中断后的恢复流程，提升内容生产效率和稳定性。",
                      ],
                    },
                  ],
                }),
              },
            },
          ],
        };
      },
    };
  };

  const summary = await createDeepSeekDailySummary({
    apiKey: "test-key",
    date: "2026-05-19",
    repositoryActivities: [
      {
        repository: {
          path: "C:\\work\\agent-image",
          businessName: "AI 电商详情图生成平台",
          keywords: ["agent-image"],
        },
        commits: [
          {
            hash: "e52820e",
            author: "Alice",
            date: "2026-05-19T11:50:13+08:00",
            subject: "feat: 增加详情页文字一键优化",
          },
          {
            hash: "0668e1c",
            author: "Alice",
            date: "2026-05-19T15:01:35+08:00",
            subject: "修复详情页生成与文字优化恢复流程",
          },
        ],
        pendingWork: {
          hasChanges: false,
          changedItemCount: 0,
          stats: "",
        },
        errors: [],
      },
    ],
    codexSnippets: [],
    fetchImpl,
  });

  assert.equal(summary.date, "2026-05-19");
  assert.equal(summary.sections[0].heading, "详情页生成能力优化");
  assert.equal(summary.sections[0].items[0], "完成详情页文案一键优化能力建设，并修复生成中断后的恢复流程，提升内容生产效率和稳定性。");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.deepseek.com/chat/completions");

  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.model, "deepseek-v4-flash");
  assert.equal(body.response_format.type, "json_object");
  assert.match(body.messages[1].content, /feat: 增加详情页文字一键优化/);
  assert.match(body.messages[1].content, /修复详情页生成与文字优化恢复流程/);
});
