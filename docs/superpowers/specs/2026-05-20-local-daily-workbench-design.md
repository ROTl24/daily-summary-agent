# Local Daily Workbench Design

## Goal

Build a Windows-first local desktop daily report workbench for developers and independent creators. The app helps users turn local Git activity, optional Codex conversations, and manual context into an editable Markdown daily report using DeepSeek.

The first version should feel like a normal desktop app, but implementation should start as a local web workbench and then be wrapped with Electron.

## Target User

The target user is a developer or independent creator who can understand repositories and API keys, but should not need to hand-edit JSON files or remember command-line steps during daily use.

## Product Scope

The first version includes:

- Windows-first desktop app experience.
- Local React/Vite workbench before Electron packaging.
- Dual-column workbench layout.
- Empty-state onboarding that guides the user to add the first repository.
- DeepSeek API key stored in a local app configuration file.
- Configurable daily report output directory.
- Multiple repositories supported, while first-run guidance starts with one repository.
- Repository path selection through both folder picker and manual path input.
- Detailed pre-generation evidence view.
- Git commits and uncommitted changes as primary evidence.
- Always-visible manual context area for meetings, communication, decisions, and non-code work.
- Optional Codex conversation reading, disabled by default.
- DeepSeek-based report writing.
- Simple editable Markdown text area.
- Saving to `YYYY-MM-DD-daily.md`.

The first version does not include:

- Account login.
- Cloud sync.
- Team sharing.
- In-app history management for past reports.
- Rich-text editing.
- macOS or Linux installer.
- Built-in Git runtime.
- Plugin marketplace or broad third-party integrations.

## Main Workflow

1. The user opens the app.
2. If no repository exists, the left panel shows an empty-state prompt to add the first repository.
3. The user configures DeepSeek API key, output directory, and repository details.
4. The app reads today's Git commits and current uncommitted changes.
5. The right panel shows detailed evidence before generation.
6. The user optionally adds manual context.
7. The user optionally enables Codex reading and reviews matched snippets before generation.
8. The user clicks generate.
9. DeepSeek writes a manager-friendly Markdown report from the evidence.
10. The user edits the Markdown text directly.
11. The user saves the report to the configured output directory.

## Workbench Layout

The app uses a dual-column layout.

The left column contains setup and repository management:

- DeepSeek API key status and edit action.
- Output directory selector.
- Repository list.
- Add repository action.
- Per-repository fields: path, project name, keywords and aliases.
- Codex reading toggle, disabled by default.

The right column contains today's work:

- Evidence panel showing Git commits, uncommitted changes, Git errors, and optional Codex matches.
- Manual context text area.
- Generate button.
- Markdown editor.
- Save button.

## Data Sources

### Git

Git is the default source of work evidence.

For each configured repository, the app reads:

- Commits from the local natural day, from `00:00` to the current time.
- Current uncommitted changes.

Committed work can be written as completed progress. Uncommitted changes from Git status can only be written as pending or follow-up work. If the user wants to report related work as complete, they must describe the completed fact separately in manual context.

### Manual Context

Manual context is always visible. It lets users add work that Git cannot capture, such as meetings, product decisions, customer communication, design review, temporary support, and planning.

Manual context is sent to DeepSeek as evidence and may appear in completed or pending sections depending on wording.

### Codex Conversations

Codex reading is optional and disabled by default.

When enabled, the app reads today's local Codex session files and conservatively keeps only snippets that explicitly match configured repository names, paths, project names, or keywords.

Matched snippets must be shown in the evidence panel before generation so users can review the content.

## Configuration

Configuration is stored locally in the app data directory, not inside a project repository by default.

The configuration contains:

- DeepSeek API key.
- Output directory.
- Repository list.
- Repository path.
- Repository display name.
- Repository keywords and aliases.
- Codex enabled flag.

The app should display a clear warning that configuration files may contain secrets and should not be committed to Git.

## AI Writing Rules

DeepSeek receives structured evidence and writes report sections.

The prompt must require:

- Write for a non-technical manager or stakeholder.
- Do not mention commit hashes, file names, diffs, function names, or internal implementation details.
- Do not invent benefits, metrics, deployment status, customer impact, or completed work.
- Merge related commits into natural progress items when possible.
- Keep uncommitted work in pending or follow-up sections.
- Use Markdown-compatible section headings and numbered items.

If DeepSeek fails, the desktop app should show an error and allow retry. It should not silently fall back to a misleading generated report.

## Error Handling

### Git Missing Or Invalid Repository

If Git is not installed, unavailable, or the selected path is not a Git repository, the app shows:

- The repository with an error state.
- A plain-language explanation.
- Suggested actions: install Git, choose another folder, or continue with manual context.

The user can still generate a report from manual context.

### DeepSeek Errors

If the API key is invalid, network access fails, rate limits occur, or the response format is invalid, the app shows a visible error with retry options.

The user can edit the API key and retry without restarting the app.

### File Save Conflicts

If `YYYY-MM-DD-daily.md` already exists in the output directory, the app asks whether to overwrite or save as another file.

## Privacy And Safety

The app is local-first.

- Repository data is read from the user's machine.
- Configuration stays on the user's machine.
- Codex conversations are not read unless the user enables the option.
- Evidence sent to DeepSeek should be visible to the user before generation.
- The app should not send data to any service except the configured DeepSeek API endpoint.

## Technical Architecture

### Phase 1: Local Web Workbench

Use React and Vite for the frontend. Use a local Node service for filesystem access, Git execution, Codex reading, DeepSeek calls, and Markdown saving.

The current CLI modules should be reused where possible:

- Git collection.
- Codex collection.
- DeepSeek writer.
- Markdown report rendering.

### Phase 2: Electron Packaging

Wrap the local workbench in Electron after the browser-based experience works end to end.

Electron should provide:

- Windows desktop app shell.
- Folder picker for repositories.
- Folder picker for output directory.
- App startup flow.
- Windows installer packaging.

### Phase 3: Experience Refinement

After the complete local flow works:

- Improve empty states.
- Improve error copy.
- Add evidence deletion before generation.
- Polish Markdown editing and saving.
- Add installer experience details.

## Implementation Order

1. Split existing CLI logic into service-callable modules.
2. Add a local service API for config, repository validation, evidence collection, DeepSeek generation, and report saving.
3. Build the React dual-column workbench.
4. Verify the browser-based flow end to end.
5. Add Electron shell and Windows packaging.
6. Polish first-run onboarding, error states, and installer behavior.

## Testing Strategy

The implementation should include tests for:

- Config validation.
- Git evidence collection.
- Git error handling.
- Codex disabled and enabled behavior.
- DeepSeek request construction with fake fetch.
- AI response parsing.
- Markdown save behavior, including overwrite protection.
- Local service endpoints.

Manual verification should cover:

- First-run empty state.
- Adding a valid repository with folder picker.
- Adding a repository by manual path.
- Handling a non-Git folder.
- Generating with Git evidence only.
- Generating with manual context.
- Generating with Codex enabled.
- Editing and saving Markdown.
