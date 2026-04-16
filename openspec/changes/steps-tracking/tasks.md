# Steps Tracking — Implementation Tasks

## Data Format & Types

- [x] Define `StepEntry` interface in `src/ipc/types.ts` (summary, detail, status, files_touched, timestamp)
- [x] Define status enum values: starting, investigating, implementing, testing, awaiting_review, done

## IPC Channels

- [x] Add `StepsContent`, `ReadStepsContent`, `StopStepsWatcher` to IPC enum in `electron/ipc/channels.ts`
- [x] Add channel strings to preload allowlist in `electron/preload.cjs`

## Backend Watcher

- [x] Create `electron/ipc/steps.ts` with watcher implementation
- [x] Implement `startStepsWatcher(win, taskId, worktreePath)`
  - [x] Handle `.claude/` existing at startup
  - [x] Handle `.claude/` not existing (watch worktree root, swap when it appears)
  - [x] Debounce changes at 200ms
  - [x] Filter events to `steps.json` filename only
  - [x] Perform initial read after watcher setup
- [x] Implement `stopStepsWatcher(taskId)` — cleanup FSWatcher and timers
- [x] Implement `readStepsForWorktree(worktreePath)` — one-shot read for restore
- [x] Implement `stopAllStepsWatchers()` — shutdown cleanup
- [x] Implement `ensureStepsIgnored(worktreePath)` — add to `.git/info/exclude`
  - [x] Handle linked worktrees (parse `.git` file for `gitdir:`)

## IPC Handler Registration

- [x] Register `StopStepsWatcher` handler in `electron/ipc/register.ts`
- [x] Register `ReadStepsContent` handler in `electron/ipc/register.ts`
- [x] Start steps watcher in `SpawnAgent` handler when `stepsEnabled` is true

## Store Integration

- [x] Add `stepsEnabled?: boolean` and `stepsContent?: StepEntry[]` to `Task` interface
- [x] Add `stepsEnabled?: boolean` to `PersistedTask`
- [x] Add `showSteps: boolean` to `AppStore` and `PersistedState`
- [x] Add `stepsEnabled` to `CreateTaskOptions`
- [x] Inject steps prompt instruction in `createTask()` when enabled
- [x] Implement `setStepsContent()` setter with loose validation
- [x] Implement `setTaskStepsEnabled()` toggle
- [x] Add `StopStepsWatcher` calls to `removeTaskFromStore()` and `collapseTask()`
- [x] Persist and restore `stepsEnabled` and `showSteps` in `persistence.ts`

## Frontend Plumbing

- [x] Add IPC listener for `StepsContent` events in `App.tsx`
- [x] Add restore loop for steps content on startup in `App.tsx`
- [x] Pass `stepsEnabled` prop through `TaskAITerminal` -> `TerminalView` -> `SpawnAgent`

## UI Component

- [x] Create `TaskStepsSection.tsx` component
  - [x] Empty state with "Steps: waiting..." placeholder
  - [x] History zone: collapsible step entries with index, status badge, summary, duration, file count
  - [x] Latest step zone: always expanded with full detail
  - [x] Waiting indicator (pulsing dot) when user sent input after last step
  - [x] Status color coding (6 colors for 6 statuses)
  - [x] File badges with click-to-navigate
  - [x] Auto-scroll to bottom on new steps
  - [x] Keyboard navigation (arrows, page up/down)
  - [x] Focus registration for panel navigation

## Task Panel Integration

- [x] Add steps section as conditional `PanelChild` in `TaskPanel.tsx`
- [x] Initial size 28px, expand to 110px when steps arrive

## New Task Dialog

- [x] Add "Steps tracking" checkbox in `NewTaskDialog.tsx`
- [x] Default to `store.showSteps` (remembers last-used preference)
- [x] Pass `stepsEnabled` to `createTask()`
