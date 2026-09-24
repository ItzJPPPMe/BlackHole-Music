const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.invoke('minimize-window'),
  maximize: () => ipcRenderer.invoke('maximize-window'),
  close: () => ipcRenderer.invoke('close-window'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  startDownload: (data) => ipcRenderer.invoke('start-download', data),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  onAction: (callback) => {
    ipcRenderer.on('new-download', () => callback('new-download'));
    ipcRenderer.on('show-history', () => callback('show-history'));
  }
});
