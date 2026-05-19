export default function MarkdownEditor({ markdown, onChange, onSave, canSave }) {
  return (
    <section className="panel markdown-panel">
      <div className="section-header">
        <h2>Markdown 日报</h2>
        <button type="button" onClick={() => onSave(false)} disabled={!canSave}>
          保存
        </button>
      </div>

      <textarea
        className="markdown-editor"
        value={markdown}
        onChange={(event) => onChange(event.target.value)}
        aria-label="生成后的日报会显示在这里，可以直接编辑。"
        placeholder="生成后的日报会显示在这里，可以直接编辑。"
      />
    </section>
  );
}
