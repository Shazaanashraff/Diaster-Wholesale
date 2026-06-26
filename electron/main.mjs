import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import electronUpdater from 'electron-updater';
import log from 'electron-log';

const { autoUpdater } = electronUpdater;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;
const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;

/** @type {BrowserWindow | null} */
let mainWindow = null;
let updateCheckTimer = null;
let updaterDisabledReason = null;

// ── Sandbox runner state ──────────────────────────────────────────────────────
/** @type {import('node:child_process').ChildProcess | null} */
let activeProc = null;

const REPO_ROOT = path.join(__dirname, '..');

/** Strip ANSI escape codes and simplify vitest/playwright output lines. */
function simplify(line) {
  const plain = line.replace(/\x1b\[[0-9;]*[mGKHF]/g, '').trimEnd();
  if (!plain) return null;
  // vitest: " ✓ some suite > some test" → keep as-is
  // vitest: " ❯ running..." / " × FAIL" → normalise to FAIL prefix
  const fail = plain.match(/^\s*(FAIL|×|✗)\s+(.*)/);
  if (fail) return `FAIL ${fail[2]}`;
  const pass = plain.match(/^\s*(✓|√)\s+(.*)/);
  if (pass) return `✓ ${pass[2]}`;
  return plain;
}

/**
 * Spawn a command, stream output to renderer, resolve on close.
 * @param {string} cmd
 * @param {string[]} args
 * @param {Electron.WebContents} webContents
 * @returns {Promise<{ok:boolean, code:number|null}>}
 */
function runCommand(cmd, args, webContents) {
  if (activeProc) {
    return Promise.resolve({ ok: false, reason: 'already-running' });
  }

  return new Promise((resolve) => {
    activeProc = spawn(cmd, args, { cwd: REPO_ROOT, shell: true });

    function pipeLine(stream) {
      const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
      rl.on('line', (line) => {
        const simplified = simplify(line);
        if (simplified && !webContents.isDestroyed()) {
          webContents.send('sandbox:output', simplified);
        }
      });
    }

    if (activeProc.stdout) pipeLine(activeProc.stdout);
    if (activeProc.stderr) pipeLine(activeProc.stderr);

    activeProc.on('close', (code) => {
      const summary = code === 0 ? '✓ done (exit 0)' : `FAIL (exit ${code})`;
      if (!webContents.isDestroyed()) {
        webContents.send('sandbox:output', summary);
      }
      activeProc = null;
      resolve({ ok: code === 0, code });
    });

    activeProc.on('error', (err) => {
      if (!webContents.isDestroyed()) {
        webContents.send('sandbox:output', `FAIL spawn error: ${err.message}`);
      }
      activeProc = null;
      resolve({ ok: false, code: null, reason: err.message });
    });
  });
}

function sendUpdaterStatus(status, data = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send('updater:status', { status, ...data });
}

function resolveIcon() {
  const candidates = [
    path.join(__dirname, '..', 'build', 'icon.ico'),
    path.join(__dirname, '..', 'build', 'icon.png'),
  ];
  return candidates.find(existsSync) ?? undefined;
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    icon: resolveIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Tell the preload to expose window.sandboxRunner — dev builds only.
      additionalArguments: isDev ? ['--enable-sandbox-runner'] : [],
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev && devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

async function checkForUpdates(reason = 'manual') {
  if (isDev) {
    return { ok: false, reason: 'development-mode' };
  }

  if (updaterDisabledReason) {
    return { ok: false, reason: updaterDisabledReason };
  }

  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (error) {
    const rawMessage = error?.message ?? String(error);
    const message = rawMessage;
    sendUpdaterStatus('error', { message, reason });
    return { ok: false, reason: message };
  }
}

function configureAutoUpdater() {
  if (isDev) {
    sendUpdaterStatus('skipped', { reason: 'development-mode' });
    return;
  }

  // Public repo — no token needed. Passing one causes electron-updater to use
  // releases.atom with auth, which GitHub rejects with 404 if the token is
  // invalid/expired, permanently disabling the updater.
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'Hesara2003',
    repo: 'Diaster-Wholesale',
    vPrefixedTagName: true,
  });

  autoUpdater.logger = log;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.disableWebInstaller = true;
  autoUpdater.disableDifferentialDownload = true;

  autoUpdater.on('checking-for-update', () => {
    sendUpdaterStatus('checking');
  });

  autoUpdater.on('update-available', (info) => {
    sendUpdaterStatus('update-available', { version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    sendUpdaterStatus('update-not-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    sendUpdaterStatus('download-progress', {
      percent: Math.round(progress.percent ?? 0),
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendUpdaterStatus('update-downloaded', { version: info.version });

    const dialogOpts = {
      type: 'info',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'App Update Ready',
      message: `A new version (v${info.version}) of Diaster Wholesale is ready to install.`,
      detail: 'The application will restart to complete the installation.',
    };

    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, dialogOpts).then((returnValue) => {
        if (returnValue.response === 0) {
          log.info('User confirmed update restart. Calling quitAndInstall(false, true)...');
          autoUpdater.quitAndInstall(false, true);
        }
      });
    }
  });

  autoUpdater.on('error', (error) => {
    sendUpdaterStatus('error', { message: error?.message ?? String(error) });
  });

  checkForUpdates('startup');

  updateCheckTimer = setInterval(() => {
    checkForUpdates('interval');
  }, UPDATE_CHECK_INTERVAL_MS);
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.diaster.wholesale');
  createMainWindow();
  configureAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

ipcMain.handle('updater:check-now', async () => {
  return checkForUpdates('manual');
});

// ── Sandbox IPC handlers (dev-only) ──────────────────────────────────────────

ipcMain.handle('sandbox:run', async (event, type, filter) => {
  if (app.isPackaged) {
    return { ok: false, reason: 'unavailable-in-packaged-build' };
  }
  const wc = event.sender;
  if (type === 'e2e') {
    const spec = `e2e/${filter?.spec ?? 'pos-checkout'}.spec.ts`;
    return runCommand('npx', ['playwright', 'test', '--reporter=line', spec], wc);
  }
  if (filter?.files?.length) {
    return runCommand('npx', ['vitest', 'run', '--reporter=verbose', ...filter.files], wc);
  }
  return runCommand('npm', ['test'], wc);
});

ipcMain.handle('sandbox:reset', (event) => {
  if (app.isPackaged) {
    return { ok: false, reason: 'unavailable-in-packaged-build' };
  }
  return runCommand('npm', ['run', 'sandbox:reset'], event.sender);
});

ipcMain.handle('sandbox:cancel', () => {
  if (app.isPackaged) {
    return { ok: false, reason: 'unavailable-in-packaged-build' };
  }
  if (!activeProc) {
    return { ok: false, reason: 'no-active-process' };
  }
  const pid = activeProc.pid;
  if (process.platform === 'win32') {
    activeProc.kill();
    if (pid) spawn('taskkill', ['/pid', String(pid), '/T', '/F']);
  } else {
    activeProc.kill('SIGTERM');
  }
  activeProc = null;
  return { ok: true };
});

ipcMain.on('updater:install-now', () => {
  if (!isDev) {
    log.info('Manual install requested via IPC. Calling quitAndInstall(false, true)...');
    autoUpdater.quitAndInstall(false, true);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

let isFlushingCompleted = false;

app.on('before-quit', (e) => {
  if (updateCheckTimer) {
    clearInterval(updateCheckTimer);
    updateCheckTimer = null;
  }

  // If we haven't flushed metrics yet, prevent close, trigger flush, and wait
  if (!isFlushingCompleted && mainWindow && !mainWindow.isDestroyed()) {
    e.preventDefault();
    log.info('App is quitting: sending flush metrics request to renderer...');
    mainWindow.webContents.send('app:flush-metrics');

    // Force quit after 2.5 seconds max timeout
    const forceQuitTimeout = setTimeout(() => {
      log.warn('Metrics flush timed out, force quitting.');
      isFlushingCompleted = true;
      app.quit();
    }, 2500);

    ipcMain.once('app:metrics-flushed', () => {
      log.info('Renderer metrics flushed successfully. Quitting app...');
      clearTimeout(forceQuitTimeout);
      isFlushingCompleted = true;
      app.quit();
    });
  }
});
