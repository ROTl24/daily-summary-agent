export default function MarkdownEditor({ markdown, onChange, onSave, canSave, canOverwrite }) {
  return (
    <section className="panel markdown-panel">
      <div className="section-header">
        <h2>Markdown 日报</h2>
        <div className="save-actions">
          <button type="button" onClick={() => onSave(false)} disabled={!canSave}>
            保存
          </button>
          {canOverwrite ? (
            <button className="primary" type="button" onClick={() => onSave(true)}>
              覆盖保存
            </button>
          ) : null}
        </div>
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
