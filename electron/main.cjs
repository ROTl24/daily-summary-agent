const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("node:path");
const { spawn } = require("node:child_process");

let serviceProcess;

function startService() {
  serviceProcess = spawn(
    process.execPath,
    [path.join(__dirname, "..", "src", "server", "main.mjs")],
    {
      stdio: "ignore",
      windowsHide: true,
    },
  );
}

function createWindow() {
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

  window.loadURL("http://127.0.0.1:8787");
}

app.whenReady().then(() => {
  startService();
  createWindow();

  ipcMain.handle("choose-directory", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });

    return result.canceled ? "" : result.filePaths[0];
  });
});

app.on("before-quit", () => {
  if (serviceProcess && !serviceProcess.killed) {
    serviceProcess.kill();
  }
});
