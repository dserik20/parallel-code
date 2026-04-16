# Steps Tracking

## Problem

When an AI agent runs a complex task, the user's only window into progress is the raw terminal output scrolling by. Terminal output is noisy — full of tool calls, file contents, and verbose logs. Users can't quickly answer "what has the agent done so far?" or "what is it working on right now?" without reading through hundreds of lines of output.

## Motivation

Users managing multiple parallel agents need a compact, structured progress view for each task. They want to:

- See at a glance which phase the agent is in (investigating, implementing, testing)
- Know which files were modified and when
- Understand elapsed time per step to identify stuck agents
- Know when the agent is waiting for their review
- Get this information without parsing terminal output themselves

## Scope

- Agent writes structured progress entries to a JSON file (`.claude/steps.json`)
- Backend watches for file changes and streams updates to the frontend via IPC
- Frontend renders a live progress timeline in each task panel
- Steps instruction is injected into the agent's initial prompt (opt-in per task)
- Steps file is excluded from git (never committed)
- Works with both worktree and direct-mode tasks

## Out of Scope

- Automatic step detection from terminal output (steps are agent-authored)
- Step editing or reordering by the user
- Cross-task step aggregation or dashboards
- Step persistence beyond the task's lifetime (steps live in the worktree)
