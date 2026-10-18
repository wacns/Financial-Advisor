const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("financialAdvisorDesktop", {
  openAuth: (url) => ipcRenderer.invoke("auth:open", url),
  consumeAuthLink: () => ipcRenderer.invoke("auth:consume"),
  onAuthLink: (callback) => {
    const listener = (_event, url) => callback(url);
    ipcRenderer.on("auth:link", listener);
    return () => ipcRenderer.removeListener("auth:link", listener);
  },
  updateStatus: () => ipcRenderer.invoke("updates:status"),
  checkUpdate: () => ipcRenderer.invoke("updates:check"),
  installUpdate: () => ipcRenderer.invoke("updates:install"),
  onUpdate: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("updates:status", listener);
    return () => ipcRenderer.removeListener("updates:status", listener);
  },
});
