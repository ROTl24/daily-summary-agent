# Daily Summary Agent Implementation Plan

> For AI workers: implement this plan with TDD. Keep the demo local, conservative, and small.

**Goal:** Build a local CLI that generates `reports/YYYY-MM-DD-daily.md` from configured repositories, same-day Git activity, uncommitted work, and relevant Codex session logs.

**Architecture:** Use a small Node.js ESM CLI. Keep collection, filtering, summarizing, and rendering in separate modules so each behavior can be tested without touching real repositories or real Codex logs.

**Tech stack:** Node.js 24, built-in `node:test`, built-in filesystem/process APIs, no external runtime services.

---

## Files

- Create `package.json`: scripts for `pnpm test`, `pnpm lint --fix`, and `pnpm build`.
- Create `daily-summary.config.json`: demo config for this repository.
- Create `daily-summary.config.example.json`: editable config template.
- Create `src/config.mjs`: load and validate repository config.
- Create `src/dateRange.mjs`: local natural-day range and date formatting.
- Create `src/gitCollector.mjs`: collect same-day commits and current uncommitted work.
- Create `src/codexCollector.mjs`: read Codex JSONL sessions for the selected day and conservatively filter messages.
- Create `src/summarizer.mjs`: turn technical evidence into manager-friendly completed and pending items.
- Create `src/reportWriter.mjs`: render and write Markdown reports.
- Create `src/cli.mjs`: wire the pipeline together.
- Create `scripts/check-syntax.mjs`: lightweight lint/build syntax check.
- Create tests under `test/*.test.mjs`.

## Tasks

### Task 1: Lock Expected Behavior With Tests

- [ ] Add tests for Codex session parsing:
  - reads `%CODEX_HOME%/sessions/YYYY/MM/DD/*.jsonl`
  - skips injected AGENTS/environment context
  - includes messages when session cwd is inside a configured repo
  - includes messages from other sessions only when text explicitly matches a configured keyword
  - excludes unrelated same-day sessions
- [ ] Add tests for Git collection:
  - parses same-day commit log output
  - marks current uncommitted work as pending evidence
  - reports command errors without crashing the whole run
- [ ] Add tests for report rendering:
  - starts with `YYYY-MM-DD 日报`
  - uses generated Chinese section headings
  - puts uncommitted work in pending items
  - does not include file names, diffs, or source notes

### Task 2: Implement Minimal Modules

- [ ] Implement `config.mjs` with strict validation for `path`, `businessName`, and `keywords`.
- [ ] Implement `dateRange.mjs` using local natural day boundaries.
- [ ] Implement `gitCollector.mjs` with injectable command runner for tests.
- [ ] Implement `codexCollector.mjs` with JSONL parsing and conservative filtering.
- [ ] Implement `summarizer.mjs` with rule-based, manager-friendly wording.
- [ ] Implement `reportWriter.mjs` and `cli.mjs`.

### Task 3: Verify the Demo

- [ ] Run `pnpm test` and confirm all tests pass.
- [ ] Run `pnpm lint --fix`.
- [ ] Run `pnpm build`.
- [ ] Run the CLI once with the demo config and confirm it writes `reports/YYYY-MM-DD-daily.md`.
