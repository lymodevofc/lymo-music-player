const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const mm = require('music-metadata');

const SUPPORTED_EXT = ['.mp3', '.flac', '.wav'];

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 650,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function walkDir(dir, results) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, results);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_EXT.includes(ext)) {
        results.push(fullPath);
      }
    }
  }
}

ipcMain.handle('select-folder', async () => {
  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('scan-folder', async (event, folderPath) => {
  const filePaths = [];
  try {
    walkDir(folderPath, filePaths);
  } catch (err) {
    return { error: err.message, tracks: [] };
  }

  const tracks = [];
  for (const filePath of filePaths) {
    try {
      const metadata = await mm.parseFile(filePath, { duration: true, skipCovers: false });
      const common = metadata.common || {};
      const format = metadata.format || {};

      let coverDataUrl = null;
      if (common.picture && common.picture.length > 0) {
        const pic = common.picture[0];
        const base64 = Buffer.from(pic.data).toString('base64');
        coverDataUrl = `data:${pic.format};base64,${base64}`;
      }

      tracks.push({
        filePath,
        fileName: path.basename(filePath),
        title: common.title || path.basename(filePath, path.extname(filePath)),
        artist: common.artist || 'Unknown Artist',
        album: common.album || 'Unknown Album',
        duration: format.duration || 0,
        cover: coverDataUrl
      });
    } catch (err) {
      tracks.push({
        filePath,
        fileName: path.basename(filePath),
        title: path.basename(filePath, path.extname(filePath)),
        artist: 'Unknown Artist',
        album: 'Unknown Album',
        duration: 0,
        cover: null
      });
    }
  }

  return { error: null, tracks };
});
