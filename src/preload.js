const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lymoAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  scanFolder: (folderPath) => ipcRenderer.invoke('scan-folder', folderPath)
});
