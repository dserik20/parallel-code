# Tasks — Auto-Detect Diff Base

- [ ] Add `pickMergeBase(repoRoot, branch, head)` helper in
      `electron/ipc/git.ts` that runs `git merge-base` for both
      `<branch>` and `origin/<branch>` (where each exists) in parallel,
      each invocation wrapped in a catch so one failing candidate does
      not poison the other. Use `git merge-base --is-ancestor` to pick
      the merge-base closer to HEAD; on divergence, return the local
      merge-base. Return `null` when neither ref exists or both
      invocations fail.
- [ ] Rewrite `detectMergeBase` to delegate to `pickMergeBase`,
      retaining the existing `mergeBaseCache` wrapper and the fallback
      to `headRef` when the picker returns `null`. Update the docblock
      to describe the new picking rule and the diverged tiebreaker.
- [ ] Migrate `computeBranchDiffStats` from `resolveBaseRef` to
      `detectMergeBase`, passing `branchName` as the head argument and
      using the returned SHA in the `<base>...<branch>` diff range.
- [ ] Migrate `getChangedFilesFromBranch` from `resolveBaseRef` to
      `detectMergeBase`, passing `branchName` as the head argument.
- [ ] Migrate `getAllFileDiffsFromBranch` from `resolveBaseRef` to
      `detectMergeBase`, passing `branchName` as the head argument.
- [ ] Migrate `getFileDiffFromBranch` from `resolveBaseRef` to
      `detectMergeBase`, passing `branchName` as the head argument.
      Remove the redundant inline `git merge-base baseRef branchName`
      lookup at git.ts:1404 and use the SHA returned by
      `detectMergeBase` directly for the `git show` call that retrieves
      old content.
- [ ] Delete `resolveBaseRef` once it has no remaining callers.
- [ ] Add unit tests in `electron/ipc/git.test.ts` covering
      `pickMergeBase`: local ahead of origin (picks local),
      origin ahead of local (picks origin), local equals origin (either,
      assert equal SHA), diverged (picks local), only local exists,
      only origin exists, neither exists, base branch deleted, unborn
      HEAD.
- [ ] Add an end-to-end `getChangedFiles` test where local `<main>` has
      a commit not on `origin/<main>`, the worktree branches from local
      `<main>`, and the assertion is that the local-only file does not
      appear in the result.
- [ ] Audit `electron/ipc/git.test.ts` for assertions that depend on
      the old "always prefer origin" rule and update or remove them.
- [ ] Run `openspec validate --all --strict`, `npm run typecheck`, and
      the test suite.
