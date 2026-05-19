export default function App() {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <h1>日报工作台</h1>
        <p className="muted">添加仓库后生成今天的 Markdown 日报。</p>
      </aside>
      <section className="workspace">
        <h2>今日日报</h2>
        <p className="muted">配置完成后，这里会展示证据、生成结果和编辑器。</p>
      </section>
    </main>
  );
}
