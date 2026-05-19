export function createDailySummary({ date, repositoryActivities, codexSnippets }) {
  const completedItems = createCompletedItems(repositoryActivities, codexSnippets);
  const pendingItems = createPendingItems(repositoryActivities);
  const sections = [];

  if (completedItems.length > 0) {
    sections.push({
      heading: "项目进展",
      items: completedItems,
    });
  }

  if (pendingItems.length > 0) {
    sections.push({
      heading: "待跟进事项",
      items: pendingItems,
    });
  }

  if (sections.length === 0) {
    sections.push({
      heading: "今日情况",
      items: ["今日未发现与已配置项目明确相关的完成事项。"],
    });
  }

  return { date, sections };
}

function createCompletedItems(repositoryActivities, codexSnippets) {
  const items = [];

  for (const activity of repositoryActivities) {
    const repositoryName = activity.repository.businessName;
    const sentenceName = formatProjectNameBeforeChinese(repositoryName);
    const repoSnippets = codexSnippets.filter((snippet) => snippet.matchedRepositories.includes(repositoryName));
    const commitItems = activity.commits
      .map((commit) => createCommitItem(sentenceName, commit.subject))
      .filter(Boolean);

    items.push(...commitItems);

    if (commitItems.length === 0 && hasPlanningSignal(repoSnippets)) {
      items.push(
        `完成了${sentenceName}的需求边界梳理，明确了输入范围、输出格式和筛选规则，为后续 demo 落地提供了清晰依据。`,
      );
    }
  }

  return uniqueItems(items);
}

function createPendingItems(repositoryActivities) {
  return repositoryActivities
    .filter((activity) => activity.pendingWork.hasChanges)
    .map(
      (activity) =>
        `继续整理${formatProjectNameBeforeChinese(activity.repository.businessName)}当前未提交的工作内容，完成验证后再纳入正式日报成果。`,
    );
}

function formatProjectNameBeforeChinese(name) {
  const needsLeadingSpace = /^[A-Za-z0-9]/.test(name);
  const needsTrailingSpace = /[A-Za-z0-9]$/.test(name);

  return `${needsLeadingSpace ? " " : ""}${name}${needsTrailingSpace ? " " : ""}`;
}

function createCommitItem(projectName, rawSubject) {
  const subject = normalizeCommitSubject(rawSubject);

  if (!subject) {
    return "";
  }

  if (/人群画像.*视觉策略|视觉策略.*人群画像/.test(subject)) {
    return `打通了${projectName}的人群画像与视觉策略能力，让详情图生成更能围绕目标人群和对应视觉表达展开。`;
  }

  if (/QA.*系列.*一致性|系列.*QA.*一致性/.test(subject)) {
    return `强化了${projectName}的 QA 系列图片的生成一致性，减少同一系列内容风格和表达不统一的问题。`;
  }

  if (/详情页.*文字.*一键优化|文字.*一键优化/.test(subject)) {
    return `增加了${projectName}的详情页文案一键优化能力，提高后续内容调整和复用效率。`;
  }

  if (/详情页生成.*文字优化.*恢复流程|恢复流程/.test(subject)) {
    return `修复了${projectName}的详情页生成与文字优化恢复流程，提升中断后继续处理的稳定性。`;
  }

  if (/详情页生成参考.*视觉一致性|视觉一致性/.test(subject)) {
    return `优化了${projectName}的详情页生成参考与视觉一致性，提升生成结果的统一性和可控性。`;
  }

  if (/旧版详情页.*版式.*修复计划|版式修复计划/.test(subject)) {
    return `梳理并记录了${projectName}的旧版详情页版式修复计划，为后续版式问题处理提供执行依据。`;
  }

  if (/清理.*测试/.test(subject)) {
    return `清理了${projectName}的历史测试资料，减少后续维护干扰。`;
  }

  if (/修复/.test(subject)) {
    return `修复了${projectName}的${subject.replace(/^修复/, "")}，提升相关流程的稳定性。`;
  }

  if (/优化/.test(subject)) {
    return `优化了${projectName}的${subject.replace(/^优化/, "")}，提升相关体验和结果质量。`;
  }

  if (/增加|新增/.test(subject)) {
    return `完成了${projectName}的${subject.replace(/^(增加|新增)/, "")}，补齐当天确认的关键能力。`;
  }

  return `推进了${projectName}的${subject}，让当天工作进展沉淀到项目中。`;
}

function normalizeCommitSubject(subject) {
  return String(subject || "")
    .replace(/^(feat|fix|docs|chore|refactor|test|style|perf)(\([^)]+\))?:\s*/i, "")
    .replace(/[A-Za-z]:\\[^\s，。；、]+/g, "")
    .replace(/\b[\w.-]+\.(mjs|js|ts|tsx|py|json|md|yml|yaml|css|html)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasPlanningSignal(snippets) {
  const text = snippets.map((snippet) => snippet.text).join("\n");
  return /需求|边界|MVP|demo|数据来源|输出格式|筛选规则|待跟进/.test(text);
}

function uniqueItems(items) {
  return [...new Set(items)];
}
