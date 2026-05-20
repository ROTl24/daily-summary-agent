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
                        {
                          title: "完成详情页文案一键优化能力建设",
                          situation: "详情页内容调整依赖人工反复修改，影响内容生产效率。",
                          task: "补齐文案一键优化能力，并保证中断后可以继续处理。",
                          action: "建设文案优化能力，同时修复生成中断后的恢复流程。",
                          result: "详情页内容生产链路的效率和稳定性得到提升。",
                        },
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
  assert.deepEqual(summary.sections[0].items[0], {
    title: "完成详情页文案一键优化能力建设",
    situation: "详情页内容调整依赖人工反复修改，影响内容生产效率。",
    task: "补齐文案一键优化能力，并保证中断后可以继续处理。",
    action: "建设文案优化能力，同时修复生成中断后的恢复流程。",
    result: "详情页内容生产链路的效率和稳定性得到提升。",
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.deepseek.com/chat/completions");

  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.model, "deepseek-v4-flash");
  assert.equal(body.response_format.type, "json_object");
  assert.equal(body.max_tokens, 6000);
  assert.deepEqual(body.thinking, { type: "disabled" });
  assert.match(body.messages[0].content, /每个 item 必须是一个 STAR 对象/);
  assert.match(body.messages[0].content, /老板和主管/);
  assert.match(body.messages[0].content, /不要出现 Vite|React|Electron/);
  assert.match(body.messages[0].content, /仅凭未提交变更数量/);
  assert.match(body.messages[1].content, /不要过度合并/);
  assert.match(body.messages[1].content, /feat: 增加详情页文字一键优化/);
  assert.match(body.messages[1].content, /修复详情页生成与文字优化恢复流程/);
});

test("createDeepSeekDailySummary enables thinking effort when requested", async () => {
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
                      heading: "项目进展",
                      items: [
                        {
                          title: "整理日报内容",
                          situation: "管理层需要了解当天工作的重点。",
                          task: "生成更完整的日报。",
                          action: "汇总证据并组织表达。",
                          result: "形成了可审阅的日报草稿。",
                        },
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

  await createDeepSeekDailySummary({
    apiKey: "test-key",
    date: "2026-05-20",
    repositoryActivities: [],
    codexSnippets: [],
    thinkingDepth: "max",
    fetchImpl,
  });

  const body = JSON.parse(calls[0].options.body);
  assert.deepEqual(body.thinking, { type: "enabled" });
  assert.equal(body.reasoning_effort, "max");
});

test("createDeepSeekDailySummary retries once when DeepSeek returns malformed JSON", async () => {
  const calls = [];
  const responses = [
    '{"sections":[{"heading":"Progress","items":[{"title":"Broken"',
    JSON.stringify({
      sections: [
        {
          heading: "Progress",
          items: [
            {
              title: "Finished retry",
              situation: "The first response was malformed.",
              task: "Generate a usable report.",
              action: "Requested a second response.",
              result: "The report content was parsed successfully.",
            },
          ],
        },
      ],
    }),
  ];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      async json() {
        return {
          choices: [
            {
              message: {
                content: responses[calls.length - 1],
              },
            },
          ],
        };
      },
    };
  };

  const summary = await createDeepSeekDailySummary({
    apiKey: "test-key",
    date: "2026-05-20",
    repositoryActivities: [],
    codexSnippets: [],
    fetchImpl,
  });

  assert.equal(summary.sections[0].heading, "Progress");
  assert.equal(summary.sections[0].items[0].title, "Finished retry");
  assert.equal(calls.length, 2);
});

test("createDeepSeekDailySummary retries empty or missing DeepSeek content", async () => {
  const calls = [];
  const responses = [
    { choices: [{ message: {}, finish_reason: "stop" }] },
    { choices: [{ message: { content: "" }, finish_reason: "stop" }] },
    {
      choices: [
        {
          message: {
            content: JSON.stringify({
              sections: [
                {
                  heading: "Recovered",
                  items: [
                    {
                      title: "Recovered content",
                      situation: "DeepSeek returned empty content first.",
                      task: "Generate usable report content.",
                      action: "Retried the generation request.",
                      result: "The retry returned parseable content.",
                    },
                  ],
                },
              ],
            }),
          },
        },
      ],
    },
  ];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      async json() {
        return responses[calls.length - 1];
      },
    };
  };

  const summary = await createDeepSeekDailySummary({
    apiKey: "test-key",
    date: "2026-05-20",
    repositoryActivities: [],
    codexSnippets: [],
    fetchImpl,
  });

  assert.equal(summary.sections[0].heading, "Recovered");
  assert.equal(calls.length, 3);
});

test("createDeepSeekDailySummary retries JSON responses without usable sections", async () => {
  const calls = [];
  const responses = [
    JSON.stringify({ sections: [] }),
    JSON.stringify({
      sections: [
        {
          heading: "Usable",
          items: [
            {
              title: "Usable sections",
              situation: "The first JSON response had no report items.",
              task: "Generate valid report sections.",
              action: "Retried after validating the response shape.",
              result: "The response included a usable section.",
            },
          ],
        },
      ],
    }),
  ];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      async json() {
        return {
          choices: [{ message: { content: responses[calls.length - 1] } }],
        };
      },
    };
  };

  const summary = await createDeepSeekDailySummary({
    apiKey: "test-key",
    date: "2026-05-20",
    repositoryActivities: [],
    codexSnippets: [],
    fetchImpl,
  });

  assert.equal(summary.sections[0].heading, "Usable");
  assert.equal(calls.length, 2);
});

test("createDeepSeekDailySummary reports a clear error after repeated unusable responses", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      async json() {
        return {
          choices: [{ message: { content: "" }, finish_reason: "stop" }],
        };
      },
    };
  };

  await assert.rejects(
    createDeepSeekDailySummary({
      apiKey: "test-key",
      date: "2026-05-20",
      repositoryActivities: [],
      codexSnippets: [],
      fetchImpl,
    }),
    /DeepSeek did not return usable JSON content after 3 attempts/,
  );
  assert.equal(calls.length, 3);
});
