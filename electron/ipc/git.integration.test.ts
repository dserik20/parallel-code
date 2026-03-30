/**
 * Integration tests for git diff functions.
 * These create real git repos in temp directories and test the actual
 * git commands our code runs — no mocking.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  getChangedFiles,
  getAllFileDiffs,
  getChangedFilesFromBranch,
  getAllFileDiffsFromBranch,
} from './git.js';

const exec = promisify(execFile);

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await exec('git', args, { cwd });
  return stdout.trim();
}

async function writeFile(dir: string, filePath: string, content: string): Promise<void> {
  const full = path.join(dir, filePath);
  await fs.promises.mkdir(path.dirname(full), { recursive: true });
  await fs.promises.writeFile(full, content, 'utf8');
}

/**
 * Create a repo topology that reproduces the phantom-file bug:
 *
 *   A ── B (main)         main has cherry-picked changes from feature
 *    \
 *     C ── D (feature)    feature originally changed the files
 *
 * Files changed on feature that are already on main should NOT appear.
 */
async function setupPhantomFileRepo(): Promise<{ repoDir: string; cleanup: () => Promise<void> }> {
  const repoDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'git-integration-'));

  // Init repo with main branch
  await git(repoDir, 'init', '-b', 'main');
  await git(repoDir, 'config', 'user.email', 'test@test.com');
  await git(repoDir, 'config', 'user.name', 'Test');

  // Commit A: initial state with two files
  await writeFile(repoDir, 'note.component.html', '<div>original</div>\n');
  await writeFile(repoDir, 'note.component.scss', '.note { color: red; }\n');
  await writeFile(repoDir, 'other-file.ts', 'export const x = 1;\n');
  await git(repoDir, 'add', '-A');
  await git(repoDir, 'commit', '-m', 'initial commit');

  // Create feature branch
  await git(repoDir, 'checkout', '-b', 'feature');

  // Commit C: feature changes note files + other-file
  await writeFile(repoDir, 'note.component.html', '<div>updated by feature</div>\n');
  await writeFile(repoDir, 'note.component.scss', '.note { color: blue; }\n');
  await writeFile(repoDir, 'other-file.ts', 'export const x = 2;\n');
  await git(repoDir, 'add', '-A');
  await git(repoDir, 'commit', '-m', 'feature: update note components and other-file');

  // Commit D: another feature commit
  await writeFile(repoDir, 'feature-only.ts', 'export const y = 1;\n');
  await git(repoDir, 'add', '-A');
  await git(repoDir, 'commit', '-m', 'feature: add feature-only file');

  // Go back to main and cherry-pick the note component changes
  // (simulating those changes being merged via a separate PR)
  await git(repoDir, 'checkout', 'main');
  await writeFile(repoDir, 'note.component.html', '<div>updated by feature</div>\n');
  await writeFile(repoDir, 'note.component.scss', '.note { color: blue; }\n');
  await git(repoDir, 'add', '-A');
  await git(repoDir, 'commit', '-m', 'main: apply note component changes');

  // Switch back to feature branch for testing
  await git(repoDir, 'checkout', 'feature');

  return {
    repoDir,
    cleanup: async () => {
      await fs.promises.rm(repoDir, { recursive: true, force: true });
    },
  };
}

/**
 * Same as above but with a bare "origin" remote where origin/main is stale
 * (doesn't have the cherry-picked changes).
 */
async function setupPhantomFileRepoWithStaleOrigin(): Promise<{
  repoDir: string;
  cleanup: () => Promise<void>;
}> {
  const tmpBase = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'git-integration-'));
  const bareDir = path.join(tmpBase, 'origin.git');
  const repoDir = path.join(tmpBase, 'work');

  // Create bare "origin" repo
  await fs.promises.mkdir(bareDir, { recursive: true });
  await git(bareDir, 'init', '--bare', '-b', 'main');

  // Clone it to working dir
  await exec('git', ['clone', bareDir, repoDir]);
  await git(repoDir, 'config', 'user.email', 'test@test.com');
  await git(repoDir, 'config', 'user.name', 'Test');

  // Initial commit on main
  await writeFile(repoDir, 'note.component.html', '<div>original</div>\n');
  await writeFile(repoDir, 'note.component.scss', '.note { color: red; }\n');
  await writeFile(repoDir, 'other-file.ts', 'export const x = 1;\n');
  await git(repoDir, 'add', '-A');
  await git(repoDir, 'commit', '-m', 'initial commit');
  await git(repoDir, 'push', 'origin', 'main');

  // Create feature branch
  await git(repoDir, 'checkout', '-b', 'feature');

  // Feature changes
  await writeFile(repoDir, 'note.component.html', '<div>updated by feature</div>\n');
  await writeFile(repoDir, 'note.component.scss', '.note { color: blue; }\n');
  await writeFile(repoDir, 'other-file.ts', 'export const x = 2;\n');
  await git(repoDir, 'add', '-A');
  await git(repoDir, 'commit', '-m', 'feature: update note components and other-file');

  await writeFile(repoDir, 'feature-only.ts', 'export const y = 1;\n');
  await git(repoDir, 'add', '-A');
  await git(repoDir, 'commit', '-m', 'feature: add feature-only file');

  // Apply note changes to local main (but DON'T push — origin/main stays stale)
  await git(repoDir, 'checkout', 'main');
  await writeFile(repoDir, 'note.component.html', '<div>updated by feature</div>\n');
  await writeFile(repoDir, 'note.component.scss', '.note { color: blue; }\n');
  await git(repoDir, 'add', '-A');
  await git(repoDir, 'commit', '-m', 'main: apply note component changes');
  // origin/main is now behind local main

  await git(repoDir, 'checkout', 'feature');

  return {
    repoDir,
    cleanup: async () => {
      await fs.promises.rm(tmpBase, { recursive: true, force: true });
    },
  };
}

