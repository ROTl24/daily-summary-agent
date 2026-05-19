const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("dailySummary", {
  chooseDirectory: () => ipcRenderer.invoke("choose-directory"),
});
