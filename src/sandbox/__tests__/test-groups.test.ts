import { readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { TEST_GROUPS } from '../test-groups';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

function collectTestFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...collectTestFiles(full));
    } else if (/\.test\.(ts|tsx)$/.test(entry)) {
      results.push(full);
    }
  }
  return results;
}

const norm = (p: string) => p.replace(/\\/g, '/');

describe('test catalog precision contract', () => {
  const srcDir = path.join(PROJECT_ROOT, 'src');
  const discovered = collectTestFiles(srcDir).map((abs) =>
    norm(path.relative(PROJECT_ROOT, abs)),
  );

  const registeredFiles = new Set(
    TEST_GROUPS.flatMap((g) => g.vitestFiles.map(norm)),
  );

  it('every src/**/*.test.{ts,tsx} is in exactly one group vitestFiles', () => {
    const orphans = discovered.filter((f) => !registeredFiles.has(norm(f)));
    expect(
      orphans,
      `Unregistered test files (add to a group in src/sandbox/test-groups.ts):\n  ${orphans.join('\n  ')}`,
    ).toHaveLength(0);
  });

  it('every listed vitestFiles path exists on disk', () => {
    const missing: string[] = [];
    for (const group of TEST_GROUPS) {
      for (const f of group.vitestFiles) {
        const abs = path.resolve(PROJECT_ROOT, f);
        if (!existsSync(abs)) missing.push(f);
      }
    }
    expect(
      missing,
      `Missing test files (listed in catalog but not on disk):\n  ${missing.join('\n  ')}`,
    ).toHaveLength(0);
  });
});
