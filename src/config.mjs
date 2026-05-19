import { readFile } from "node:fs/promises";
import path from "node:path";

export async function loadConfig(configPath = path.join(process.cwd(), "daily-summary.config.json")) {
  const absoluteConfigPath = path.resolve(configPath);
  const raw = await readFile(absoluteConfigPath, "utf8");
  const parsed = JSON.parse(raw);

  return normalizeConfig(parsed, path.dirname(absoluteConfigPath));
}

export function normalizeConfig(config, configDirectory = process.cwd()) {
  if (!config || !Array.isArray(config.repositories)) {
    throw new Error("Config must contain a repositories array.");
  }

  const repositories = config.repositories.map((repository, index) => {
    if (!repository || typeof repository !== "object") {
      throw new Error(`Repository config at index ${index} must be an object.`);
    }

    const repositoryPath = readRequiredString(repository.path, `repositories[${index}].path`);
    const businessName = readRequiredString(repository.businessName, `repositories[${index}].businessName`);

    if (!Array.isArray(repository.keywords) || repository.keywords.length === 0) {
      throw new Error(`repositories[${index}].keywords must be a non-empty string array.`);
    }

    const keywords = repository.keywords.map((keyword, keywordIndex) =>
      readRequiredString(keyword, `repositories[${index}].keywords[${keywordIndex}]`),
    );

    return {
      path: path.resolve(configDirectory, repositoryPath),
      businessName,
      keywords,
    };
  });

  return { repositories };
}

function readRequiredString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}
