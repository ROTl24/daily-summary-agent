import { useEffect, useState } from "react";

import { collectEvidence, generateReport, getConfig, saveConfig, saveReport } from "./apiClient.js";

const emptyEvidence = {
  repositoryActivities: [],
  codexSnippets: [],
  manualContext: "",
};

export default function App() {
  const [config, setConfig] = useState(null);
  const [manualContext, setManualContext] = useState("");
  const [evidence, setEvidence] = useState(emptyEvidence);
  const [markdown, setMarkdown] = useState("");
  const [status, setStatus] = useState("正在加载配置...");
  const [error, setError] = useState("");
  const canGenerate = Boolean(evidence.date);
  const canSave = Boolean(evidence.date && markdown.trim());

  useEffect(() => {
    async function loadConfig() {
      try {
        const nextConfig = await getConfig();
        setConfig(nextConfig);
        setStatus(
          nextConfig.repositories?.length ? "配置已加载。" : "添加第一个仓库开始使用。",
        );
      } catch (loadError) {
        setError(loadError.message);
      }
    }

    loadConfig();
  }, []);

  async function handleSaveConfig(nextConfig) {
    try {
      setError("");
      const savedConfig = await saveConfig(nextConfig);
      setConfig(savedConfig);
      setStatus("配置已保存。");
    } catch (saveError) {
      setError(saveError.message);
      setStatus("配置保存失败。");
    }
  }

  async function handleCollectEvidence() {
    try {
      setError("");
      setStatus("正在读取今日证据...");
      const nextEvidence = await collectEvidence({ manualContext });
      setEvidence(nextEvidence);
      setStatus("证据已更新，可以生成日报。");
    } catch (collectError) {
      setError(collectError.message);
      setStatus("读取证据失败。");
    }
  }

  async function handleGenerate() {
    if (!canGenerate) {
      setError("请先读取证据，再生成日报。");
      setStatus("生成日报失败。");
      return;
    }

    try {
      setError("");
      setStatus("正在调用 DeepSeek...");
      const result = await generateReport(evidence);
      setMarkdown(result.markdown);
      setStatus("日报已生成，可以编辑后保存。");
    } catch (generateError) {
      setError(generateError.message);
      setStatus("生成日报失败。");
    }
  }

  async function handleSaveReport(overwrite = false) {
    if (!canSave) {
      setError("请先生成包含日期和内容的日报，再保存。");
      setStatus("保存日报失败。");
      return;
    }

    try {
      setError("");
      const result = await saveReport({ date: evidence.date, markdown, overwrite });
      setStatus(`已保存到 ${result.outputPath}`);
    } catch (saveError) {
      setError(saveError.message);
      setStatus("保存日报失败。");
    }
  }

  if (!config) {
    return <main className="loading">{error || status}</main>;
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <h1>日报工作台</h1>
        <p className="muted">{status}</p>
        <div className="debug-panel">
          <pre>{JSON.stringify(config, null, 2)}</pre>
        </div>
        <button type="button" onClick={() => handleSaveConfig(config)}>
          保存配置
        </button>
      </aside>
      <section className="workspace">
        {error ? <div className="error">{error}</div> : null}
        <label htmlFor="manual-context">手动补充</label>
        <textarea
          id="manual-context"
          value={manualContext}
          onChange={(event) => setManualContext(event.target.value)}
          placeholder="补充今天的重要上下文..."
        />
        <button type="button" onClick={handleCollectEvidence}>
          读取证据
        </button>
        <button type="button" onClick={handleGenerate} disabled={!canGenerate}>
          生成日报
        </button>
        <label htmlFor="markdown-report">Markdown 日报</label>
        <textarea
          id="markdown-report"
          value={markdown}
          onChange={(event) => setMarkdown(event.target.value)}
          placeholder="生成后的日报会显示在这里..."
        />
        <button type="button" onClick={() => handleSaveReport(false)} disabled={!canSave}>
          保存日报
        </button>
      </section>
    </main>
  );
}
