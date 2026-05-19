export default function EvidencePanel({
  evidence = {},
  manualContext,
  onManualContextChange,
  onRefresh,
  onGenerate,
  canGenerate,
}) {
  const activities = Array.isArray(evidence.repositoryActivities)
    ? evidence.repositoryActivities
    : [];
  const codexSnippets = Array.isArray(evidence.codexSnippets) ? evidence.codexSnippets : [];

  return (
    <section className="panel evidence-panel">
      <div className="section-header">
        <h2>今日证据</h2>
        <button type="button" onClick={onRefresh}>
          读取证据
        </button>
      </div>

      <textarea
        className="manual-context"
        value={manualContext}
        onChange={(event) => onManualContextChange(event.target.value)}
        aria-label="补充会议、沟通、产品决策、临时支持、非代码工作"
        placeholder="补充会议、沟通、产品决策、临时支持、非代码工作..."
      />

      {activities.map((activity, index) => {
        const repository = activity.repository || {};
        const commits = Array.isArray(activity.commits) ? activity.commits : [];
        const errors = Array.isArray(activity.errors) ? activity.errors : [];
        const pendingWork = activity.pendingWork || {};

        return (
          <article className="evidence-card" key={repository.path || index}>
            <h3>{repository.businessName || repository.path || "未命名仓库"}</h3>

            {errors.length > 0 ? <div className="warning">{errors.join("\n")}</div> : null}

            <p className="muted">今日提交：{commits.length} 条</p>
            {commits.length > 0 ? (
              <ul>
                {commits.map((commit, commitIndex) => (
                  <li key={commit.hash || `${commit.subject}-${commitIndex}`}>{commit.subject}</li>
                ))}
              </ul>
            ) : (
              <p className="empty">今天没有匹配到提交。</p>
            )}

            <p className="muted">
              未提交变更：
              {pendingWork.hasChanges
                ? `${pendingWork.changedItemCount || 0} 项，将作为待跟进`
                : "无"}
            </p>
          </article>
        );
      })}

      {evidence.codexEnabled ? (
        <article className="evidence-card">
          <h3>Codex 命中片段</h3>
          {codexSnippets.length > 0 ? (
            <ul>
              {codexSnippets.map((snippet, index) => (
                <li key={index}>{snippet.text || snippet.summary || String(snippet)}</li>
              ))}
            </ul>
          ) : (
            <p className="empty">今天没有匹配到 Codex 片段。</p>
          )}
        </article>
      ) : (
        <p className="muted">Codex 读取已关闭。</p>
      )}

      <button className="primary" type="button" onClick={onGenerate} disabled={!canGenerate}>
        生成日报
      </button>
    </section>
  );
}
