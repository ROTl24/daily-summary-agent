const deepSeekEndpoint = "https://api.deepseek.com/chat/completions";
const defaultModel = "deepseek-v4-flash";
const maxGenerationAttempts = 3;

export async function createDeepSeekDailySummary({
  apiKey,
  date,
  repositoryActivities,
  codexSnippets,
  manualContext = "",
  fetchImpl = fetch,
  model = process.env.DEEPSEEK_MODEL || defaultModel,
  thinkingDepth = process.env.DEEPSEEK_THINKING_DEPTH || "disabled",
}) {
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is required for AI summary generation.");
  }

  let lastGenerationError;

  for (let attempt = 0; attempt < maxGenerationAttempts; attempt += 1) {
    const requestBody = buildRequestBody({
      model,
      date,
      repositoryActivities,
      codexSnippets,
      manualContext,
      thinkingDepth,
      retryReason: lastGenerationError?.message,
    });

    const response = await fetchImpl(deepSeekEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const detail = await readErrorBody(response);
      throw new Error(`DeepSeek request failed: ${response.status} ${detail}`.trim());
    }

    try {
      const payload = await response.json();
      const parsed = JSON.parse(readDeepSeekContent(payload));

      return {
        date,
        sections: normalizeSections(parsed),
      };
    } catch (error) {
      lastGenerationError = error;
      if (attempt + 1 < maxGenerationAttempts) {
        continue;
      }

      throw new Error(
        `DeepSeek did not return usable JSON content after ${maxGenerationAttempts} attempts: ${error.message}`,
      );
    }
  }

  throw new Error(
    `DeepSeek did not return usable JSON content after ${maxGenerationAttempts} attempts: ${
      lastGenerationError?.message || "Unknown response error."
    }`,
  );
}

function readDeepSeekContent(payload) {
  const choice = payload?.choices?.[0];
  const message = choice?.message;
  const content = message?.content;
  if (typeof content === "string" && content.trim()) {
    return content;
  }

  const finishReason = choice?.finish_reason ? ` finish_reason=${choice.finish_reason}.` : "";
  const hasReasoning = typeof message?.reasoning_content === "string" && message.reasoning_content.trim();
  const reasoningHint = hasReasoning ? " The response only included reasoning content, not final content." : "";
  throw new Error(`DeepSeek response did not include non-empty message content.${finishReason}${reasoningHint}`);
}

function buildRequestBody({
  model,
  date,
  repositoryActivities,
  codexSnippets,
  manualContext,
  thinkingDepth,
  retryReason,
}) {
  return {
    model,
    messages: [
      {
        role: "system",
        content: buildSystemPrompt(),
      },
      {
        role: "user",
        content: buildUserPrompt({ date, repositoryActivities, codexSnippets, manualContext }),
      },
      ...buildRetryMessages(retryReason),
    ],
    response_format: { type: "json_object" },
    ...thinkingOptions(thinkingDepth),
    max_tokens: 6000,
    stream: false,
  };
}

function buildRetryMessages(retryReason) {
  if (!retryReason) {
    return [];
  }

  return [
    {
      role: "user",
      content: [
        `上一轮 DeepSeek 响应不能用于生成日报：${retryReason}`,
        "请重新生成一个完整 JSON 对象，sections 至少包含一个带 items 的章节。只返回 JSON，不要 Markdown 代码块，不要解释文字。",
      ].join("\n"),
    },
  ];
}

