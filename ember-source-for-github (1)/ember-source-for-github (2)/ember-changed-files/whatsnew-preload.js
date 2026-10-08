const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('whatsNew', { close: () => ipcRenderer.send('whatsnew:close') });
