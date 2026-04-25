# Changed Files Specification

## ADDED Requirements

### Requirement: The diff base is the merge-base closest to HEAD

The main process SHALL pick the diff base by computing the merge-base
of HEAD with both the local base branch ref and `origin/<base>`,
then keeping whichever merge-base is a descendant of the other.

#### Scenario: Local base branch is ahead of origin

- **GIVEN** a worktree whose feature branch was created from the local
  base branch ref
- **AND** local `<base>` has commits that are not present on
  `origin/<base>`
- **WHEN** the renderer requests changed files for the worktree
- **THEN** the main process uses the merge-base of local `<base>` and
  HEAD as the diff base
- **AND** files modified only by commits that are on local `<base>`
  but not on the feature branch do not appear in the result

#### Scenario: Origin base branch is ahead of local

- **GIVEN** a worktree whose feature branch was created from
  `origin/<base>`
- **AND** `origin/<base>` has commits that are not present on local
  `<base>`
- **WHEN** the renderer requests changed files for the worktree
- **THEN** the main process uses the merge-base of `origin/<base>`
  and HEAD as the diff base
- **AND** files modified only by commits that are on `origin/<base>`
  but not on the feature branch do not appear in the result

#### Scenario: Local and origin point at the same commit

- **GIVEN** local `<base>` and `origin/<base>` reference the same commit
- **WHEN** the renderer requests changed files for the worktree
- **THEN** the main process uses the merge-base of HEAD with that
  commit as the diff base

### Requirement: Divergent merge-bases prefer the local ref

The main process SHALL use the local base branch ref's merge-base with
HEAD whenever neither candidate merge-base SHA is an ancestor of the
other.

#### Scenario: Local and origin merge-bases are unrelated

- **GIVEN** the merge-base of local `<base>` with HEAD is not an
  ancestor of the merge-base of `origin/<base>` with HEAD
- **AND** the merge-base of `origin/<base>` with HEAD is not an
  ancestor of the merge-base of local `<base>` with HEAD
- **WHEN** the renderer requests changed files for the worktree
- **THEN** the main process uses the merge-base of local `<base>` and
  HEAD as the diff base

### Requirement: Missing or unresolved refs degrade gracefully

The main process SHALL use whichever candidate ref exists when only one
of local `<base>` or `origin/<base>` is available, and SHALL fall back
to HEAD itself as the diff base when neither ref resolves, both
merge-base lookups fail, or HEAD itself does not yet resolve to a
commit.

#### Scenario: No remote-tracking ref

- **GIVEN** a repository whose `<base>` has no `origin/<base>` ref
  (e.g. no remote configured, or the branch was never fetched)
- **WHEN** the renderer requests changed files for the worktree
- **THEN** the main process uses the merge-base of local `<base>` and
  HEAD as the diff base

#### Scenario: No local base branch ref

- **GIVEN** a repository where `origin/<base>` exists but local
  `<base>` has been deleted
- **WHEN** the renderer requests changed files for the worktree
- **THEN** the main process uses the merge-base of `origin/<base>`
  and HEAD as the diff base

#### Scenario: Base branch has been deleted everywhere

- **GIVEN** a worktree whose configured `<base>` exists neither as a
  local ref nor as a remote-tracking ref (e.g. the project's default
  branch was renamed and the old name has been deleted)
- **WHEN** the renderer requests changed files for the worktree
- **THEN** the main process uses HEAD itself as the diff base
- **AND** the result lists only uncommitted and untracked changes in
  the worktree

#### Scenario: HEAD does not yet resolve

- **GIVEN** a worktree whose HEAD does not resolve to a commit (e.g.
  an unborn branch, or a worktree created before its first commit)
- **WHEN** the renderer requests changed files for the worktree
- **THEN** the main process uses HEAD itself as the diff base
- **AND** the result is empty or lists only working-tree changes
