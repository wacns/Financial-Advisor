import electron = require("electron");
import type { DesktopBridge, UpdateStatus } from "../../src/platform/desktop-bridge.js";
const { contextBridge, ipcRenderer } = electron;
const bridge: DesktopBridge = {
  openAuth: (url) => ipcRenderer.invoke("auth:open", url),
  consumeAuthLink: () => ipcRenderer.invoke("auth:consume"),
  onAuthLink: (callback) => {
    const listener = (_event: electron.IpcRendererEvent, url: string) => callback(url);
    ipcRenderer.on("auth:link", listener);
    return () => ipcRenderer.removeListener("auth:link", listener);
  },
  updateStatus: () => ipcRenderer.invoke("updates:status"),
  checkUpdate: () => ipcRenderer.invoke("updates:check"),
  installUpdate: () => ipcRenderer.invoke("updates:install"),
  onUpdate: (callback) => {
    const listener = (_event: electron.IpcRendererEvent, status: UpdateStatus) => callback(status);
    ipcRenderer.on("updates:status", listener);
    return () => ipcRenderer.removeListener("updates:status", listener);
  },
};
contextBridge.exposeInMainWorld("financialAdvisorDesktop", bridge);
