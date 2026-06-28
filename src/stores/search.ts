// Store central de l'application (Pinia). Reproduit l'état et l'orchestration de
// legacy/index.html (recherche multi-sources, scoring/pipeline, analyse IA,
// filtres, récents, corbeille). La logique métier pure vit dans src/domain ; la
// couche réseau dans le process Electron (window.mp / window.persoia).

import { defineStore } from 'pinia';
import { LocalStorage, Notify } from 'quasar';
import { addon } from '../shared/addon';
import { getConfig } from '../shared/persoia/auth';
import { PersoiaClient, PersoiaError } from '../shared/persoia/client';
import { fromGeoReference, type GeoRef } from '../domain/geo';
import { buildFilters, facetPayload, hasAnyCriterion, offerKey, type Filters } from '../domain/filters';
import { processResults } from '../domain/pipeline';
import { analyzeResults } from '../domain/aiAnalysis';
import type { DateRange } from '../domain/dates';
import type { AiAnalysis, ScoredResult } from '../domain/types';
import type { KeywordMode, MarketResult, SourceMeta } from '../shared/mp/types';

const PAGE_SIZE = 10;
const MAX_AI_ATTEMPTS = 4; // 1 essai + jusqu'à 3 relances (instance GPU ≈ 2 min)
const AI_RETRY_DELAY_MS = 40000;

export interface SourceStatus {
  id: string;
  name: string;
  state: 'loading' | 'done' | 'error';
  label: string;
  title?: string;
}