describe('phantom file filtering (integration)', () => {
  // --- No-remote scenario (local main only) ---

  describe('no remote — local main has cherry-picked changes', () => {
    let repoDir: string;
    let cleanup: () => Promise<void>;

    beforeEach(async () => {
      ({ repoDir, cleanup } = await setupPhantomFileRepo());
    });
    afterEach(async () => cleanup());

    it('getChangedFiles should NOT include note files already on main', async () => {
      const files = await getChangedFiles(repoDir, 'main');
      const paths = files.map((f) => f.path);

      expect(paths).not.toContain('note.component.html');
      expect(paths).not.toContain('note.component.scss');
      expect(paths).toContain('other-file.ts');
      expect(paths).toContain('feature-only.ts');
    });

    it('getAllFileDiffs should NOT include diffs for note files already on main', async () => {
      const diff = await getAllFileDiffs(repoDir, 'main');

      expect(diff).not.toContain('note.component.html');
      expect(diff).not.toContain('note.component.scss');
      expect(diff).toContain('other-file.ts');
      expect(diff).toContain('feature-only.ts');
    });

    it('getChangedFilesFromBranch should NOT include note files already on main', async () => {
      const files = await getChangedFilesFromBranch(repoDir, 'feature', 'main');
      const paths = files.map((f) => f.path);

      expect(paths).not.toContain('note.component.html');
      expect(paths).not.toContain('note.component.scss');
      expect(paths).toContain('other-file.ts');
      expect(paths).toContain('feature-only.ts');
    });

    it('getAllFileDiffsFromBranch should NOT include diffs for note files already on main', async () => {
      const diff = await getAllFileDiffsFromBranch(repoDir, 'feature', 'main');

      expect(diff).not.toContain('note.component.html');
      expect(diff).not.toContain('note.component.scss');
      expect(diff).toContain('other-file.ts');
      expect(diff).toContain('feature-only.ts');
    });
  });

  // --- Stale origin scenario (the exact bug reported) ---

  describe('stale origin/main — local main ahead with cherry-picked changes', () => {
    let repoDir: string;
    let cleanup: () => Promise<void>;

    beforeEach(async () => {
      ({ repoDir, cleanup } = await setupPhantomFileRepoWithStaleOrigin());
    });
    afterEach(async () => cleanup());

    it('getChangedFiles should NOT include note files already on local main', async () => {
      const files = await getChangedFiles(repoDir, 'main');
      const paths = files.map((f) => f.path);

      expect(paths).not.toContain('note.component.html');
      expect(paths).not.toContain('note.component.scss');
      expect(paths).toContain('other-file.ts');
      expect(paths).toContain('feature-only.ts');
    });

    it('getAllFileDiffs should NOT include diffs for note files already on local main', async () => {
      const diff = await getAllFileDiffs(repoDir, 'main');

      expect(diff).not.toContain('note.component.html');
      expect(diff).not.toContain('note.component.scss');
      expect(diff).toContain('other-file.ts');
      expect(diff).toContain('feature-only.ts');
    });

    it('getChangedFilesFromBranch should NOT include note files already on local main', async () => {
      const files = await getChangedFilesFromBranch(repoDir, 'feature', 'main');
      const paths = files.map((f) => f.path);

      expect(paths).not.toContain('note.component.html');
      expect(paths).not.toContain('note.component.scss');
      expect(paths).toContain('other-file.ts');
      expect(paths).toContain('feature-only.ts');
    });

    it('origin/main is indeed stale (sanity check)', async () => {
      // Verify our test setup: origin/main should NOT have the note changes
      const originHtml = await git(repoDir, 'show', 'origin/main:note.component.html');
      const localHtml = await git(repoDir, 'show', 'main:note.component.html');

      expect(originHtml).toContain('original');
      expect(localHtml).toContain('updated by feature');
    });
  });
});
