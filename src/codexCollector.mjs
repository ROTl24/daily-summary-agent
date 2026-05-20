import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export async function collectCodexSessions({ codexHome = defaultCodexHome(), date, repositories }) {
  const sessionDirectory = sessionDirectoryForDate(codexHome, date);
  const threadNames = await readThreadNames(codexHome);
  const sessionFiles = await listSessionFiles(sessionDirectory);
  const snippets = [];

  for (const sessionFile of sessionFiles) {
    snippets.push(...(await readSessionSnippets(sessionFile, repositories, threadNames)));
  }

  return snippets;
}

function defaultCodexHome() {
  return process.env.CODEX_HOME || path.join(process.env.USERPROFILE || process.env.HOME || "", ".codex");
}

function sessionDirectoryForDate(codexHome, date) {
  const [year, month, day] = date.split("-");
  return path.join(codexHome, "sessions", year, month, day);
}

async function listSessionFiles(sessionDirectory) {
  try {
    const entries = await readdir(sessionDirectory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
      .map((entry) => path.join(sessionDirectory, entry.name));
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readThreadNames(codexHome) {
  const indexPath = path.join(codexHome, "session_index.jsonl");
  const names = new Map();

  try {
    const raw = await readFile(indexPath, "utf8");
    for (const line of raw.split(/\r?\n/).filter(Boolean)) {
      const record = safeParseJson(line);
      if (record?.id && typeof record.thread_name === "string") {
        names.set(record.id, record.thread_name);
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  return names;
}

async function readSessionSnippets(sessionFile, repositories, threadNames) {
  const raw = await readFile(sessionFile, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  let sessionId = path.basename(sessionFile, ".jsonl");
  let sessionCwd = "";
  const snippets = [];

  for (const line of lines) {
    const record = safeParseJson(line);
    if (!record?.payload) {
      continue;
    }

    if (record.type === "session_meta") {
      sessionId = record.payload.id || sessionId;
      sessionCwd = record.payload.cwd || sessionCwd;
      continue;
    }

    if (record.type !== "response_item" || record.payload.type !== "message") {
      continue;
    }

    if (!["user", "assistant"].includes(record.payload.role)) {
      continue;
    }

    for (const text of extractCleanTextParts(record.payload.content)) {
      const cleanText = normalizeSnippetText(text);
      if (!isWorkCandidate(cleanText, record.payload.role)) {
        continue;
      }

      const matchedRepositories = matchRepositories({ text: cleanText, cwd: sessionCwd, repositories });
      if (matchedRepositories.length === 0) {
        continue;
      }

      snippets.push({
        sessionId,
        threadName: threadNames.get(sessionId) || "",
        cwd: sessionCwd,
        role: record.payload.role,
        timestamp: record.timestamp || "",
        text: truncateSnippet(cleanText),
        matchedRepositories: matchedRepositories.map((repository) => repository.businessName),
      });
    }
  }

  return snippets;
}

function extractCleanTextParts(content) {
  if (!Array.isArray(content)) {
    return [];
  }

  return content
    .map((part) => (typeof part.text === "string" ? part.text.trim() : ""))
    .filter(Boolean)
    .filter((text) => !isInjectedContext(text));
}

function isInjectedContext(text) {
  return [
    "# AGENTS.md instructions",
    "# Diff comments:",
    "# In app browser:",
    "<environment_context>",
    "<plugins_instructions>",
    "<skills_instructions>",
    "<INSTRUCTIONS>",
    "Untrusted page evidence",
    "Target selector:",
  ].some((marker) => text.includes(marker));
}

function normalizeSnippetText(text) {
  return text
    .replace(/```[\s\S]*?```/g, "代码或日志内容已省略。")
    .replace(/\r?\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isWorkCandidate(text, role) {
  if (!text || text.length < 4) {
    return false;
  }

  if (role === "user") {
    return userWorkSignalPattern.test(text);
  }

  return assistantWorkSignalPattern.test(text);
}

const userWorkSignalPattern =
  /修复|实现|新增|添加|优化|完善|调整|更新|生成|搭建|打包|部署|测试|构建|验证|排查|定位|设计|规划|梳理|确认|明确|分析|解决|日报|STAR|DeepSeek|Codex|关键词|按钮|网页版|Electron|prompt|提示词|待跟进|提交|PR|lint|build|test|pnpm/i;

const assistantWorkSignalPattern =
  /已(?:经)?(?:修复|完成|实现|调整|更新|生成|通过|验证|新增|补充|加固|优化|打包|构建)|验证结果|测试通过|构建通过|lint|pnpm (?:lint|test|build)|pass(?:ed)?|明确|通过/i;

function truncateSnippet(text, limit = 600) {
  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, limit).trim()}...`;
}

function matchRepositories({ text, cwd, repositories }) {
  return repositories.filter((repository) => {
    if (cwd && isInsideOrSame(repository.path, cwd)) {
      return true;
    }

    const keywords = repositoryKeywords(repository);
    return keywords.some((keyword) => containsIgnoreCase(text, keyword));
  });
}

function repositoryKeywords(repository) {
  return uniqueStrings([
    repository.businessName,
    path.basename(repository.path),
    repository.path,
    ...repository.keywords,
  ]).filter((keyword) => keyword.length > 0);
}

function isInsideOrSame(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function containsIgnoreCase(value, keyword) {
  return value.toLocaleLowerCase().includes(keyword.toLocaleLowerCase());
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value || "").trim()))];
}

function safeParseJson(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}
