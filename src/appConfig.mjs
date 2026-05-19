import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
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
  const configDirectory = path.dirname(configPath);
  await mkdir(configDirectory, { recursive: true, mode: 0o700 });
  await applyMode(configDirectory, 0o700);
  await writeFile(configPath, `${JSON.stringify(normalized, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await applyMode(configPath, 0o600);
  return normalized;
}

export function validateAppConfig(value) {
  if (!isConfigObject(value)) {
    throw new Error("config must be an object.");
  }

  const config = {
    ...defaultConfig(),
    ...value,
  };

  return {
    deepSeekApiKey: readString(config.deepSeekApiKey, "deepSeekApiKey"),
    outputDirectory: readRequiredString(config.outputDirectory, "outputDirectory"),
    codexEnabled: readBoolean(config.codexEnabled, "codexEnabled"),
    repositories: readRepositories(config.repositories),
  };
}

async function applyMode(targetPath, mode) {
  try {
    await chmod(targetPath, mode);
  } catch (error) {
    if (process.platform === "win32" && ["EINVAL", "ENOSYS", "EPERM"].includes(error.code)) {
      return;
    }

    throw error;
  }
}

function isConfigObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function readBoolean(value, fieldName) {
  if (typeof value !== "boolean") {
    throw new Error(`${fieldName} must be a boolean.`);
  }

  return value;
}

function readRequiredString(value, fieldName) {
  const text = readString(value, fieldName);
  if (!text) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }

  return text;
}
