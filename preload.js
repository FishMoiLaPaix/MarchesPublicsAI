const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getSources: () => ipcRenderer.invoke('get-sources'),
  searchSource: (args) => ipcRenderer.invoke('search-source', args),
  analyzeWithAI: (args) => ipcRenderer.invoke('analyze-with-ai', args),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  testAI: (config) => ipcRenderer.invoke('test-ai', config)
});
