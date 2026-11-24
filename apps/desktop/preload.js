// Ponte segura entre a interface web e o app desktop (contextIsolation ativo).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lexDesktop', {
  version: ipcRenderer.sendSync('lex:version'),
  platform: process.platform,
  updateFromFile: () => ipcRenderer.invoke('lex:update-from-file'),
  backupNow: () => ipcRenderer.invoke('lex:backup'),
  restoreBackup: () => ipcRenderer.invoke('lex:restore'),
  openDataFolder: () => ipcRenderer.invoke('lex:open-data'),
  uninstall: () => ipcRenderer.invoke('lex:uninstall'),
});
