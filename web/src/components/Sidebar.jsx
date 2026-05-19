export default function Sidebar({ config, onChange, onSave }) {
  const repositories = Array.isArray(config.repositories) ? config.repositories : [];

  function updateField(field, value) {
    onChange({ ...config, [field]: value });
  }

  function addRepository() {
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

  function readKeywords(value) {
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
        <input
          value={config.outputDirectory || ""}
          onChange={(event) => updateField("outputDirectory", event.target.value)}
        />
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
              <input
                value={repository.path || ""}
                onChange={(event) => updateRepository(index, { path: event.target.value })}
              />
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
                value={(repository.keywords || []).join(", ")}
                onChange={(event) =>
                  updateRepository(index, { keywords: readKeywords(event.target.value) })
                }
              />
            </label>
          </article>
        ))}
      </section>

      <button className="primary" type="button" onClick={() => onSave(config)}>
        保存配置
      </button>
      <p className="hint">API Key 只保存在本机配置文件里，不要提交配置文件。</p>
    </aside>
  );
}
