const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('setup', {
  done: () => ipcRenderer.send('setup:done'),
  quit: () => ipcRenderer.send('setup:quit'),
  minimize: () => ipcRenderer.send('setup:min')
});
