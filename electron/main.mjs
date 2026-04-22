import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import electronUpdater from 'electron-updater';
import log from 'electron-log';

const { autoUpdater } = electronUpdater;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;
const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;
const updaterAccessToken = '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';

/** @type {BrowserWindow | null} */
let mainWindow = null;
let updateCheckTimer = null;

function sendUpdaterStatus(status, data = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send('updater:status', { status, ...data });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
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

  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (error) {
    const message = error?.message ?? String(error);
    sendUpdaterStatus('error', { message, reason });
    return { ok: false, reason: message };
  }
}

function configureAutoUpdater() {
  if (isDev) {
    sendUpdaterStatus('skipped', { reason: 'development-mode' });
    return;
  }

  if (updaterAccessToken) {
    autoUpdater.requestHeaders = {
      Authorization: `token ${updaterAccessToken}`,
    };
  }

  autoUpdater.logger = log;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

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

  autoUpdater.on('update-downloaded', async (info) => {
    sendUpdaterStatus('update-downloaded', { version: info.version });

    const result = await dialog.showMessageBox(mainWindow ?? undefined, {
      type: 'info',
      title: 'Update ready',
      message: 'A new version has been downloaded.',
      detail: 'Restart the app now to finish installing the update.',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });

    if (result.response === 0) {
      setImmediate(() => autoUpdater.quitAndInstall());
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

ipcMain.on('updater:install-now', () => {
  if (!isDev) {
    autoUpdater.quitAndInstall();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (updateCheckTimer) {
    clearInterval(updateCheckTimer);
    updateCheckTimer = null;
  }
});
