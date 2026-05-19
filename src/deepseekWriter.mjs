const deepSeekEndpoint = "https://api.deepseek.com/chat/completions";
const defaultModel = "deepseek-v4-flash";

export async function createDeepSeekDailySummary({
  apiKey,
  date,
  repositoryActivities,
  codexSnippets,
  fetchImpl = fetch,
  model = process.env.DEEPSEEK_MODEL || defaultModel,
}) {
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is required for AI summary generation.");
  }

  const response = await fetchImpl(deepSeekEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(),
        },
        {
          role: "user",
          content: buildUserPrompt({ date, repositoryActivities, codexSnippets }),
        },
      ],
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
      max_tokens: 1200,
      stream: false,
    }),
  });

  if (!response.ok) {
    const detail = await readErrorBody(response);
    throw new Error(`DeepSeek request failed: ${response.status} ${detail}`.trim());
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim() === "") {
    throw new Error("DeepSeek response did not include message content.");
  }

  return {
    date,
    sections: normalizeSections(JSON.parse(content)),
  };
}

function buildSystemPrompt() {
  return [
    "你是一个面向上级汇报的日报写作助手。",
    "你只能根据用户提供的 Git 提交、未提交变更和 Codex 对话事实写日报，不允许编造收益、数据、发布状态或未提供的结论。",
    "读者不是技术人员，所以不要写 commit hash、文件名、diff、函数名、接口细节或来源说明。",
    "请把技术动作归纳成项目进展，条目要自然、具体、结果导向。",
    "未提交变更只能写入待跟进事项，不能包装成已完成成果。",
    '只输出 JSON，格式为：{"sections":[{"heading":"项目进展","items":["..."]}]}。',
  ].join("\n");
}

function buildUserPrompt({ date, repositoryActivities, codexSnippets }) {
  return [
    `日期：${date}`,
    "",
    "请生成 Markdown 日报正文所需的 JSON sections，不要包含日期标题。",
    "一级标题由你根据内容生成，例如“详情页生成能力优化”“质量与稳定性提升”“待跟进事项”。",
    "每个 item 使用完整中文句子，尽量合并相关提交，避免流水账。",
    "",
    "事实证据：",
    JSON.stringify(buildEvidence({ repositoryActivities, codexSnippets }), null, 2),
  ].join("\n");
}

function buildEvidence({ repositoryActivities, codexSnippets }) {
  return {
    repositories: repositoryActivities.map((activity) => ({
      businessName: activity.repository.businessName,
      commits: activity.commits.map((commit) => ({
        subject: commit.subject,
        date: commit.date,
      })),
      pendingWork: activity.pendingWork.hasChanges
        ? {
            changedItemCount: activity.pendingWork.changedItemCount,
            summary: "当前存在未提交变更，应作为待跟进事项处理。",
          }
        : null,
      errors: activity.errors,
    })),
    codexSnippets: codexSnippets.slice(0, 30).map((snippet) => ({
      matchedRepositories: snippet.matchedRepositories,
      text: snippet.text,
    })),
  };
}

function normalizeSections(parsed) {
  if (!parsed || !Array.isArray(parsed.sections)) {
    throw new Error("DeepSeek response JSON must contain a sections array.");
  }

  const sections = parsed.sections
    .map((section) => ({
      heading: normalizeText(section.heading),
      items: Array.isArray(section.items) ? section.items.map(normalizeText).filter(Boolean) : [],
    }))
    .filter((section) => section.heading && section.items.length > 0);

  if (sections.length === 0) {
    throw new Error("DeepSeek response did not contain any usable report sections.");
  }

  return sections;
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

async function readErrorBody(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}
