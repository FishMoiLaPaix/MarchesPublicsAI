const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getSources: () => ipcRenderer.invoke('get-sources'),
  searchSource: (args) => ipcRenderer.invoke('search-source', args),
  analyzeWithAI: (args) => ipcRenderer.invoke('analyze-with-ai', args),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  testAI: (config) => ipcRenderer.invoke('test-ai', config),
  setTheme: (theme) => ipcRenderer.send('set-theme', theme),
  storeGet: (key) => ipcRenderer.invoke('store-get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),
  getGeoReference: () => ipcRenderer.invoke('get-geo-reference')
});
