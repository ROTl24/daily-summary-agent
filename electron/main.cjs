const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("node:path");

let localServer;
let localOrigin = "";

async function startServer() {
  const { createHttpServer } = await import("../src/server/httpServer.mjs");
  localServer = createHttpServer({
    staticDirectory: path.join(__dirname, "..", "dist"),
  });
  await localServer.listen(0);
  localOrigin = `http://127.0.0.1:${localServer.port}`;
}

function createWindow() {
  if (!localOrigin) {
    throw new Error("Local server did not provide a startup URL.");
  }

  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1040,
    minHeight: 720,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.loadURL(localOrigin);
}

function registerIpcHandlers() {
  ipcMain.handle("choose-directory", async (event) => {
    assertTrustedSender(event);

    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });

    return result.canceled ? "" : result.filePaths[0];
  });
}

function assertTrustedSender(event) {
  if (!localOrigin) {
    throw new Error("Local server origin is not ready.");
  }

  const senderUrl = event.senderFrame?.url || event.sender.getURL();
  if (senderUrl !== localOrigin && !senderUrl.startsWith(`${localOrigin}/`)) {
    throw new Error("Blocked choose-directory request from an unexpected origin.");
  }
}

async function startApp() {
  registerIpcHandlers();
  await startServer();
  createWindow();
}

function closeLocalServer() {
  if (!localServer) {
    return;
  }

  const serverToClose = localServer;
  localServer = undefined;
  serverToClose.close().catch(() => {});
}

function showStartupError(error) {
  dialog.showErrorBox("日报工作台启动失败", error.message || String(error));
  app.quit();
}

app.whenReady().then(startApp).catch(showStartupError);

app.on("before-quit", () => {
  closeLocalServer();
});
