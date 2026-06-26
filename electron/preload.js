const { contextBridge, ipcRenderer } = require('electron');

// Expose sandboxRunner only in dev builds.
// main.mjs passes --enable-sandbox-runner via additionalArguments when !app.isPackaged.
if (process.argv.includes('--enable-sandbox-runner')) {
  contextBridge.exposeInMainWorld('sandboxRunner', {
    run: (type, filter) => ipcRenderer.invoke('sandbox:run', type, filter),
    reset: () => ipcRenderer.invoke('sandbox:reset'),
    cancel: () => ipcRenderer.invoke('sandbox:cancel'),
    onOutput: (cb) => {
      const listener = (_event, line) => cb(line);
      ipcRenderer.on('sandbox:output', listener);
      return () => ipcRenderer.removeListener('sandbox:output', listener);
    },
  });
}

contextBridge.exposeInMainWorld('desktop', {
  updater: {
    checkNow: () => ipcRenderer.invoke('updater:check-now'),
    installNow: () => ipcRenderer.send('updater:install-now'),
    onStatus: (callback) => {
      if (typeof callback !== 'function') {
        return () => {};
      }

      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('updater:status', listener);
      return () => ipcRenderer.removeListener('updater:status', listener);
    },
  },
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  },
  onFlushMetrics: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('app:flush-metrics', listener);
    return () => ipcRenderer.removeListener('app:flush-metrics', listener);
  },
  sendMetricsFlushed: () => ipcRenderer.send('app:metrics-flushed'),
});
