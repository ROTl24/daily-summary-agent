import { useEffect, useState } from "react";

async function chooseDirectory() {
  if (typeof window === "undefined" || !window.dailySummary?.chooseDirectory) {
    return "";
  }

  return window.dailySummary.chooseDirectory();
}

export default function Sidebar({
  config,
  onChange,
  onSave,
  isDirty,
  onKeywordDraftDirtyChange,
}) {
  const repositories = Array.isArray(config.repositories) ? config.repositories : [];
  const [keywordDrafts, setKeywordDrafts] = useState(() =>
    repositories.map((repository) => (repository.keywords || []).join(", ")),
  );
  const validationMessage = getValidationMessage(repositories);
  const canSave = !validationMessage;

  useEffect(() => {
    onKeywordDraftDirtyChange(
      repositories.some(
        (repository, index) =>
          (keywordDrafts[index] ?? (repository.keywords || []).join(", ")) !==
          (repository.keywords || []).join(", "),
      ),
    );
  }, [keywordDrafts, onKeywordDraftDirtyChange, repositories]);

  function updateField(field, value) {
    onChange({ ...config, [field]: value });
  }

  function addRepository() {
    setKeywordDrafts([...keywordDrafts, ""]);
    onChange({
      ...config,
      repositories: [...repositories, { path: "", businessName: "", keywords: [] }],
    });
  }

  function updateRepository(index, patch) {
    onChange({
      ...config,
      repositories: repositories.map((repository, repositoryIndex) =>
        repositoryIndex === index ? { ...repository, ...patch } : repository,
      ),
    });
  }

  function updateKeywordDraft(index, value) {
    setKeywordDrafts(
      keywordDrafts.map((keywordDraft, keywordIndex) =>
        keywordIndex === index ? value : keywordDraft,
      ),
    );
    updateRepository(index, { keywords: readKeywords(value) });
  }

  function normalizeKeywordDraft(index) {
    const normalized = readKeywords(keywordDrafts[index] || "").join(", ");
    setKeywordDrafts(
      keywordDrafts.map((keywordDraft, keywordIndex) =>
        keywordIndex === index ? normalized : keywordDraft,
      ),
    );
  }

  function normalizeConfigForSave() {
    return {
      ...config,
      repositories: repositories.map((repository, index) => ({
        ...repository,
        keywords: readKeywords(keywordDrafts[index] ?? (repository.keywords || []).join(", ")),
      })),
    };
  }

  function handleSave() {
    const nextConfig = normalizeConfigForSave();
    setKeywordDrafts(nextConfig.repositories.map((repository) => repository.keywords.join(", ")));
    onSave(nextConfig);
  }

  function readKeywords(value = "") {
    return value
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean);
  }

  return (
    <aside className="sidebar">
      <h1>日报工作台</h1>

      <label>
        DeepSeek API Key
        <input
          type="password"
          value={config.deepSeekApiKey || ""}
          onChange={(event) => updateField("deepSeekApiKey", event.target.value)}
        />
      </label>

      <label>
        日报输出目录
        <div className="path-picker-row">
          <input
            value={config.outputDirectory || ""}
            onChange={(event) => updateField("outputDirectory", event.target.value)}
          />
          <button
            type="button"
            onClick={async () => {
              const directory = await chooseDirectory();
              if (directory) {
                updateField("outputDirectory", directory);
              }
            }}
          >
            选择
          </button>
        </div>
      </label>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={Boolean(config.codexEnabled)}
          onChange={(event) => updateField("codexEnabled", event.target.checked)}
        />
        读取 Codex 今日对话
      </label>

      <section className="repository-list">
        <div className="section-header">
          <h2>仓库</h2>
          <button type="button" onClick={addRepository}>
            添加仓库
          </button>
        </div>

        {repositories.length === 0 ? <p className="empty">添加第一个仓库开始生成日报。</p> : null}

        {repositories.map((repository, index) => (
          <article className="repository-card" key={index}>
            <label>
              仓库路径
              <div className="path-picker-row">
                <input
                  value={repository.path || ""}
                  onChange={(event) => updateRepository(index, { path: event.target.value })}
                />
                <button
                  type="button"
                  onClick={async () => {
                    const directory = await chooseDirectory();
                    if (directory) {
                      updateRepository(index, { path: directory });
                    }
                  }}
                >
                  选择文件夹
                </button>
              </div>
            </label>
            <label>
              业务名称
              <input
                value={repository.businessName || ""}
                onChange={(event) =>
                  updateRepository(index, { businessName: event.target.value })
                }
              />
            </label>
            <label>
              关键词
              <input
                value={keywordDrafts[index] ?? (repository.keywords || []).join(", ")}
                onChange={(event) => updateKeywordDraft(index, event.target.value)}
                onBlur={() => normalizeKeywordDraft(index)}
              />
            </label>
          </article>
        ))}
      </section>

      {validationMessage ? <p className="validation-message">{validationMessage}</p> : null}
      {isDirty ? <p className="dirty-warning">配置尚未保存，保存后才能读取证据。</p> : null}

      <button className="primary" type="button" onClick={handleSave} disabled={!canSave}>
        保存配置
      </button>
      <p className="hint">API Key 只保存在本机配置文件里，不要提交配置文件。</p>
    </aside>
  );
}

function getValidationMessage(repositories) {
  const invalidIndex = repositories.findIndex((repository) => {
    const keywords = Array.isArray(repository.keywords) ? repository.keywords : [];
    return !repository.path?.trim() || !repository.businessName?.trim() || keywords.length === 0;
  });

  if (invalidIndex === -1) {
    return "";
  }

  return `第 ${invalidIndex + 1} 个仓库需要填写路径、业务名称和至少一个关键词。`;
}
