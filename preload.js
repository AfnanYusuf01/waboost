const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Account management
  getAccounts: () => ipcRenderer.invoke('get-accounts'),
  saveAccount: (accountData) => ipcRenderer.invoke('save-account', accountData),
  deleteAccount: (accountId) => ipcRenderer.invoke('delete-account', accountId),
  openAccount: (accountId) => ipcRenderer.invoke('open-account', accountId),
  
  // File operations
  saveExportData: (filename, data) => ipcRenderer.invoke('save-export-data', { filename, data }),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  
  // WebView management
  reloadWebView: (accountId) => ipcRenderer.invoke('reload-webview', accountId),
  getWebViewURL: (accountId) => ipcRenderer.invoke('get-webview-url', accountId),
  
    pathJoin: (...args) => path.join(...args),
  pathBasename: (p) => path.basename(p),
  pathDirname: (p) => path.dirname(p),
  
  // Utility functions
  platform: process.platform,
  versions: process.versions
});

// Security: Disable node integration in renderer
window.addEventListener('DOMContentLoaded', () => {
  console.log('✅ Preload script loaded successfully');
});