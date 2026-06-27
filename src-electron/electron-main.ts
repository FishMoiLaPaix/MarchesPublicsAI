import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { loadConfig, saveConfig, logout } from '../src/shared/persoia/config';
import { loginLoopback } from '../src/shared/persoia/login-loopback';
import type { PersoiaConfig } from '../src/shared/persoia/types';

// Sous Linux, process peut être indéfini au tout premier tick.
const platform = process.platform || os.platform();
const currentDir = fileURLToPath(new URL('.', import.meta.url));

let mainWindow: BrowserWindow | undefined;

// --- Pont PersoIA (IPC) ------------------------------------------------------
// Le renderer n'a PAS accès au système de fichiers ni à la création de serveur.
// Toute la logique « token partagé » vit ici, dans le process principal, et est
// exposée au renderer via le preload (window.persoia).
function registerPersoiaIpc(): void {
  ipcMain.handle('persoia:getConfig', (): PersoiaConfig => loadConfig());

  ipcMain.handle('persoia:login', async (_e, client: string) => {
    const cfg = loadConfig();
    const result = await loginLoopback({
      client,
      apiBase: cfg.PERSOIA_API_BASE,
      openUrl: (url) => shell.openExternal(url),
    });
    if (!result) return null;
    // Écriture dans le store PARTAGÉ : tous les autres outils en profitent.
    saveConfig({
      PERSOIA_API_KEY: result.token,
      ...(result.api_base ? { PERSOIA_API_BASE: result.api_base } : {}),
      ...(result.model ? { PERSOIA_MODEL: result.model } : {}),
      ...(result.tenant_name ? { PERSOIA_TENANT_NAME: result.tenant_name } : {}),
    });
    return result.token;
  });

  ipcMain.handle('persoia:logout', () => logout());
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    icon: path.resolve(currentDir, 'icons/icon.png'),
    width: 1000,
    height: 700,
    useContentSize: true,
    webPreferences: {
      contextIsolation: true,
      preload: path.resolve(
        currentDir,
        path.join(
          process.env.QUASAR_ELECTRON_PRELOAD_FOLDER,
          'electron-preload' + process.env.QUASAR_ELECTRON_PRELOAD_EXTENSION,
        ),
      ),
    },
  });

  if (process.env.DEV) {
    await mainWindow.loadURL(process.env.APP_URL);
  } else {
    await mainWindow.loadFile('index.html');
  }

  mainWindow.on('closed', () => {
    mainWindow = undefined;
  });
}

void app.whenReady().then(() => {
  registerPersoiaIpc();
  void createWindow();
});

app.on('window-all-closed', () => {
  if (platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === undefined) void createWindow();
});
