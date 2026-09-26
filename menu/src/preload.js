const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.invoke('minimize-window'),
  maximize: () => ipcRenderer.invoke('maximize-window'),
  close: () => ipcRenderer.invoke('close-window'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  startDownload: (data) => ipcRenderer.invoke('start-download', data),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  showInFolder: (filePath) => ipcRenderer.invoke('show-in-folder', filePath),
  notify: (title, body) => ipcRenderer.invoke('notify', { title, body }),
  playSound: () => ipcRenderer.invoke('play-sound'),
  setDownloadCount: (count) => ipcRenderer.invoke('set-download-count', count),

  onAction: (callback) => {
    ipcRenderer.on('new-download', () => callback('new-download'));
    ipcRenderer.on('show-history', () => callback('show-history'));
    ipcRenderer.on('download-completed', () => callback('download-completed'));
  }
});