function buildSystemPrompt() {
  return [
    "你是一个面向老板和主管汇报的日报写作助手。",
    "你只能根据用户提供的 Git 提交、未提交变更和 Codex 对话事实写日报，不允许编造收益、数据、发布状态或未提供的结论。",
    "读者不是技术人员，所以不要写 commit hash、文件名、diff、函数名、接口细节、框架名、依赖名、命令行细节、权限位或来源说明。",
    "不要出现 Vite、React、Electron、package.json、pnpm、lint、build、test、0o700、0o600、函数名或文件名；要把这些翻译成管理者能理解的表达。",
    "请把技术动作归纳成业务可读的项目进展：解决了什么使用问题、补齐了什么能力、降低了什么风险、让流程推进到什么状态。",
    "每个已完成事项都必须单独使用 STAR 写作，不能只输出一句流水账。",
    "每个 item 必须是一个 STAR 对象，字段为 title、situation、task、action、result。",
    "title 写事项标题；situation 写背景或问题；task 写当天承担的目标；action 写实际推进动作；result 写有证据支持的结果。",
    "result 只能基于证据表达已形成的能力、闭环、风险降低或待验证状态，不允许编造成效、数据、上线状态或业务影响。",
    "如果证据中存在多个独立事项，要尽量覆盖，不要只挑少数重点，也不要过度合并不同事项。",
    "用户手动补充内容是事实证据，和 Git 提交、Codex 对话具有同等优先级；如果 manualContext 有内容，即使没有仓库提交，也要基于它生成可用事项。",
    "待跟进事项必须是具体、可执行的下一步，例如需要谁审阅、验证什么流程、补充什么信息；仅凭未提交变更数量、文件数量或笼统的本地修改，不要生成待跟进事项。",
    "未提交变更只能作为风险提示，不能包装成已完成成果，也不能写成没有行动意义的待跟进事项。",
    '只输出 JSON，格式为：{"sections":[{"heading":"项目进展","items":[{"title":"...","situation":"...","task":"...","action":"...","result":"..."}]}]}。',
  ].join("\n");
}

function buildUserPrompt({ date, repositoryActivities, codexSnippets, manualContext }) {
  return [
    `日期：${date}`,
    "",
    "请生成 Markdown 日报正文所需的 JSON sections，不要包含日期标题。",
    "一级标题由你根据内容生成，例如“详情页生成能力优化”“质量与稳定性提升”“待跟进事项”。",
    "请面向老板和主管写，不要面向工程师写；如果证据里有技术词，请转译成业务、管理或交付语言。",
    "每个 item 都必须是一个独立 STAR 对象；不要返回字符串 item。",
    "相关提交可以合并成一个事项，但不要过度合并；如果证据能支撑多个独立事项，应分别输出多个 item。",
    "内容较多时优先覆盖 8 到 16 个有证据支撑的独立事项，避免只输出部分工作。",
    "如果事实证据里的 manualContext 有内容，不要忽略它；它通常来自用户手动补充的会议、沟通、产品决策或临时支持工作。",
    "待跟进事项只有在证据里出现明确下一步时才输出；不要写“处理未提交变更”“审阅本地修改”这类没有业务意义的内容。",
    "",
    "事实证据：",
    JSON.stringify(buildEvidence({ repositoryActivities, codexSnippets, manualContext }), null, 2),
  ].join("\n");
}

function buildEvidence({ repositoryActivities, codexSnippets, manualContext }) {
  return {
    manualContext: normalizeText(manualContext),
    repositories: repositoryActivities.map((activity) => ({
      businessName: activity.repository.businessName,
      commits: activity.commits.map((commit) => ({
        subject: commit.subject,
        date: commit.date,
      })),
      pendingWork: activity.pendingWork.hasChanges
        ? {
            changedItemCount: activity.pendingWork.changedItemCount,
            summary:
              "当前存在本地未提交变更。这只能说明工作区尚未收尾；除非其他证据提供具体下一步，否则不要据此生成待跟进事项。",
          }
        : null,
      errors: activity.errors,
    })),
    codexSnippets: codexSnippets.slice(0, 80).map((snippet) => ({
      matchedRepositories: snippet.matchedRepositories,
      role: snippet.role,
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
      items: Array.isArray(section.items) ? section.items.map(normalizeItem).filter(Boolean) : [],
    }))
    .filter((section) => section.heading && section.items.length > 0);

  if (sections.length === 0) {
    throw new Error("DeepSeek response did not contain any usable report sections.");
  }

  return sections;
}

function thinkingOptions(thinkingDepth) {
  const normalized = ["high", "max"].includes(thinkingDepth) ? thinkingDepth : "disabled";
  if (normalized === "disabled") {
    return { thinking: { type: "disabled" } };
  }

  return {
    thinking: { type: "enabled" },
    reasoning_effort: normalized,
  };
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeItem(item) {
  if (!item || typeof item !== "object") {
    return normalizeText(item);
  }

  const normalized = {
    title: normalizeText(item.title),
    situation: normalizeText(item.situation),
    task: normalizeText(item.task),
    action: normalizeText(item.action),
    result: normalizeText(item.result),
  };

  if (Object.values(normalized).every(Boolean)) {
    return normalized;
  }

  return "";
}

async function readErrorBody(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}
