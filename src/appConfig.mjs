import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const appDirectoryName = "DailySummaryAgent";

export function getConfigPath({
  appData = process.env.APPDATA,
  home = os.homedir(),
  override = process.env.DAILY_SUMMARY_CONFIG,
} = {}) {
  if (override) {
    return path.resolve(override);
  }

  const baseDirectory = appData || path.join(home, ".daily-summary-agent");
  return path.join(baseDirectory, appDirectoryName, "config.json");
}

export function defaultConfig({ home = os.homedir() } = {}) {
  return {
    deepSeekApiKey: "",
    outputDirectory: path.join(home, "Documents", "Daily Reports"),
    codexEnabled: false,
    repositories: [],
  };
}

export async function loadAppConfig({ configPath = getConfigPath() } = {}) {
  try {
    const raw = await readFile(configPath, "utf8");
    return validateAppConfig(JSON.parse(raw));
  } catch (error) {
    if (error.code === "ENOENT") {
      return defaultConfig();
    }

    throw error;
  }
}

export async function saveAppConfig(config, { configPath = getConfigPath() } = {}) {
  const normalized = validateAppConfig(config);
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}

export function validateAppConfig(value) {
  const config = {
    ...defaultConfig(),
    ...(value || {}),
  };

  return {
    deepSeekApiKey: readString(config.deepSeekApiKey, "deepSeekApiKey"),
    outputDirectory: readRequiredString(config.outputDirectory, "outputDirectory"),
    codexEnabled: Boolean(config.codexEnabled),
    repositories: readRepositories(config.repositories),
  };
}

function readRepositories(repositories) {
  if (!Array.isArray(repositories)) {
    throw new Error("repositories must be an array.");
  }

  return repositories.map((repository, index) => ({
    path: readRequiredString(repository?.path, `repositories[${index}].path`),
    businessName: readRequiredString(repository?.businessName, `repositories[${index}].businessName`),
    keywords: readKeywords(repository?.keywords, index),
  }));
}

function readKeywords(keywords, repositoryIndex) {
  if (!Array.isArray(keywords) || keywords.length === 0) {
    throw new Error(`repositories[${repositoryIndex}].keywords must be a non-empty array.`);
  }

  return keywords.map((keyword, index) =>
    readRequiredString(keyword, `repositories[${repositoryIndex}].keywords[${index}]`),
  );
}

function readString(value, fieldName) {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string.`);
  }

  return value.trim();
}

function readRequiredString(value, fieldName) {
  const text = readString(value, fieldName);
  if (!text) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }

  return text;
}
