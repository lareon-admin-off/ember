const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('setup', {
  done: o => ipcRenderer.send('setup:done', o),
  quit: () => ipcRenderer.send('setup:quit'),
  minimize: () => ipcRenderer.send('setup:min'),
  pickFolder: () => ipcRenderer.invoke('setup:folder'),
  downloadsDefault: () => ipcRenderer.invoke('setup:dl-default')
});
