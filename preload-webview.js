// preload-webview.js - Simplified version
const { contextBridge, ipcRenderer } = require('electron');

// Expose minimal API to webview
contextBridge.exposeInMainWorld('electronWebViewAPI', {
    // Basic communication
    sendMessage: (channel, data) => ipcRenderer.send(channel, data),
    onMessage: (channel, callback) => ipcRenderer.on(channel, callback),
    
    // WAPI status
    isWAPIReady: () => {
        return typeof window.WAPI !== 'undefined' && window.WAPI.isReady && window.WAPI.isReady();
    }
});

console.log('✅ Preload-webview script loaded');