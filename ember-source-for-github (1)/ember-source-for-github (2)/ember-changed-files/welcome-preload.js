const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('welcome', { start: () => ipcRenderer.send('welcome:start'), minimize: () => ipcRenderer.send('welcome:min') });
