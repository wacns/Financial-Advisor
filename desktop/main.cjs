const { app, BrowserWindow, protocol, net, ipcMain, shell, session, Menu } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { autoUpdater } = require("electron-updater");
const config = require("./runtime-config.json");
const { authCallback, authTarget, assetPath } = require("./policy.cjs");
protocol.registerSchemesAsPrivileged([{ scheme: "financialadvisor", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
let window, pendingAuth = null;
let status = { state: "unconfigured", version: app.getVersion(), message: "Automatic updates need a configured download feed. Install newer versions from GitHub Releases." };
function sendStatus(next) {
  status = { ...status, ...next };
  window?.webContents.send("updates:status", status);
}
function receiveAuth(value) {
  if (!authCallback(value)) return;
  pendingAuth = value;
  if (window) {
    if (window.isMinimized()) window.restore();
    window.show(); window.focus();
    window.webContents.send("auth:link", value);
  }
}
app.on("open-url", (event, value) => { event.preventDefault(); receiveAuth(value); });
const single = app.requestSingleInstanceLock();
if (!single) app.quit();
else {
  app.on("second-instance", (_event, argv) => {
    argv.filter(authCallback).forEach(receiveAuth);
    window?.show(); window?.focus();
  });
  process.argv.filter(authCallback).forEach(receiveAuth);
  app.whenReady().then(async () => {
    if (app.isPackaged) app.setAsDefaultProtocolClient("com.wacns.financialadvisor");
    const root = path.join(__dirname, "web");
    protocol.handle("financialadvisor", async (request) => {
      try {
        const response = await net.fetch(pathToFileURL(assetPath(request.url, root)).href);
        const headers = new Headers(response.headers);
        headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https: wss:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'");
        return new Response(response.body, { status: response.status, headers });
      }
      catch { return new Response("Not found", { status: 404 }); }
    });
    session.defaultSession.setPermissionRequestHandler((_contents, permission, callback, details) => {
      callback(permission === "media" && details.requestingUrl?.startsWith("financialadvisor://app/"));
    });
    ipcMain.handle("auth:open", async (event, url) => {
      trusted(event);
      if (!authTarget(url, config.supabaseUrl)) throw Error("Invalid sign-in destination");
      await shell.openExternal(url);
    });
    ipcMain.handle("auth:consume", (event) => {
      trusted(event); const value = pendingAuth; pendingAuth = null; return value;
    });
    ipcMain.handle("updates:status", (event) => { trusted(event); return status; });
    ipcMain.handle("updates:check", async (event) => {
      trusted(event);
      if (status.state === "unconfigured" || status.state === "unsupported") return status;
      if (["checking", "downloading", "ready"].includes(status.state)) return status;
      try { await autoUpdater.checkForUpdates(); }
      catch { sendStatus({ state: "error", message: "Could not check for updates. Try again later." }); }
      return status;
    });
    ipcMain.handle("updates:install", (event) => {
      trusted(event);
      if (status.state !== "ready") throw Error("No downloaded update is ready.");
      setImmediate(() => autoUpdater.quitAndInstall(false, true));
    });
    createWindow();
    configureUpdates();
    app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  }).catch(() => { console.error("FinancialAdvisor could not start."); app.quit(); });
}
function trusted(event) {
  if (event.sender !== window?.webContents || event.senderFrame?.url?.split("#")[0] !== "financialadvisor://app/index.html") throw Error("Untrusted window");
}
function createWindow() {
  window = new BrowserWindow({ width: 1280, height: 850, minWidth: 360, minHeight: 600, title: "FinancialAdvisor", icon: path.join(__dirname, "assets/icon.png"), backgroundColor: "#f7f5ec", webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true } });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("financialadvisor://app/index.html")) event.preventDefault();
  });
  window.on("closed", () => { window = null; });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === "darwin" ? [{ role: "appMenu" }] : []),
    { role: "fileMenu" }, { role: "editMenu" },
    { label: "View", submenu: [{ role: "reload" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { role: "togglefullscreen" }] },
  ]));
  window.loadURL("financialadvisor://app/index.html");
}
function configureUpdates() {
  if (!app.isPackaged || !config.updateUrl) return;
  if (process.platform === "linux" && !process.env.APPIMAGE) {
    sendStatus({ state: "unsupported", message: "Install a newer DEB with your package manager, or use AppImage for automatic updates." }); return;
  }
  if (process.platform === "darwin" && !config.macSigned) {
    sendStatus({ state: "unsupported", message: "Automatic macOS updates require a signed app. Install newer versions from Releases." }); return;
  }
  autoUpdater.setFeedURL({ provider: "generic", url: config.updateUrl });
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.on("checking-for-update", () => sendStatus({ state: "checking", message: "Checking for updates…" }));
  autoUpdater.on("update-not-available", () => sendStatus({ state: "current", message: "You have the latest version." }));
  autoUpdater.on("update-available", () => sendStatus({ state: "downloading", message: "Downloading an update. You can keep working." }));
  autoUpdater.on("update-downloaded", () => sendStatus({ state: "ready", message: "Update downloaded. Save your work before restarting." }));
  autoUpdater.on("error", () => sendStatus({ state: "error", message: "Could not download the update. Try again later." }));
  sendStatus({ state: "idle", message: "Updates download automatically. Restart when you are ready to install." });
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  setTimeout(check, 15000).unref();
  setInterval(check, 6 * 60 * 60 * 1000).unref();
}
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
