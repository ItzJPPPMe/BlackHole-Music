const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, dialog, shell, Notification } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

let mainWindow;
let tray;
let backendProcess;
let compilerProcess;
let downloadCount = 0;
let lastNotificationSound = 0;

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
      { label: 'GitHub', click: () => shell.openExternal('https://github.com/ItzJPPPMe/BlackHole-Music') },
      { label: 'Discord', click: () => shell.openExternal('https://discord.gg/mcj4kYUZJm') },
      { label: 'Güncellemeleri Kontrol Et', click: () => showUpdateCheck() }
    ]
  }
];

function sendAction(action) {
  mainWindow && mainWindow.webContents.send(action);
}

function updateTrayCount() {
  if (!tray) return;
  const count = downloadCount > 0 ? downloadCount : 0;
  tray.setToolTip(count > 0 ? `Video_Indirici — ${count} aktif indirme` : 'Video_Indirici');
  const contextMenu = Menu.buildFromTemplate([
    { label: count > 0 ? `Aktif indirme: ${count}` : 'İndirme yok', enabled: false },
    { type: 'separator' },
    { label: 'Göster', click: () => mainWindow && mainWindow.show() },
    { label: 'Gizle', click: () => mainWindow && mainWindow.hide() },
    { type: 'separator' },
    { label: 'Çıkış', click: () => app.quit() }
  ]);
  tray.setContextMenu(contextMenu);
}

function showNotification(title, body, icon) {
  if (!Notification.isSupported()) return;
  const opts = { title, body: String(body || '') };
  const iconPath = icon || path.join(__dirname, '..', 'assets', 'icons', 'icon.ico');
  if (fs.existsSync(iconPath)) opts.icon = iconPath;
  try { new Notification(opts).show(); } catch (e) { /* sessiz */ }
}

function playCompletionSound() {
  try {
    const now = Date.now();
    if (now - lastNotificationSound < 1500) return;
    lastNotificationSound = now;
    const { execSync } = require('child_process');
    let f = 0;
    const beep = setInterval(() => {
      f++;
      try {
        execSync('rundll32 user32.dll,MessageBeep');
      } catch (e) {}
      if (f >= 3) clearInterval(beep);
    }, 350);
  } catch (e) {}
}

function pollDownloads() {
  const req = http.get('http://127.0.0.1:3000/api/downloads/progress', (res) => {
    let body = '';
    res.on('data', (c) => { body += c; });
    res.on('end', () => {
      try {
        const json = JSON.parse(body);
        const prog = json && json.data && typeof json.data.progress === 'number' ? json.data.progress : -1;
        if (prog >= 0 && prog < 100) {
          if (downloadCount === 0) { downloadCount = 1; updateTrayCount(); }
        } else if (prog === 100) {
          if (downloadCount > 0) {
            downloadCount = 0;
            updateTrayCount();
            showNotification('İndirme tamamlandı', 'Dosya başarıyla indirildi.');
            playCompletionSound();
            sendAction('download-completed');
          }
        }
      } catch (e) {}
    });
  });
  req.on('error', () => {});
  req.setTimeout(1000, () => req.destroy());
}

setInterval(pollDownloads, 2000);

function showAbout() {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Hakkında',
    message: 'Video_Indirici v1.3.0',
    detail: 'Electron tabanlı video indirme uygulaması\nGitHub: https://github.com/ItzJPPPMe/BlackHole-Music'
  });
}

async function showUpdateCheck() {
  try {
    const res = await fetch('http://127.0.0.1:3000/api/update/check');
    const json = await res.json();
    const d = json?.data || {};
    if (d.update_available) {
      const choice = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Güncelleme mevcut',
        message: `Yeni sürüm: v${d.latest}`,
        detail: `Mevcut sürüm: v${d.current}\nGitHub sayfasına gitmek istiyor musun?`,
        buttons: ['GitHub\'a Git', 'Kapat'],
        defaultId: 0,
        cancelId: 1
      });
      if (choice.response === 0) {
        shell.openExternal(d.repo_url + '/releases');
      }
    } else {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Güncelleme yok',
        message: `En son sürümü kullanıyorsunuz (v${d.current || '1.3.0'}).`
      });
    }
  } catch (err) {
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Kontrol başarısız',
      message: 'Güncelleme kontrolü yapılamadı.',
      detail: String(err && err.message ? err.message : err)
    });
  }
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

ipcMain.handle('notify', async (event, { title, body }) => {
  showNotification(title || 'Bildirim', body || '');
  return { success: true };
});

ipcMain.handle('play-sound', async () => {
  playCompletionSound();
  return { success: true };
});

ipcMain.handle('set-download-count', async (event, count) => {
  downloadCount = typeof count === 'number' ? count : 0;
  updateTrayCount();
  return { success: true };
});
