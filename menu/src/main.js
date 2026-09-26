const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let tray;
let backendProcess;
let compilerProcess;

const isDev = process.argv.includes('--dev');
const resourcesPath = app.isPackaged ? path.join(process.resourcesPath, 'resources') : path.join(__dirname, '..', 'resources');

function startBackend() {
  const backendPath = path.join(resourcesPath, 'backend', 'ender_backend.exe');
  if (fs.existsSync(backendPath)) {
    backendProcess = spawn(backendPath, [], { detached: false, stdio: 'ignore' });
    backendProcess.on('error', (err) => console.error('Backend başlatılamadı:', err));
  }
}

function startCompiler() {
  const compilerPath = path.join(resourcesPath, 'compiler', 'compiler.exe');
  if (fs.existsSync(compilerPath)) {
    compilerProcess = spawn(compilerPath, [], { detached: false, stdio: 'ignore' });
    compilerProcess.on('error', (err) => console.error('Compiler başlatılamadı:', err));
  }
}

function killProcesses() {
  if (backendProcess) { backendProcess.kill(); backendProcess = null; }
  if (compilerProcess) { compilerProcess.kill(); compilerProcess = null; }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 700,
    minHeight: 500,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, '..', 'assets', 'icons', 'icon.ico'),
    show: false
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    const frontendPath = path.join(resourcesPath, 'frontend', 'index.html');
    mainWindow.loadFile(frontendPath);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (!isDev) {
    mainWindow.setMenu(null);
  }
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'icons', 'icon.ico');
  if (!fs.existsSync(iconPath)) {
    const icon = nativeImage.createEmpty();
    tray = new Tray(icon);
  } else {
    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon);
  }

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Göster', click: () => mainWindow && mainWindow.show() },
    { label: 'Gizle', click: () => mainWindow && mainWindow.hide() },
    { type: 'separator' },
    { label: 'Çıkış', click: () => app.quit() }
  ]);

  tray.setToolTip('Video_Indirici');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow && mainWindow.show();
  });
}

const menuTemplate = [
  {
    label: 'Dosya',
    submenu: [
      { label: 'Yeni İndirme', accelerator: 'CmdOrCtrl+N', click: () => sendAction('new-download') },
      { label: 'Geçmişi Göster', accelerator: 'CmdOrCtrl+H', click: () => sendAction('show-history') },
      { type: 'separator' },
      { label: 'Çıkış', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
    ]
  },
  {
    label: 'Düzenle',
    submenu: [
      { role: 'undo', label: 'Geri Al' },
      { role: 'redo', label: 'İleri Al' },
      { type: 'separator' },
      { role: 'cut', label: 'Kes' },
      { role: 'copy', label: 'Kopyala' },
      { role: 'paste', label: 'Yapıştır' }
    ]
  },
  {
    label: 'Görünüm',
    submenu: [
      { role: 'reload', label: 'Yenile' },
      { role: 'toggleDevTools', label: 'Geliştirici Araçları' },
      { type: 'separator' },
      { role: 'zoomIn', label: 'Yakınlaştır' },
      { role: 'zoomOut', label: 'Uzaklaştır' },
      { role: 'resetZoom', label: 'Sıfırla' }
    ]
  },
  {
    label: 'Yardım',
    submenu: [
      { label: 'Hakkında', click: () => showAbout() },
      { label: 'GitHub', click: () => shell.openExternal('https://github.com') }
    ]
  }
];

function sendAction(action) {
  mainWindow && mainWindow.webContents.send(action);
}

function showAbout() {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Hakkında',
    message: 'Video_Indirici v1.0.0',
    detail: 'Electron tabanlı video indirme uygulaması'
  });
}

app.whenReady().then(() => {
  startBackend();
  startCompiler();
  createWindow();
  createTray();
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  killProcesses();
});

ipcMain.handle('minimize-window', () => mainWindow && mainWindow.minimize());
ipcMain.handle('maximize-window', () => {
  if (mainWindow) {
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  }
});
ipcMain.handle('close-window', () => mainWindow && mainWindow.close());
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle('start-download', async (event, data) => {
  return { success: true, message: 'İndirme başlatıldı', data };
});
ipcMain.handle('open-external', async (event, url) => {
  if (url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://'))) {
    await shell.openExternal(url);
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('open-file', async (event, filePath) => {
  if (!filePath || typeof filePath !== 'string') return { success: false, error: 'Yol yok' };
  const error = await shell.openPath(filePath);
  return error ? { success: false, error } : { success: true };
});

ipcMain.handle('show-in-folder', async (event, filePath) => {
  if (!filePath || typeof filePath !== 'string') return { success: false, error: 'Yol yok' };
  if (!fs.existsSync(filePath)) return { success: false, error: 'Dosya bulunamadı' };
  shell.showItemInFolder(filePath);
  return { success: true };
});
