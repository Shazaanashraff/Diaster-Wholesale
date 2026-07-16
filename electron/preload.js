const { contextBridge, ipcRenderer } = require('electron');

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

// Dev-only Sandbox test runner (todo-011). The main process only passes
// --enable-sandbox-runner when !app.isPackaged, so this is absent (undefined)
// from any packaged/web build.
if (process.argv.includes('--enable-sandbox-runner')) {
  contextBridge.exposeInMainWorld('sandboxRunner', {
    run: (type, filter) => ipcRenderer.invoke('sandbox:run', type, filter),
    reset: () => ipcRenderer.invoke('sandbox:reset'),
    cancel: () => ipcRenderer.invoke('sandbox:cancel'),
    onOutput: (callback) => {
      if (typeof callback !== 'function') {
        return () => {};
      }

      const listener = (_event, line) => callback(line);
      ipcRenderer.on('sandbox:output', listener);
      return () => ipcRenderer.removeListener('sandbox:output', listener);
    },
  });
}
