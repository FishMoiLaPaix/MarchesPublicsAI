// Client de l'API PersoIA (surface /v1, compatible OpenAI). Basé sur fetch :
// fonctionne aussi bien dans le renderer (navigateur) que dans Node/Electron.
//
// Toujours émettre le header X-Persoia-Client : il identifie l'outil côté backend
// pour le suivi de consommation. La valeur vient de addon.config.json (clientId).

import { CLIENT_HEADER, type PersoiaConfig } from './types';

export interface PersoiaClientOptions {
  apiKey: string;
  baseUrl: string;
  /** Identifiant de l'outil (addon.config.json → clientId). */
  clientId: string;
  /** Modèle par défaut pour les complétions. */
  model?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class PersoiaError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'PersoiaError';
  }
}

export class PersoiaClient {
  private readonly baseUrl: string;

  constructor(private readonly opts: PersoiaClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
  }

  /** Construit la config d'un client à partir de la config partagée. */
  static fromConfig(cfg: PersoiaConfig, clientId: string): PersoiaClient {
    return new PersoiaClient({
      apiKey: cfg.PERSOIA_API_KEY,
      baseUrl: cfg.PERSOIA_API_BASE,
      clientId,
      model: cfg.PERSOIA_MODEL || undefined,
    });
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      Authorization: `Bearer ${this.opts.apiKey}`,
      [CLIENT_HEADER]: this.opts.clientId,
      ...extra,
    };
  }

  private async json<T>(path: string, init: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, init);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new PersoiaError(
        `PersoIA ${path} → ${res.status} ${res.statusText} ${body}`.trim(),
        res.status,
      );
    }
    return (await res.json()) as T;
  }

  /** GET /v1/models — liste des modèles ; sert aussi à valider la clé. */
  models(): Promise<{ data: { id: string }[] }> {
    return this.json('/models', {
      method: 'GET',
      headers: this.headers(),
    });
  }

  /** POST /v1/chat/completions — renvoie le texte de la réponse. */
  async chat(
    messages: ChatMessage[],
    opts?: { model?: string; signal?: AbortSignal },
  ): Promise<string> {
    const data = await this.json<{
      choices?: { message?: { content?: string } }[];
    }>('/chat/completions', {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        model: opts?.model || this.opts.model || 'default',
        messages,
      }),
      signal: opts?.signal,
    });
    return data.choices?.[0]?.message?.content ?? '';
  }

  /** POST /v1/ocr — OCR d'un fichier (image/PDF). Renvoie le texte extrait. */
  async ocr(file: Blob, filename = 'document', model?: string): Promise<string> {
    const form = new FormData();
    form.append('file', file, filename);
    if (model) form.append('model', model);
    const data = await this.json<{ data?: { text?: string } }>('/ocr', {
      method: 'POST',
      headers: this.headers(), // pas de Content-Type : fetch fixe le boundary.
      body: form,
    });
    return data.data?.text ?? '';
  }
}
