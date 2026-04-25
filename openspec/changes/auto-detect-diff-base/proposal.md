# Auto-Detect Diff Base

## Why

The "changed files" panel often shows files that are not actually new on
the current branch. The diff for a feature branch is computed against
`origin/<main>` whenever the remote-tracking ref exists, even when the
user's _local_ `<main>` is ahead of origin. In that situation the
merge-base resolves to an older commit than the worktree's actual branch
point, so commits already on local `<main>` (e.g. PRs the user merged
locally without pushing, or work pulled into `<main>` after the worktree
was created) leak into the feature branch's changed-files list.

Inverting the preference (always prefer local) trades one failure mode
for another: a stale local `<main>` would then leak the
`origin/<main>`-vs-local delta back into the diff. There is no single
ref that is always correct.

The fix is to pick whichever of the two refs has a merge-base _closer_
to HEAD — that is the ref whose state is most up-to-date relative to the
branch point — and decide automatically per call.

## What changes

- Every code path that resolves a diff base — `getChangedFiles`,
  `getAllFileDiffs`, `getFileDiff`, `computeBranchDiffStats`,
  `getChangedFilesFromBranch`, `getAllFileDiffsFromBranch`, and
  `getFileDiffFromBranch` — picks its base by comparing the merge-base
  of the local base branch ref with HEAD against the merge-base of the
  remote-tracking ref (`origin/<branch>`) with HEAD, then keeping
  whichever merge-base is a descendant of the other.
- When the two merge-bases have diverged (neither is an ancestor of
  the other), the local ref's merge-base is used.
- When only one of the refs exists, that ref is used unchanged.
- The previous "always prefer `origin/<branch>`" rule and the
  `resolveBaseRef` helper that implemented it are removed.

No new setting, no schema migration, no UI surface.

## Impact

- Affected capability: `changed-files` (new capability spec).
- Affected code: `electron/ipc/git.ts` — new `pickMergeBase` helper,
  rewritten `detectMergeBase`, migration of `computeBranchDiffStats`,
  `getChangedFilesFromBranch`, `getAllFileDiffsFromBranch`, and
  `getFileDiffFromBranch` from `resolveBaseRef` to `detectMergeBase`,
  removal of the redundant inline `git merge-base` call inside
  `getFileDiffFromBranch`, and deletion of `resolveBaseRef`.
- Affected tests: `electron/ipc/git.test.ts` — new coverage for the
  picker plus an audit of existing tests that assert the old
  prefer-origin behavior.
- Behavior change: users with unpushed commits on local `<main>` stop
  seeing those commits' files in changed-files; users with stale local
  `<main>` continue to see correct results because origin's merge-base
  is preferred when it is newer.
- Performance: one additional `git merge-base` call and up to two
  `git merge-base --is-ancestor` calls per uncached lookup. All read
  local objects; existing `mergeBaseCache` continues to absorb repeated
  calls.
