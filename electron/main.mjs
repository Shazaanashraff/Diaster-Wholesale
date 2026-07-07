import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
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
let isCheckingForUpdate = false;
let lastSentStatus = null;

function sendUpdaterStatus(status, data = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  lastSentStatus = { status, ...data };
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

  // If a check or download is already in progress, resync the renderer with the
  // current state instead of starting a second concurrent call — electron-updater
  // fires `checking-for-update` for the second call but never fires a completion
  // event, leaving the UI stuck on "checking" forever.
  if (isCheckingForUpdate) {
    log.info(`[updater] checkForUpdates('${reason}') skipped — check already in progress`);
    if (lastSentStatus) {
      sendUpdaterStatus(lastSentStatus.status, lastSentStatus);
    }
    return { ok: false, reason: 'check-in-progress' };
  }

  isCheckingForUpdate = true;
  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (error) {
    const rawMessage = error?.message ?? String(error);
    const message = rawMessage;
    sendUpdaterStatus('error', { message, reason });
    return { ok: false, reason: message };
  } finally {
    isCheckingForUpdate = false;
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
    owner: 'Shazaanashraff',
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

  // The renderer auto-triggers a check at startup (after it subscribes to events),
  // so we do NOT call checkForUpdates here — doing so caused a race where the main
  // process fired events before the renderer was subscribed, then the renderer's
  // auto-check ran concurrently and got stuck in the 'checking' state forever.
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
