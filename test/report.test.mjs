import test from "node:test";
import assert from "node:assert/strict";

import { createDailySummary } from "../src/summarizer.mjs";
import { renderReport } from "../src/reportWriter.mjs";

test("renderReport creates manager-friendly sections without source notes or code details", () => {
  const summary = createDailySummary({
    date: "2026-05-19",
    repositoryActivities: [
      {
        repository: {
          path: "C:\\work\\daily-summary-agent",
          businessName: "日报 Agent",
          keywords: ["日报工具"],
        },
        commits: [
          {
            hash: "abc123",
            author: "Alice",
            date: "2026-05-19T09:00:00+08:00",
            subject: "feat: clarify MVP requirements in src/cli.mjs",
          },
        ],
        pendingWork: {
          hasChanges: true,
          changedItemCount: 2,
          stats: "src/cli.mjs | 20 ++++++++++++++++++++",
        },
        errors: [],
      },
    ],
    codexSnippets: [
      {
        text: "确认日报 Agent 的数据来源、输出格式和筛选规则。",
        matchedRepositories: ["日报 Agent"],
      },
    ],
  });

  const markdown = renderReport(summary);

  assert.match(markdown, /^2026-05-19 日报/);
  assert.match(markdown, /一、.+/);
  assert.match(markdown, /二、待跟进事项/);
  assert.match(markdown, /日报 Agent/);
  assert.match(markdown, /继续整理日报 Agent 当前未提交的工作内容/);
  assert.doesNotMatch(markdown, /src\/cli\.mjs/);
  assert.doesNotMatch(markdown, /来源/);
  assert.doesNotMatch(markdown, /diff/i);
});

test("renderReport formats mixed Chinese and English project names naturally", () => {
  const summary = createDailySummary({
    date: "2026-05-19",
    repositoryActivities: [
      {
        repository: {
          path: "C:\\work\\agent-image",
          businessName: "AI 电商详情图生成平台",
          keywords: ["agent-image"],
        },
        commits: [],
        pendingWork: {
          hasChanges: false,
          changedItemCount: 0,
          stats: "",
        },
        errors: [],
      },
    ],
    codexSnippets: [
      {
        text: "确认 AI 电商详情图生成平台 的需求边界。",
        matchedRepositories: ["AI 电商详情图生成平台"],
      },
    ],
  });

  const markdown = renderReport(summary);

  assert.match(markdown, /完成了 AI 电商详情图生成平台的需求边界梳理/);
  assert.doesNotMatch(markdown, /完成了AI/);
  assert.doesNotMatch(markdown, /平台 的/);
});

test("renderReport describes concrete same-day git commits instead of a generic category", () => {
  const summary = createDailySummary({
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
            hash: "448fa60",
            author: "Alice",
            date: "2026-05-19T11:49:33+08:00",
            subject: "feat: 贯通人群画像视觉策略",
          },
          {
            hash: "2e2722f",
            author: "Alice",
            date: "2026-05-19T11:49:54+08:00",
            subject: "feat: 强化 QA 系列生成一致性",
          },
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
          {
            hash: "8cb64b0",
            author: "Alice",
            date: "2026-05-19T17:48:36+08:00",
            subject: "优化详情页生成参考与视觉一致性",
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
    codexSnippets: [
      {
        text: "确认需求边界和输出格式。",
        matchedRepositories: ["AI 电商详情图生成平台"],
      },
    ],
  });

  const markdown = renderReport(summary);

  assert.match(markdown, /人群画像与视觉策略/);
  assert.match(markdown, /QA 系列图片的生成一致性/);
  assert.match(markdown, /详情页文案一键优化能力/);
  assert.match(markdown, /恢复流程/);
  assert.match(markdown, /视觉一致性/);
  assert.doesNotMatch(markdown, /需求梳理工作/);
});
