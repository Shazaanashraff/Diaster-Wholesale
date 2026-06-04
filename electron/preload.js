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
