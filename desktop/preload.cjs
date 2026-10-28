const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('wallpapers', {
  state: () => ipcRenderer.invoke('state'),
  update: value => ipcRenderer.invoke('settings', value),
  choose: kind => ipcRenderer.invoke('choose', kind),
  generate: () => ipcRenderer.invoke('generate'),
  save: () => ipcRenderer.invoke('save'),
  openFolder: () => ipcRenderer.invoke('open-folder'),
  change: callback => { const handler = (_event, value) => callback(value); ipcRenderer.on('changed', handler); return () => ipcRenderer.removeListener('changed', handler); }
});
