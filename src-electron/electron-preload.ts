// Pont sécurisé renderer ↔ main (contextIsolation activé). On n'expose QUE les
// trois opérations PersoIA nécessaires, jamais ipcRenderer brut.

import { contextBridge, ipcRenderer } from 'electron';
import type { PersoiaBridge } from '../src/shared/persoia/types';

const bridge: PersoiaBridge = {
  getConfig: () => ipcRenderer.invoke('persoia:getConfig'),
  login: (client: string) => ipcRenderer.invoke('persoia:login', client),
  logout: () => ipcRenderer.invoke('persoia:logout'),
};

contextBridge.exposeInMainWorld('persoia', bridge);
