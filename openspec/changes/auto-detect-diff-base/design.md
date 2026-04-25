# Design — Auto-Detect Diff Base

## Problem

`detectMergeBase` in `electron/ipc/git.ts` calls `resolveBaseRef`, which
returns `origin/<branch>` whenever a remote-tracking ref exists, and
otherwise returns `<branch>`. This rule was introduced to avoid leaking
the `origin/main`-vs-`main` delta into a feature branch when the local
`<main>` was stale relative to origin.

The rule fails in the inverse case: when local `<main>` is _ahead_ of
origin (the user has merged or committed onto `<main>` without pushing,
or pulled into `<main>` after creating the worktree), the merge-base
against `origin/<main>` is older than the worktree's actual branch
point. Files that exist only on local `<main>` then appear as feature
branch changes.

Either ref can be wrong depending on which side is stale. The merge-base
that is _closest to HEAD_ always gives the smallest correct diff,
regardless of which side is stale.

## Algorithm

```
candidates = []
if local_branch_exists(branch):       candidates.push(branch)
if remote_tracking_ref_exists(branch): candidates.push(origin/branch)

if len(candidates) == 0: return null   # caller falls back to HEAD

mbs = parallel: git merge-base <ref> <head>  for ref in candidates
       (each call wrapped in catch → null so a failing candidate
       does not poison the other)
drop entries that returned no SHA

if len(mbs) == 0: return null
if len(mbs) == 1: return mbs[0]

# Two candidates: local first, origin second (insertion order).
local_mb, origin_mb = mbs[0], mbs[1]

if git merge-base --is-ancestor origin_mb local_mb: return local_mb
if git merge-base --is-ancestor local_mb origin_mb: return origin_mb
return local_mb   # neither is an ancestor of the other → prefer local
```

The "closer to HEAD" property follows from the structure of merge-base:
both `local_mb` and `origin_mb` lie on the path from HEAD back through
its history. Whichever is a descendant of the other is the more recent
branch point, so it excludes the most shared history from the diff.

When `local_mb == origin_mb` (e.g. local and origin point at the same
commit, or at different commits that share the same merge-base with
HEAD) both `--is-ancestor` checks return true and the first branch
fires, returning the shared SHA. Either ref is correct in that case.

## Diverged tiebreaker

When neither merge-base SHA is an ancestor of the other, the two refs
have themselves diverged on the way back to HEAD's ancestry. This
happens when local `<main>` and `origin/<main>` have each picked up
commits the other lacks since the actual branch point. In practice it
is rare; both refs typically share a recent ancestor.

The tiebreaker is "prefer local". Rationale: the user's local state is
what they think they branched from. Origin can be ahead because of
teammates' merges that the user has not seen yet. Deferring to local
keeps the changed-files list aligned with the user's mental model;
choosing origin would surface teammate work as part of the user's
branch.

## Why no setting

A per-project setting was the first proposal. It was dropped because
auto-detection picks the correct ref in every case where one ref is
strictly newer than the other (the common case for both reported
failure modes) and the diverged-case tiebreaker is good enough that no
user has a reason to override it under normal use. A setting can be
added later if a real workflow needs it.

## Cost

Per uncached call: 1 → up to 4 git invocations (2 merge-base, up to 2
is-ancestor). All read local objects, sub-millisecond each. The
existing `mergeBaseCache` (5-minute TTL keyed by repo + branch + head)
absorbs repeated calls. The cache key is unchanged; if the user runs
`git fetch` mid-session and origin's tip moves, staleness in the picked
base is bounded by `MERGE_BASE_TTL`.

## Call sites

All call sites that resolve a diff base move to `detectMergeBase` (which
delegates to the new `pickMergeBase`):

- `getChangedFiles` (git.ts:764) — already calls `detectMergeBase`. No
  call-site change; it inherits the new picking logic.
- `getAllFileDiffs` (git.ts:875) — already calls `detectMergeBase`. No
  call-site change.
- `getFileDiff` (git.ts:962) — already calls `detectMergeBase`. No
  call-site change.
- `computeBranchDiffStats` (git.ts:433) — currently calls
  `resolveBaseRef`. Switches to `detectMergeBase`, passing `branchName`
  as the head. The returned SHA is fed into `<sha>...<branchName>`.
- `getChangedFilesFromBranch` (git.ts:1342) — same migration, same
  pattern.
- `getAllFileDiffsFromBranch` (git.ts:938) — same migration, same
  pattern.
- `getFileDiffFromBranch` (git.ts:1381) — same migration. The function
  also runs an inline `git merge-base baseRef branchName` (git.ts:1404)
  to find the merge-base used for `git show` of old content; that call
  becomes redundant once `detectMergeBase` already returns the SHA, and
  is removed.

After the migration `resolveBaseRef` has no callers and is deleted.

### `<sha>...<branch>` substitution

Switching `<refname>...<branchName>` to `<sha>...<branchName>` is
behaviour-preserving because the SHA returned by `pickMergeBase` is by
definition `git merge-base <chosenRef> <head>`, where `<head>` is
either HEAD or `branchName` (the head argument passed by the caller).
For all four "from-branch" call sites the head argument is
`branchName`, so the chosen SHA is reachable from `branchName`, and
`git diff <sha>...<branchName>` is equivalent to
`git diff $(git merge-base <sha> <branchName>)..<branchName>`, which
collapses to `git diff <sha>..<branchName>` because `<sha>` is itself
the merge-base.

For the worktree-side callers (`getChangedFiles`, `getAllFileDiffs`,
`getFileDiff`) the head argument is the pinned HEAD SHA, which already
goes through `detectMergeBase` today; they do not change.
