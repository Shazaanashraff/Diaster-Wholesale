import { describe, it, expect } from 'vitest';
import { readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { TEST_GROUPS } from '../test-groups';

function findTestFiles(dir: string): string[] {
  const results: string[] = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTestFiles(full));
    } else if (/\.test\.[tj]sx?$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

function normalize(p: string) {
  return p.replace(/\\/g, '/');
}

const root = resolve('.');
const srcDir = resolve('src');

const allVitestFiles = TEST_GROUPS.flatMap((g) => g.vitestFiles);

describe('test-groups catalog precision contract', () => {
  it('every src/**/*.test.{ts,tsx} is registered in exactly one group', () => {
    const onDisk = findTestFiles(srcDir).map((f) =>
      normalize(f.replace(root + '/', '').replace(root + '\\', ''))
    );

    const orphans: string[] = [];
    const duplicates: string[] = [];

    for (const file of onDisk) {
      const count = allVitestFiles.filter((v) => normalize(v) === file).length;
      if (count === 0) orphans.push(file);
      if (count > 1) duplicates.push(file);
    }

    if (orphans.length > 0) {
      throw new Error(
        `These test files are not registered in any TEST_GROUP vitestFiles:\n` +
          orphans.map((f) => `  • ${f}`).join('\n') +
          `\n\nAdd them to the correct group in src/sandbox/test-groups.ts.`
      );
    }
    expect(duplicates).toEqual([]);
  });

  it('every listed vitestFiles path exists on disk', () => {
    const missing = allVitestFiles.filter(
      (f) => !existsSync(resolve(f))
    );
    expect(missing, `Stale catalog entries — files not found: ${missing.join(', ')}`).toEqual([]);
  });
});