interface Facets {
  typeMarche: string;
  famille: string;
  procedure: string;
  nature: string;
  etat: string;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

const lsArray = <T>(key: string): T[] => {
  const v = LocalStorage.getItem(key);
  return Array.isArray(v) ? (v as T[]) : [];
};

export const useSearchStore = defineStore('search', {
  state: () => ({
    sources: [] as SourceMeta[],
    selected: [] as string[],
    geo: fromGeoReference(null) as GeoRef,

    // Champs de recherche / filtres.
    precise: '',
    kwBar: '',
    keywordMode: 'souple' as KeywordMode,
    secteur: '',
    lieu: '',
    prestation: '',
    facets: { typeMarche: '', famille: '', procedure: '', nature: '', etat: '' } as Facets,
    datePub: { from: null, to: null } as DateRange,
    dateClose: { from: null, to: null } as DateRange,
    filtersOpen: false,
    aiEnabled: true,

    // Résultats / pagination.
    allResults: [] as MarketResult[],
    aiAnalysis: null as AiAnalysis | null,
    lastFilters: null as Filters | null,
    lastQuery: '',
    lastGroups: [] as string[][],
    lastDepts: [] as string[],
    sourceOffsets: {} as Record<string, number>,
    sourceTotals: {} as Record<string, number>,
    totalAvailable: 0,
    currentPage: 1,
    showIrrelevant: false,
    searchRunId: 0,

    // Statuts d'exécution.
    searching: false,
    loadingMore: false,
    aiAnalyzing: false,
    aiNotice: '',
    progressTitle: '',
    sourceStatuses: [] as SourceStatus[],
    hasSearched: false,

    // Persistance / état utilisateur.
    hiddenOffers: [] as string[],
    readOffers: [] as string[],
    trashOffers: [] as MarketResult[],
    pending: [] as MarketResult[],
    recentSearches: [] as string[],
    recentKeywords: [] as string[],

    // persoIA.
    persoiaConnected: false,
    persoiaTenant: '',
  }),

  getters: {
    processed(state): { relevant: ScoredResult[]; irrelevant: ScoredResult[]; visible: ScoredResult[] } {
      return processResults({
        allResults: state.allResults,
        groups: state.lastGroups,
        queryZones: new Set(state.lastDepts),
        aiAnalysis: state.aiAnalysis,
        hiddenOffers: new Set(state.hiddenOffers),
        datePub: state.datePub,
        dateClose: state.dateClose,
        etat: state.facets.etat,
        typeMarche: state.facets.typeMarche,
        prestationText: state.prestation,
        keywordMode: state.keywordMode,
        showIrrelevant: state.showIrrelevant,
        geo: state.geo,
      });
    },
    totalPages(): number {
      return Math.max(1, Math.ceil(this.processed.visible.length / PAGE_SIZE));
    },
    pageItems(): ScoredResult[] {
      const page = Math.min(this.currentPage, this.totalPages);
      const start = (page - 1) * PAGE_SIZE;
      return this.processed.visible.slice(start, start + PAGE_SIZE);
    },
    relevantCount(): number {
      return this.processed.relevant.length;
    },
    irrelevantCount(): number {
      return this.processed.irrelevant.length;
    },
    resultCountText(state): string {
      const rel = this.relevantCount;
      const fetched = state.allResults.length;
      let txt = `${rel} résultat(s) pertinent(s)`;
      if (state.showIrrelevant && this.irrelevantCount)
        txt += ` + ${this.irrelevantCount} non pertinent(s)`;
      if (fetched > rel) txt += ` · ${fetched} récupéré(s)`;
      return txt;
    },
    remainingFromSources(state): number {
      return Object.entries(state.sourceTotals).reduce(
        (acc, [id, tot]) => acc + Math.max(0, tot - (state.sourceOffsets[id] || 0)),
        0,
      );
    },
    filtersCount(state): number {
      let n = 0;
      if (state.secteur.trim()) n++;
      if (state.lieu.trim()) n++;
      if (state.facets.typeMarche === 'SERVICES' && state.prestation.trim()) n++;
      Object.values(state.facets).forEach((v) => {
        if (v) n++;
      });
      if (state.datePub.from || state.datePub.to) n++;
      if (state.dateClose.from || state.dateClose.to) n++;
      return n;
    },
    pendingKeys(state): Set<string> {
      return new Set(state.pending.map(offerKey));
    },
    readSet(state): Set<string> {
      return new Set(state.readOffers);
    },
  },

  actions: {
    async init(): Promise<void> {
      try {
        this.sources = (await window.mp?.getSources()) || [];
      } catch {
        this.sources = [];
      }
      this.selected = this.sources.map((s) => s.id);
      this.recentSearches = lsArray<string>('recent-searches');
      this.recentKeywords = lsArray<string>('recent-keywords');
      this.hiddenOffers = lsArray<string>('hidden-offers');
      this.trashOffers = lsArray<MarketResult>('trash-offers');
      this.readOffers = lsArray<string>('read-offers');
      this.restoreFilterState();
      void this.loadGeo();
      await this.refreshPersoiaStatus();
    },

    async loadGeo(): Promise<void> {
      try {
        const ref = (await window.mp?.getGeoReference()) || null;
        this.geo = fromGeoReference(ref);
      } catch {
        /* le scoring tolère un référentiel vide */
      }
    },

    currentInputs() {
      return {
        precise: this.precise,
        kwBar: this.kwBar,
        secteur: this.secteur,
        lieu: this.lieu,
        keywordMode: this.keywordMode,
        typeMarche: this.facets.typeMarche,
        famille: this.facets.famille,
        procedure: this.facets.procedure,
        nature: this.facets.nature,
        etat: this.facets.etat,
        pubFrom: this.datePub.from,
        pubTo: this.datePub.to,
        closeFrom: this.dateClose.from,
        closeTo: this.dateClose.to,
      };
    },

    async runSearch(): Promise<void> {
      if (this.selected.length === 0) {
        this.notify('Sélectionnez au moins une source.');
        return;
      }
      if (!this.geo.names.size) await this.loadGeo();
      const filters = buildFilters(this.currentInputs(), this.geo);
      if (!hasAnyCriterion(filters)) {
        this.notify('Renseignez au moins un critère (recherche, secteur, lieu, ou un filtre).');
        return;
      }
      this.saveFilterState();
      if (filters.precise) this.addRecentSearch(filters.precise);
      if (filters.kwBar) this.addRecentKeyword(filters.kwBar);

      this.lastFilters = filters;
      this.lastQuery = filters.text;
      this.lastGroups = filters.groups;
      this.lastDepts = filters.depts;
      this.sourceOffsets = {};
      this.sourceTotals = {};
      this.showIrrelevant = false;
      this.aiAnalysis = null;
      this.aiNotice = '';
      this.hasSearched = true;
      const myRun = ++this.searchRunId;

      this.searching = true;
      this.progressTitle = `Recherche dans ${this.selected.length} source(s)…`;
      this.sourceStatuses = this.selected.map((id) => ({
        id,
        name: this.sources.find((s) => s.id === id)?.name || id,
        state: 'loading',
        label: '',
      }));

      const fp = facetPayload(filters);
      const collected: MarketResult[] = [];
      let totalAvailable = 0;

      await Promise.all(
        this.selected.map(async (sourceId) => {
          const name = this.sources.find((s) => s.id === sourceId)?.name || sourceId;
          const status = this.sourceStatuses.find((s) => s.id === sourceId)!;
          const result = await window.mp!.searchSource({
            sourceId,
            query: filters.scraperText,
            depts: filters.depts,
            facets: fp,
            keywordGroups: filters.keywordGroups,
            keywordMode: filters.keywordMode,
          });
          if (result.error) {
            status.state = 'error';
            status.label = `${name} ✗`;
            status.title = result.error;
          } else if (result.results.length === 0) {
            status.state = 'error';
            status.label = `${name} (0)`;
          } else {
            const cnt = result.results.length;
            const tot = result.total || cnt;
            totalAvailable += tot;
            this.sourceOffsets[sourceId] = cnt;
            this.sourceTotals[sourceId] = tot;
            status.state = 'done';
            status.label =
              tot > cnt ? `${name} (${cnt} / ${tot.toLocaleString('fr-FR')})` : `${name} (${cnt})`;
            result.results.forEach((r) =>
              collected.push({ ...r, sourceId, sourceName: name }),
            );
          }
        }),
      );

      if (myRun !== this.searchRunId) return; // une recherche plus récente a démarré
      this.allResults = collected;
      this.totalAvailable = totalAvailable;
      this.currentPage = 1;
      this.searching = false;
      this.progressTitle = '';

      if (this.aiEnabled && this.allResults.length > 0) {
        await this.runAiAnalysis(filters.text, myRun);
      }
    },

    async loadMore(): Promise<void> {
      this.loadingMore = true;
      const withMore = Object.entries(this.sourceTotals)
        .filter(([id, tot]) => tot > (this.sourceOffsets[id] || 0))
        .map(([id]) => id);
      await Promise.all(
        withMore.map(async (sourceId) => {
          const offset = this.sourceOffsets[sourceId] || 0;
          const name = this.sources.find((s) => s.id === sourceId)?.name || sourceId;
          const result = await window.mp!.searchSource({
            sourceId,
            query: this.lastFilters?.scraperText || this.lastQuery,
            offset,
            depts: this.lastDepts,
            facets: this.lastFilters ? facetPayload(this.lastFilters) : {},
            keywordGroups: this.lastFilters?.keywordGroups || [],
            keywordMode: this.keywordMode,
          });
          if (!result.error && result.results.length > 0) {
            result.results.forEach((r) =>
              this.allResults.push({ ...r, sourceId, sourceName: name }),
            );
            this.sourceOffsets[sourceId] = offset + result.results.length;
          }
        }),
      );
      this.loadingMore = false;
    },

    async runAiAnalysis(query: string, myRun: number): Promise<void> {
      this.aiAnalyzing = true;
      try {
        const cfg = await getConfig();
        if (!cfg.PERSOIA_API_KEY) {
          this.aiNotice = '⚠️ Analyse IA indisponible : non connecté à persoIA.';
          return;
        }
        const client = PersoiaClient.fromConfig(cfg, addon.clientId);
        for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt++) {
          try {
            const analysis = await analyzeResults(client, query, this.allResults);
            if (myRun !== this.searchRunId) return;
            this.aiAnalysis = analysis;
            this.aiNotice = '';
            return;
          } catch (e) {
            if (myRun !== this.searchRunId) return;
            const retryable = e instanceof PersoiaError && e.status === 503;
            if (retryable && attempt < MAX_AI_ATTEMPTS) {
              this.aiNotice = `⏳ Instance IA (GPU) en démarrage (~2 min)… relance automatique ${attempt}/${MAX_AI_ATTEMPTS - 1} dans ${Math.round(AI_RETRY_DELAY_MS / 1000)} s.`;
              await sleep(AI_RETRY_DELAY_MS);
              if (myRun !== this.searchRunId) return;
              continue;
            }
            this.aiNotice = retryable
              ? "⏳ L'instance IA (GPU) met trop de temps à démarrer. Relancez la recherche dans 1–2 min pour obtenir l'analyse."
              : '⚠️ Analyse IA indisponible : ' +
                (e instanceof Error ? e.message : 'erreur inconnue');
            return;
          }
        }
      } finally {
        if (myRun === this.searchRunId) this.aiAnalyzing = false;
      }
    },

    // --- Sources -------------------------------------------------------------
    toggleSource(id: string): void {
      const i = this.selected.indexOf(id);
      if (i === -1) this.selected.push(id);
      else this.selected.splice(i, 1);
    },
    selectAllSources(): void {
      this.selected = this.sources.map((s) => s.id);
    },
    deselectAllSources(): void {
      this.selected = [];
    },
    toggleSelectAll(): void {
      if (this.selected.length === this.sources.length) this.deselectAllSources();
      else this.selectAllSources();
    },
    isSelected(id: string): boolean {
      return this.selected.includes(id);
    },

    // --- Filtres -------------------------------------------------------------
    setFacet(key: keyof Facets, value: string): void {
      this.facets[key] = value;
      this.currentPage = 1;
      if (this.lastFilters) void this.runSearch(); // re-fetch (facette serveur BOAMP)
    },
    setKeywordMode(mode: KeywordMode): void {
      this.keywordMode = mode;
      this.currentPage = 1;
      if (this.lastFilters) void this.runSearch();
    },
    applyDates(): void {
      this.currentPage = 1;
      if (this.lastFilters) void this.runSearch();
    },
    resetFilters(): void {
      this.precise = '';
      this.kwBar = '';
      this.keywordMode = 'souple';
      this.secteur = '';
      this.lieu = '';
      this.prestation = '';
      this.facets = { typeMarche: '', famille: '', procedure: '', nature: '', etat: '' };
      this.datePub = { from: null, to: null };
      this.dateClose = { from: null, to: null };
      this.saveFilterState();
    },

    saveFilterState(): void {
      LocalStorage.set('last-filters', {
        precise: this.precise,
        keywords: this.kwBar,
        mode: this.keywordMode,
        secteur: this.secteur,
        lieu: this.lieu,
        prestation: this.prestation,
        facets: { ...this.facets },
        pub: { ...this.datePub },
        close: { ...this.dateClose },
        sources: [...this.selected],
      });
    },
    restoreFilterState(): void {
      const st = LocalStorage.getItem('last-filters') as Record<string, unknown> | null;
      if (!st) return;
      this.precise = (st.precise as string) || '';
      this.kwBar = (st.keywords as string) || '';
      this.keywordMode = (st.mode as KeywordMode) || 'souple';
      this.secteur = (st.secteur as string) || '';
      this.lieu = (st.lieu as string) || '';
      this.prestation = (st.prestation as string) || '';
      if (st.facets)
        this.facets = { ...this.facets, ...(st.facets as Partial<Facets>) };
      const pub = st.pub as DateRange | undefined;
      const close = st.close as DateRange | undefined;
      this.datePub = { from: pub?.from || null, to: pub?.to || null };
      this.dateClose = { from: close?.from || null, to: close?.to || null };
      const srcs = st.sources as string[] | undefined;
      if (Array.isArray(srcs) && srcs.length)
        this.selected = srcs.filter((id) => this.sources.some((s) => s.id === id));
      const advanced = !!(
        this.secteur ||
        this.lieu ||
        this.prestation ||
        Object.values(this.facets).some(Boolean) ||
        this.datePub.from ||
        this.datePub.to ||
        this.dateClose.from ||
        this.dateClose.to
      );
      if (advanced) this.filtersOpen = true;
    },

    // --- Récents -------------------------------------------------------------
    addRecentSearch(q: string): void {
      if (!q || q.length < 2) return;
      this.recentSearches = [q, ...this.recentSearches.filter((x) => x !== q)].slice(0, 8);
      LocalStorage.set('recent-searches', this.recentSearches);
    },
    removeRecentSearch(q: string): void {
      this.recentSearches = this.recentSearches.filter((x) => x !== q);
      LocalStorage.set('recent-searches', this.recentSearches);
    },
    addRecentKeyword(v: string): void {
      if (!v || v.length < 2) return;
      this.recentKeywords = [v, ...this.recentKeywords.filter((x) => x !== v)].slice(0, 8);
      LocalStorage.set('recent-keywords', this.recentKeywords);
    },
    removeRecentKeyword(v: string): void {
      this.recentKeywords = this.recentKeywords.filter((x) => x !== v);
      LocalStorage.set('recent-keywords', this.recentKeywords);
    },
    useRecentSearch(q: string): void {
      this.precise = q;
      void this.runSearch();
    },
    useRecentKeyword(v: string): void {
      this.kwBar = v;
      void this.runSearch();
    },

    // --- Corbeille / lus -----------------------------------------------------
    togglePending(r: MarketResult): void {
      const key = offerKey(r);
      if (this.pendingKeys.has(key))
        this.pending = this.pending.filter((x) => offerKey(x) !== key);
      else this.pending.push(r);
    },
    isPending(r: MarketResult): boolean {
      return this.pendingKeys.has(offerKey(r));
    },
    isRead(r: MarketResult): boolean {
      return this.readSet.has(offerKey(r));
    },
    toggleRead(r: MarketResult): void {
      const key = offerKey(r);
      if (this.readSet.has(key))
        this.readOffers = this.readOffers.filter((x) => x !== key);
      else this.readOffers = [...this.readOffers, key];
      LocalStorage.set('read-offers', this.readOffers);
    },
    confirmDelete(): void {
      for (const o of this.pending) {
        const key = offerKey(o);
        if (!this.hiddenOffers.includes(key)) this.hiddenOffers.push(key);
        if (!this.trashOffers.some((x) => offerKey(x) === key)) {
          this.trashOffers.unshift({
            title: o.title,
            desc: o.desc,
            url: o.url,
            date: o.date,
            datelimite: o.datelimite,
            procedure: o.procedure,
            sourceName: o.sourceName,
          });
        }
      }
      this.pending = [];
      this.persistTrash();
    },
    cancelDelete(): void {
      this.pending = [];
    },
    restoreFromTrash(o: MarketResult): void {
      const key = offerKey(o);
      this.hiddenOffers = this.hiddenOffers.filter((x) => x !== key);
      this.trashOffers = this.trashOffers.filter((x) => offerKey(x) !== key);
      this.persistTrash();
    },
    emptyTrash(): void {
      this.trashOffers = [];
      this.persistTrash();
    },
    resetAllTrash(): void {
      this.hiddenOffers = [];
      this.trashOffers = [];
      this.persistTrash();
    },
    persistTrash(): void {
      LocalStorage.set('hidden-offers', this.hiddenOffers);
      LocalStorage.set('trash-offers', this.trashOffers);
    },

    // --- Pagination / affichage ---------------------------------------------
    goToPage(p: number): void {
      this.currentPage = Math.min(Math.max(1, p), this.totalPages);
    },
    toggleShowIrrelevant(): void {
      this.showIrrelevant = !this.showIrrelevant;
      this.currentPage = 1;
    },

    // --- persoIA -------------------------------------------------------------
    async refreshPersoiaStatus(): Promise<void> {
      try {
        const cfg = await getConfig();
        this.persoiaConnected = !!cfg.PERSOIA_API_KEY;
        this.persoiaTenant = cfg.PERSOIA_TENANT_NAME || '';
      } catch {
        this.persoiaConnected = false;
      }
    },

    openUrl(url: string): void {
      if (!url) return;
      if (window.mp?.openUrl) void window.mp.openUrl(url);
      else window.open(url, '_blank');
    },

    notify(message: string): void {
      Notify.create({ type: 'warning', message });
    },
  },
});
