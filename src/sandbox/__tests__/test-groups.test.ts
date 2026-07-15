import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { TEST_GROUPS } from '../test-groups';

// The precision contract (todo-010): keeps src/sandbox/test-groups.ts honest.
// This file is itself a src/**/*.test.ts file, so it must be listed in the
// `sandbox` group's vitestFiles below, or it flags itself as an orphan.

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SRC = path.join(ROOT, 'src');

function normalise(p: string): string {
  return p.replace(/\\/g, '/');
}

function findTestFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...findTestFiles(full));
    } else if (/\.test\.(ts|tsx)$/.test(entry.name)) {
      out.push(normalise(path.relative(ROOT, full)));
    }
  }
  return out;
}

describe('sandbox test-groups precision contract', () => {
  it('every src/**/*.test.{ts,tsx} file is listed in exactly one group', () => {
    const onDisk = findTestFiles(SRC);
    const listed = TEST_GROUPS.flatMap((g) => g.vitestFiles.map(normalise));

    for (const file of onDisk) {
      const matches = listed.filter((f) => f === file);
      expect(matches.length, `${file} should be registered in exactly one TEST_GROUPS entry`).toBe(1);
    }

    // Also catches stale entries pointing at files that no longer exist on disk.
    expect(listed.length).toBe(onDisk.length);
  });

  it('every vitestFiles path in TEST_GROUPS resolves to a real file', () => {
    for (const group of TEST_GROUPS) {
      for (const file of group.vitestFiles) {
        expect(existsSync(path.join(ROOT, file)), `${file} (group "${group.id}") does not exist`).toBe(true);
      }
    }
  });

  it('every non-null e2e entry resolves to e2e/<name>.spec.ts', () => {
    for (const group of TEST_GROUPS) {
      if (group.e2e === null) continue;
      const specPath = path.join(ROOT, 'e2e', `${group.e2e}.spec.ts`);
      expect(existsSync(specPath), `e2e/${group.e2e}.spec.ts (group "${group.id}") does not exist`).toBe(true);
    }
  });
});
