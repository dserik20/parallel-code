# Step Entry Format Specification

## File Location

`.claude/steps.json` in the task's worktree root.

## File Format

JSON array of step entry objects. The agent appends new entries to the end of the array. Previous entries are never modified.

```json
[
  {
    "summary": "Add JWT validation middleware",
    "status": "implementing",
    "detail": "Wraps every protected route handler.",
    "files_touched": ["src/middleware/auth.ts"],
    "timestamp": "2024-01-15T10:30:00Z"
  }
]
```

## Fields

### `summary` (required, string)
- Maximum 60 characters
- Starts with an action verb (e.g. "Add", "Fix", "Refactor")
- No filler words ("Successfully", "Now", "Going to")
- Describes what the agent is doing or has done

### `status` (required, string enum)
One of:
| Status | Meaning | Color |
|--------|---------|-------|
| `starting` | Beginning a new step | Orange |
| `investigating` | Reading code, understanding the problem | Blue |
| `implementing` | Writing or modifying code | Purple |
| `testing` | Running tests or verifying changes | Amber |
| `awaiting_review` | Agent paused, waiting for user input | Red |
| `done` | Step completed successfully | Green |

### `detail` (optional, string)
- One sentence maximum
- Only included when it adds context the summary cannot carry
- Omit the field entirely (don't set to empty string) when not needed

### `files_touched` (optional, string array)
- Only files the agent actually wrote or modified in this step
- Not files the agent merely read
- Relative paths from the worktree root

### `timestamp` (required, string)
- ISO 8601 format
- Should include timezone (UTC preferred with `Z` suffix)
- Timestamps without timezone info are treated as UTC by the UI (appends `Z`)

## Step Lifecycle

For each major unit of work, the agent writes two entries:
1. A "starting" entry before beginning the work
2. A completion entry ("done", "implementing", etc.) after finishing

The `awaiting_review` status is special: when the agent writes this status, it should pause and wait for user input before continuing.

## Validation

The frontend filters step entries, keeping only objects that are non-null and non-array. No strict schema validation is applied — unknown fields are silently ignored. This allows forward compatibility with future extensions.

## Git Exclusion

The steps file is added to `.git/info/exclude` (local, per-worktree, never committed) so it doesn't appear in diffs or status. For linked worktrees, the exclude file is located by following the `.git` file's `gitdir:` pointer.
