# Steps Tracking — Technical Design

## Architecture Overview

```
┌──────────────┐    prompt     ┌──────────────┐   fs.write    ┌─────────────┐
│  Task Dialog  │ ──injection──►│  AI Agent     │ ────────────►│  steps.json │
│  (opt-in)     │              │  (PTY process) │              │  (.claude/)  │
└──────────────┘              └──────────────┘              └──────┬──────┘
                                                                    │
                                                              fs.watch (200ms debounce)
                                                                    │
┌──────────────┐    IPC push   ┌──────────────┐   read+parse  ┌────▼────────┐
│  Steps UI     │ ◄────────────│  Store        │ ◄─────────────│  Watcher    │
│  (SolidJS)    │              │  (frontend)   │              │  (backend)   │
└──────────────┘              └──────────────┘              └─────────────┘
```

## Data Flow

### 1. Prompt Injection (`src/store/tasks.ts`)

When `stepsEnabled` is true, the steps instruction text is appended to the user's initial prompt after a `\n\n---\n` separator. The original prompt is preserved in `savedInitialPrompt` so the user can see what they typed vs. what was injected.

The instruction tells the agent:
- Where to write (`.claude/steps.json`)
- The JSON format (append-only array)
- Field constraints (summary ≤60 chars, action verbs, etc.)
- The `awaiting_review` pause behavior

### 2. Backend Watcher (`electron/ipc/steps.ts`)

State per task:
```ts
interface StepsWatcher {
  fsWatcher: fs.FSWatcher | null;
  timeout: ReturnType<typeof setTimeout> | null;
  stepsDir: string;      // /path/to/worktree/.claude
  stepsFile: string;     // /path/to/worktree/.claude/steps.json
}
```

Stored in a module-level `Map<string, StepsWatcher>` keyed by taskId.

The watcher handles two scenarios:
1. **`.claude/` exists**: watch it directly
2. **`.claude/` doesn't exist**: watch worktree root, swap when `.claude/` appears

On change (debounced 200ms):
- Read `steps.json`
- Parse JSON
- Validate it's an array
- Send via `win.webContents.send(IPC.StepsContent, { taskId, steps })`

### 3. Frontend Store (`src/store/tasks.ts`)

```ts
setStepsContent(taskId: string, steps: unknown[] | null): void
```

Filters entries to keep only non-null objects (loose validation), stores as `StepEntry[]` on the task.

### 4. UI Component (`src/components/TaskStepsSection.tsx`)

Two-zone layout:
- **History zone**: collapsed step entries (click to expand). Shows: index, status badge (colored), summary, duration between steps, file count.
- **Latest step zone**: always expanded, anchored at bottom. Shows: status badge, summary, relative timestamp, detail text, file badges.
- **Waiting indicator**: pulsing dot + "Waiting for next step" when user sent input after the last step completed.

Auto-scrolls to bottom when new steps appear. Keyboard navigation (arrow keys, page up/down) when focused.

### 5. Panel Integration (`src/components/TaskPanel.tsx`)

Steps section is a conditional `PanelChild` in the `ResizablePanel`:
- Initial size: 28px (header only when no steps)
- Expands to 110px when steps arrive
- Only included when `task.stepsEnabled` is true

## Persistence

### Task-level
- `stepsEnabled` is saved on `PersistedTask` and restored on app restart
- Steps content itself is NOT persisted (read fresh from disk via `ReadStepsContent` IPC)

### App-level
- `showSteps` (boolean) saves the last-used default for the new task dialog checkbox
- Stored on `PersistedState`, restored on load (defaults to `false`)

## Git Integration

Steps files are excluded from git via `.git/info/exclude` (not `.gitignore`):
- Local to the worktree — never committed
- For linked worktrees, the exclude file is found by parsing `.git` (a file, not a directory) for the `gitdir:` pointer
- The exclude entry `.claude/steps.json` is appended idempotently (checks for existing entry first)

## Key Decisions

1. **Append-only format**: Agents never edit previous entries. This avoids merge conflicts and makes the file trivially parseable — just read the whole array.

2. **Prompt injection over config file**: The steps format is communicated via prompt text, not a config file the agent reads. This works with any agent that follows natural language instructions.

3. **Watch directory, not file**: `fs.watch` on individual files breaks with atomic writes. Watching `.claude/` is more reliable across platforms.

4. **Loose validation**: The frontend accepts any non-null object as a step entry. This forward-compatibility means adding new fields to `StepEntry` won't break older frontends.

5. **No persistent storage**: Steps are ephemeral — they live in the worktree and are re-read from disk on restart. This avoids a separate database and keeps the feature zero-config.
