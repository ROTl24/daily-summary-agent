import { useEffect, useState } from "react";

import { collectEvidence, generateReport, getConfig, saveConfig, saveReport } from "./apiClient.js";
import EvidencePanel from "./components/EvidencePanel.jsx";
import MarkdownEditor from "./components/MarkdownEditor.jsx";
import Sidebar from "./components/Sidebar.jsx";

const emptyEvidence = {
  date: "",
  repositoryActivities: [],
  codexSnippets: [],
  manualContext: "",
  codexEnabled: false,
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
      <Sidebar config={config} onChange={setConfig} onSave={handleSaveConfig} />
      <section className="workspace">
        <div className="status-bar">
          <span>{status}</span>
          {error ? <strong>{error}</strong> : null}
        </div>
        <EvidencePanel
          evidence={evidence}
          manualContext={manualContext}
          onManualContextChange={setManualContext}
          onRefresh={handleCollectEvidence}
          onGenerate={handleGenerate}
          canGenerate={canGenerate}
        />
        <MarkdownEditor
          markdown={markdown}
          onChange={setMarkdown}
          onSave={handleSaveReport}
          canSave={canSave}
        />
      </section>
    </main>
  );
}
