# File Watching Specification

## Watched Path

The backend watches the `.claude/` directory (not `steps.json` directly) for changes.

**Rationale**: `fs.watch` on a single file is unreliable with atomic writes (temp-file-then-rename pattern), especially on macOS. Watching the parent directory catches all write strategies.

## Directory Existence Handling

### `.claude/` exists at spawn time
Watch `.claude/` immediately with `fs.watch`.

### `.claude/` does not exist yet (fresh worktree)
1. Watch the worktree root directory instead
2. Filter events for `.claude` filename only
3. When `.claude/` appears, close the root watcher and swap to watching `.claude/`
4. If `steps.json` already exists at swap time, do an immediate read

## Change Detection

- Filter: only react to events where `filename === 'steps.json'` (when the platform provides a filename; some platforms pass `null`, in which case all events trigger a read)
- Debounce: 200ms after the last change event before reading the file
- This handles rapid sequential writes without redundant reads

## Initial Read

After setting up the watcher, perform an immediate read of `steps.json` if it exists. This handles the race condition where the agent writes before the watcher is established.

## Error Handling

- `ENOENT` when reading `steps.json`: silently return `null` (file not written yet)
- Other read errors: log to console, return `null`
- Watcher errors: log warning, watcher continues running
- Failed to watch directory: log warning, skip (steps won't update but app continues)

## IPC Events

### `StepsContent` (server -> client push)
Sent whenever steps.json content changes.
```ts
{ taskId: string; steps: unknown[] | null }
```

### `ReadStepsContent` (client request, one-shot)
Used on app restart to restore steps for persisted tasks.
```ts
// Request
{ worktreePath: string }
// Response
unknown[] | null
```

### `StopStepsWatcher` (client request)
Stops and cleans up the watcher for a task. Called on:
- Task close
- Task collapse
- Task removal from store

Idempotent — safe to call multiple times for the same taskId.

## Lifecycle

| Event | Action |
|-------|--------|
| Agent spawns (stepsEnabled=true) | `startStepsWatcher()` — adds git exclude, starts watching |
| Steps.json written/updated | Debounced read → IPC push to renderer |
| Task collapsed | `stopStepsWatcher()` via IPC |
| Task closed/removed | `stopStepsWatcher()` via IPC (called in `removeTaskFromStore`) |
| App shutdown | `stopAllStepsWatchers()` |
