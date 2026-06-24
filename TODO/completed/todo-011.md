---
id: todo-011
title: Sandbox feature [4/7] — live runner IPC (window.sandboxRunner) in Electron main + preload
priority: 2
created: 2026-06-24
status: completed
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
Dev-gate: main.mjs passes additionalArguments:['--enable-sandbox-runner'] to webPreferences only
when !app.isPackaged (isDev). preload.js checks process.argv.includes('--enable-sandbox-runner')
before calling contextBridge.exposeInMainWorld — so window.sandboxRunner is undefined in packaged builds.

All 3 IPC handlers return {ok:false, reason:'unavailable-in-packaged-build'} when app.isPackaged.
concurrent run rejection: activeProc null check at top of runSandboxCommand.
Windows cancel: activeProc.kill() + taskkill /pid <pid> /T /F. POSIX: activeProc.kill('SIGTERM').
sandbox:reset streams npm run sandbox:reset output.

Packaged-build undefined: structurally guaranteed — preload never calls exposeInMainWorld without flag.
npx tsc --noEmit: clean. npm test: 31 pass, 4 skip.
