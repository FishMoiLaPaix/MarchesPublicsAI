// Pont sécurisé renderer ↔ main (contextIsolation activé). On n'expose QUE les
// trois opérations PersoIA nécessaires, jamais ipcRenderer brut.

import { contextBridge, ipcRenderer } from 'electron';
import type { PersoiaBridge } from '../src/shared/persoia/types';
import type { MpBridge, SearchSourceArgs } from '../src/shared/mp/types';

const persoiaBridge: PersoiaBridge = {
  getConfig: () => ipcRenderer.invoke('persoia:getConfig'),
  login: (client: string) => ipcRenderer.invoke('persoia:login', client),
  logout: () => ipcRenderer.invoke('persoia:logout'),
};

// Pont métier MarchésPublics : sources, géo, ouverture de liens externes.
const mpBridge: MpBridge = {
  getSources: () => ipcRenderer.invoke('mp:getSources'),
  searchSource: (args: SearchSourceArgs) =>
    ipcRenderer.invoke('mp:searchSource', args),
  getGeoReference: () => ipcRenderer.invoke('mp:getGeoReference'),
  openUrl: (url: string) => ipcRenderer.invoke('mp:openUrl', url),
};

contextBridge.exposeInMainWorld('persoia', persoiaBridge);
contextBridge.exposeInMainWorld('mp', mpBridge);
