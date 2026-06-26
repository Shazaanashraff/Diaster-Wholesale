// @vitest-environment node
// Precision contract: every src/**/*.test.{ts,tsx} on disk must appear in
// exactly one group's vitestFiles, and every listed path must exist.
// Add a new test file without registering it here → this test fails the build.

import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEST_GROUPS } from '../test-groups';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');
// __dirname = src/sandbox/__tests__ → 3 levels up = project root
const PROJECT_ROOT = join(__dirname, '..', '..', '..');
const SRC_DIR = join(PROJECT_ROOT, 'src');

function normalise(p: string): string {
  return p.split(sep).join('/');
}

/** Recursively find all *.test.ts / *.test.tsx files under dir. */
function findTestFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...findTestFiles(full));
    } else if (/\.test\.[jt]sx?$/.test(entry)) {
      // Return as a relative path from PROJECT_ROOT, normalised to forward slashes
      results.push(normalise(full.replace(PROJECT_ROOT + sep, '')));
    }
  }
  return results;
}

describe('test-groups precision contract', () => {
  const allFiles = findTestFiles(SRC_DIR);

  // Flatten all registered paths, normalised
  const allRegistered: string[] = TEST_GROUPS.flatMap(g =>
    g.vitestFiles.map(f => normalise(f))
  );

  it('every listed vitestFiles path resolves to a real file', () => {
    const missing: string[] = [];
    for (const group of TEST_GROUPS) {
      for (const f of group.vitestFiles) {
        if (!existsSync(join(PROJECT_ROOT, f))) {
          missing.push(`[${group.id}] ${f}`);
        }
      }
    }
    expect(
      missing,
      `These registered vitestFiles paths do not exist on disk:\n  ${missing.join('\n  ')}`
    ).toHaveLength(0);
  });

  it('every test file on disk appears in exactly one group', () => {
    const orphans: string[] = [];
    const duplicates: string[] = [];

    for (const file of allFiles) {
      const count = allRegistered.filter(r => r === file).length;
      if (count === 0) {
        orphans.push(file);
      } else if (count > 1) {
        duplicates.push(file);
      }
    }

    if (orphans.length > 0 || duplicates.length > 0) {
      const parts: string[] = [];
      if (orphans.length > 0) {
        parts.push(
          `Unregistered test files (add to a group in src/sandbox/test-groups.ts):\n  ${orphans.join('\n  ')}`
        );
      }
      if (duplicates.length > 0) {
        parts.push(
          `Test files registered in multiple groups:\n  ${duplicates.join('\n  ')}`
        );
      }
      throw new Error(parts.join('\n\n'));
    }

    expect(orphans).toHaveLength(0);
    expect(duplicates).toHaveLength(0);
  });
});
