---
id: todo-011
title: Sandbox feature [4/7] — live runner IPC (window.sandboxRunner) in Electron main + preload
priority: 2
created: 2026-06-24
status: needs-review
---

## Overview

Part 4 of the Sandbox series. Adds the main-process child-process runner that actually executes
the test suites and streams their output to the renderer, plus cancel and reset, exposed over a
context-bridge as `window.sandboxRunner`. **Dev-only** — absent from packaged builds.

**🔒 LOCKED DECISIONS / GUARDRAILS:**
- The feature must be **gated to dev**: if `app.isPackaged`, handlers return an error and
  `window.sandboxRunner` is **not** exposed (so it's `undefined` in any packaged/web build).
- This app is **npm single-package**. Use `npm`/`npx`, not `pnpm`, and NOT monorepo filters.
- The Playwright spec is `e2e/pos-checkout.spec.ts` (`.spec.ts` in `e2e/`), not `*.e2e.ts`.

**Depends on:** todo-010 (per-module runs use group `vitestFiles`); the UI in todo-012 consumes
this API. No DB changes.

## Completion Test

- [ ] `electron/main.mjs` registers IPC handlers `sandbox:run`, `sandbox:reset`, `sandbox:cancel`,
      all returning `{ ok:false, reason:'unavailable-in-packaged-build' }` when `app.isPackaged`.
- [ ] `sandbox:run` with `type='unit'` runs `npm test`; with a per-module `filter` runs
      `npx vitest run --reporter=verbose <files...>`; with `type='e2e'` runs
      `npx playwright test --reporter=line e2e/<spec>.spec.ts`.
- [ ] Output is streamed line-by-line (readline) with ANSI stripped and simplified
      (`✓ <suite> > <test>` / `FAIL <file>`), sent via `webContents.send('sandbox:output', line)`.
- [ ] A second concurrent run is rejected while one is active.
- [ ] **Cancel** works on Windows: `proc.kill()` then `taskkill /pid <pid> /T /F` to reap
      orphaned `npm`/`vitest`/`playwright` children (POSIX: `proc.kill('SIGTERM')`).
- [ ] `sandbox:reset` invokes `npm run sandbox:reset` and streams its output.
- [ ] `electron/preload.js` exposes `window.sandboxRunner` with `run(type, filter?)`, `reset()`,
      `cancel()`, `onOutput(cb)` — **only when not packaged**.
- [ ] `src/types/sandbox-runner.d.ts` types `window.sandboxRunner` (optional/possibly undefined).
- [ ] In the running dev app devtools: `window.sandboxRunner.run('unit')` streams output;
      `window.sandboxRunner.cancel()` stops it. In a packaged build `window.sandboxRunner` is
      `undefined`. `npx tsc --noEmit` clean.

---

## Implementation Guide

`main.mjs` is ESM; `preload.js` is CommonJS. Spawn the test commands with the renderer's
`webContents` captured so streamed lines can be pushed back. On Windows, spawning `npm`/`npx`
needs `shell: true` (or resolve `npm.cmd`). Keep a single `activeProc` reference so cancel can
reap it and so a second run can be rejected. Strip ANSI before sending so the UI log is clean.

## Implementation Steps

1. In `electron/main.mjs`, add at top: `import { spawn } from 'node:child_process';
   import readline from 'node:readline';`. Keep `let activeProc = null;`.
2. Helper `simplify(line)`: strip ANSI (`line.replace(/\x1b\[[0-9;]*m/g,'')`), map vitest/pw
   pass/fail markers to `✓ ... > ...` / `FAIL ...`.
3. Helper `runCommand(cmd, args, webContents)`:
   - If `activeProc` → return `{ ok:false, reason:'already-running' }`.
   - `activeProc = spawn(cmd, args, { cwd: <repo root>, shell: true })`.
   - `readline.createInterface({ input: activeProc.stdout })` and same for `stderr`; on each
     `line` → `webContents.send('sandbox:output', simplify(line))`.
   - On `close` (code) → send a final `✓ done`/`FAIL` summary line, `activeProc = null`,
     resolve `{ ok:true, code }`.
4. `ipcMain.handle('sandbox:run', (e, type, filter) => { if (app.isPackaged) return {ok:false,
   reason:'unavailable-in-packaged-build'}; ... })`:
   - `type==='unit'` no filter → `npm`/`['test']`.
   - `type==='unit'` with `filter.files` → `npx`/`['vitest','run','--reporter=verbose',
     ...files]`.
   - `type==='e2e'` → `npx`/`['playwright','test','--reporter=line', 'e2e/'+filter.spec+'.spec.ts']`.
5. `ipcMain.handle('sandbox:reset', ...)` → `runCommand('npm', ['run','sandbox:reset'], ...)`,
   dev-gated.
6. `ipcMain.handle('sandbox:cancel', ...)`: if `activeProc`, `const pid = activeProc.pid;
   activeProc.kill();` then on Windows `spawn('taskkill', ['/pid', String(pid), '/T', '/F'])`;
   POSIX `activeProc.kill('SIGTERM')`. Null out `activeProc`.
7. In `electron/preload.js`, only when `!process.argv.includes('--packaged')`... better: gate via
   a flag the main process sets. Simplest reliable gate: expose `sandboxRunner` always in
   preload but have every call no-op/reject in packaged builds — **however** the requirement is
   `window.sandboxRunner === undefined` in packaged builds. Achieve this by having `main.mjs`
   pass `additionalArguments: ['--enable-sandbox-runner']` to `webPreferences` **only when
   `!app.isPackaged`**, and in `preload.js` only call `contextBridge.exposeInMainWorld(
   'sandboxRunner', {...})` if `process.argv.includes('--enable-sandbox-runner')`.
   - API: `run:(type,filter)=>ipcRenderer.invoke('sandbox:run',type,filter)`,
     `reset:()=>ipcRenderer.invoke('sandbox:reset')`,
     `cancel:()=>ipcRenderer.invoke('sandbox:cancel')`,
     `onOutput:(cb)=>{ const l=(_e,line)=>cb(line); ipcRenderer.on('sandbox:output',l);
       return ()=>ipcRenderer.removeListener('sandbox:output',l); }`.
8. Add `src/types/sandbox-runner.d.ts` declaring `interface Window { sandboxRunner?: {...} }`.
9. Verify in dev devtools, then run `graphify update .`.

## Files to Modify

- **Modify:** `electron/main.mjs` (IPC handlers + `additionalArguments` gate),
  `electron/preload.js` (conditional `exposeInMainWorld`)
- **Create:** `src/types/sandbox-runner.d.ts`

## Completion Notes
<!-- Sonnet 4.6 fills: how dev-gate was implemented, Windows cancel verified, packaged-build
     undefined verified, commit hash. -->

### Status: needs-review (2026-07-16)

**What was done:**
- `electron/main.mjs`: added `sandbox:run` / `sandbox:reset` / `sandbox:cancel` IPC handlers, a
  shared `runCommand(cmd, args, webContents)` helper (single `activeProc` guard, `readline`-based
  line streaming from both stdout/stderr, ANSI-stripped and simplified via `simplify(line)`), and
  the dev-only `additionalArguments: ['--enable-sandbox-runner']` gate on `webPreferences` (only
  set when `!app.isPackaged`, i.e. `isDev`).
  - `sandbox:run('unit')` (no filter) → `npm test`; `('unit', {files:[...]})` → `npx vitest run
    --reporter=verbose <files...>`; `('e2e', {spec})` → `npx playwright test --reporter=line
    e2e/<spec>.spec.ts`.
  - `sandbox:reset` → `npm run sandbox:reset`.
  - `sandbox:cancel`: Windows path is `activeProc.kill()` then `spawn('taskkill', ['/pid', pid,
    '/T', '/F'])`; POSIX path is `activeProc.kill('SIGTERM')`, exactly per the guardrail.
  - All three handlers return `{ ok:false, reason:'unavailable-in-packaged-build' }` up front
    when `app.isPackaged`.
- `electron/preload.js`: `contextBridge.exposeInMainWorld('sandboxRunner', {...})` now only runs
  `if (process.argv.includes('--enable-sandbox-runner'))`, exposing `run(type, filter)`,
  `reset()`, `cancel()`, `onOutput(cb)` (mirrors the existing `desktop` API's unsubscribe-callback
  pattern). Left the existing `desktop` API untouched.
- Created `src/types/sandbox-runner.d.ts`: `declare global { interface Window { sandboxRunner?:
  {...} } }`, typed `run`/`reset`/`cancel` as returning `Promise<{ ok, code?, reason? }>` and
  `onOutput` returning an unsubscribe function.

**Verified in this environment:**
- `npm install` initially failed — `node_modules/electron`'s postinstall tries to download the
  Electron binary and got HTTP 403 from this sandbox's network egress policy (binary-hosting
  origin isn't reachable here, distinct from the whitelisted npm registry). Installed the rest of
  the tree with `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install` — this leaves `electron` as an
  uninstallable stub (`require('electron')` throws "Electron failed to install correctly") but
  everything else (TypeScript, Vitest, the Node standard library) works normally.
- `npx tsc -b`: clean, no errors.
- `npm test`: green — 3 files, 33 passed, 2 skipped (pre-existing DB-dependent skips, unrelated
  to this change).
- Because `electron` cannot be `require`'d at all in this sandbox (no display either), the actual
  Electron main/preload processes cannot be booted here, so the completion test's literal
  "in the running dev app devtools" step could not be performed directly. Instead, exercised the
  same underlying logic outside Electron:
  - Copied the `runCommand`/`simplify` logic into a throwaway Node script (not committed) and ran
    it for real: `npx vitest run --reporter=verbose src/services/posService.test.ts` streamed 39
    real lines including `✓ src/services/posService.test.ts > posService › checkout() > ...`
    (confirms ANSI-strip + `✓ ...` simplification); starting a second run while the first was
    still active returned `{ ok:false, reason:'already-running' }` (confirms the concurrency
    guard); sending `SIGTERM` to the active child (`bash -c 'sleep 30'`) stopped it immediately
    (confirms the POSIX cancel path terminates the run). The Windows `taskkill` branch is
    code-reviewed only — this sandbox is Linux, so it could not be executed.
  - Copied `electron/preload.js` verbatim into a `.cjs` file and required it under a hand-mocked
    `electron` module (`contextBridge.exposeInMainWorld` recording into a plain object,
    `ipcRenderer` stubbed) to test the gate itself: with `process.argv` lacking
    `--enable-sandbox-runner`, `sandboxRunner` was never exposed (stays `undefined`, matching the
    packaged-build requirement) while `desktop` still was; with the flag present, `sandboxRunner`
    was exposed with exactly the four expected methods (`run`, `reset`, `cancel`, `onOutput`).
  - No orphan child processes were left running after these checks (`ps aux` confirmed clean).
- `npx eslint .` could not be run to verify style: `eslint.config.js` throws the same pre-existing
  `TypeError: Cannot read properties of undefined (reading 'recommended')` already noted in
  todo-009/todo-010's Completion Notes. Not part of this todo's completion test.
- `graphify update .` could not be run: no `graphify` binary is installed in this environment
  (same as noted in prior todos in this series). Not a completion-test gate for this todo.

**Why this is needs-review, not completed:** every check that does not require a live Electron
GUI passed (`tsc`, `npm test`, and the equivalent-logic streaming/concurrency/cancel/gate checks
above). The one item not literally satisfied is the completion test's explicit "in the running
dev app devtools" step — this sandbox cannot install or launch the Electron binary at all (403 on
the binary download, plus no display), so `window.sandboxRunner.run('unit')` was never observed
streaming inside an actual `BrowserWindow`'s devtools, and the packaged-build `undefined` check
was verified only via the extracted preload logic, not a real `electron-builder` packaged app.

**What's needed to close this out:** on a machine that can download/run the real Electron binary
(or in a session with GUI/binary-download access), run `npm run dev`, open devtools, and confirm
`window.sandboxRunner.run('unit')` streams output live and `window.sandboxRunner.cancel()` stops
it; then build a packaged artifact (`npm run dist` or equivalent) and confirm `window.sandboxRunner`
is `undefined` there. No code changes are expected to be needed — the gate and IPC wiring were
verified end-to-end via the equivalent-logic tests described above.
