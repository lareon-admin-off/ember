const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('updatePrompt', { choose: i => ipcRenderer.send('upd:choice', i) });
