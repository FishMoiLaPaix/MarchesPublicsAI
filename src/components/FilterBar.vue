<template>
  <div class="q-pa-md q-gutter-y-sm">
    <!-- Ligne recherche précise -->
    <div class="row q-gutter-sm items-center">
      <q-input
        v-model="store.precise"
        class="col"
        dense
        outlined
        clearable
        placeholder="Recherche précise : objet, référence ou mot exact…"
        @keyup.enter="run"
      >
        <template #prepend>
          <q-icon name="search" />
        </template>
      </q-input>
      <q-btn
        color="primary"
        icon="search"
        label="Rechercher"
        :loading="store.searching"
        @click="run"
      />
      <q-btn
        flat
        icon="tune"
        :color="store.filtersOpen ? 'primary' : undefined"
        @click="store.filtersOpen = !store.filtersOpen"
      >
        Filtres
        <q-badge
          v-if="store.filtersCount"
          color="primary"
          floating
        >
          {{ store.filtersCount }}
        </q-badge>
      </q-btn>
    </div>

    <!-- Ligne mots-clés + mode -->
    <div class="row q-gutter-sm items-center">
      <q-input
        v-model="store.kwBar"
        class="col"
        dense
        outlined
        clearable
        placeholder="Mots-clés séparés par des ;"
        @keyup.enter="run"
      >
        <template #prepend>
          <q-icon name="format_list_bulleted" />
        </template>
      </q-input>
      <q-select
        :model-value="store.keywordMode"
        dense
        outlined
        emit-value
        map-options
        style="min-width: 220px"
        :options="modeOptions"
        @update:model-value="store.setKeywordMode($event)"
      />
    </div>

    <!-- Barre de critères (repliable) -->
    <q-slide-transition>
      <div
        v-show="store.filtersOpen"
        class="row q-col-gutter-sm items-center"
      >
        <q-input
          v-model="store.secteur"
          dense
          outlined
          class="col-12 col-sm-4"
          placeholder="🔎 Secteur d'activité"
          @keyup.enter="run"
        />
        <q-input
          v-model="store.lieu"
          dense
          outlined
          class="col-12 col-sm-4"
          placeholder="📍 Lieu d'exécution"
          @keyup.enter="run"
        />
        <q-select
          :model-value="store.facets.typeMarche"
          dense
          outlined
          emit-value
          map-options
          class="col-12 col-sm-4"
          :options="domaineOptions"
          @update:model-value="store.setFacet('typeMarche', $event)"
        />

        <q-input
          v-if="store.facets.typeMarche === 'SERVICES'"
          v-model="store.prestation"
          dense
          outlined
          class="col-12"
          placeholder="🧰 Prestations (ex : nettoyage de locaux ; gardiennage)"
          hint="Une offre est gardée si elle correspond à l'une d'elles (tous les mots du libellé présents)."
        />

        <q-select
          :model-value="store.facets.famille"
          dense
          outlined
          emit-value
          map-options
          class="col-12 col-sm-4"
          :options="familleOptions"
          @update:model-value="store.setFacet('famille', $event)"
        />
        <q-select
          :model-value="store.facets.procedure"
          dense
          outlined
          emit-value
          map-options
          class="col-12 col-sm-4"
          :options="procedureOptions"
          @update:model-value="store.setFacet('procedure', $event)"
        />
        <q-select
          :model-value="store.facets.nature"
          dense
          outlined
          emit-value
          map-options
          class="col-12 col-sm-4"
          :options="natureOptions"
          @update:model-value="store.setFacet('nature', $event)"
        />
        <q-select
          :model-value="store.facets.etat"
          dense
          outlined
          emit-value
          map-options
          class="col-12 col-sm-4"
          :options="etatOptions"
          @update:model-value="store.setFacet('etat', $event)"
        />

        <!-- Dates publication -->
        <q-btn-dropdown
          class="col-auto"
          outline
          icon="event"
          :label="pubLabel"
          :color="store.datePub.from || store.datePub.to ? 'primary' : undefined"
        >
          <div
            class="q-pa-md column q-gutter-sm"
            style="min-width: 240px"
          >
            <q-input
              v-model="store.datePub.from"
              dense
              outlined
              type="date"
              label="Publié à partir du"
            />
            <q-input
              v-model="store.datePub.to"
              dense
              outlined
              type="date"
              label="Jusqu'au"
            />
            <div class="row justify-end q-gutter-sm">
              <q-btn
                flat
                dense
                label="Effacer"
                @click="clearDates('pub')"
              />
              <q-btn
                dense
                color="primary"
                label="Appliquer"
                @click="store.applyDates()"
              />
            </div>
          </div>
        </q-btn-dropdown>

        <!-- Dates clôture -->
        <q-btn-dropdown
          class="col-auto"
          outline
          icon="schedule"
          :label="closeLabel"
          :color="store.dateClose.from || store.dateClose.to ? 'primary' : undefined"
        >
          <div
            class="q-pa-md column q-gutter-sm"
            style="min-width: 240px"
          >
            <q-input
              v-model="store.dateClose.from"
              dense
              outlined
              type="date"
              label="Clôture à partir du"
            />
            <q-input
              v-model="store.dateClose.to"
              dense
              outlined
              type="date"
              label="Jusqu'au"
            />
            <div class="row justify-end q-gutter-sm">
              <q-btn
                flat
                dense
                label="Effacer"
                @click="clearDates('close')"
              />
              <q-btn
                dense
                color="primary"
                label="Appliquer"
                @click="store.applyDates()"
              />
            </div>
          </div>
        </q-btn-dropdown>

        <!-- Popover sources -->
        <q-btn-dropdown
          class="col-auto"
          outline
          icon="library_books"
          :label="`Sources ${store.selected.length}/${store.sources.length}`"
        >
          <div
            class="q-pa-sm"
            style="min-width: 250px"
          >
            <div class="row q-gutter-sm q-mb-sm">
              <q-btn
                flat
                dense
                class="col"
                label="Tout"
                @click="store.selectAllSources()"
              />
              <q-btn
                flat
                dense
                class="col"
                label="Aucune"
                @click="store.deselectAllSources()"
              />
            </div>
            <q-list dense>
              <q-item
                v-for="s in store.sources"
                :key="s.id"
                clickable
                @click="store.toggleSource(s.id)"
              >
                <q-item-section side>
                  <q-checkbox
                    :model-value="store.isSelected(s.id)"
                    dense
                    @update:model-value="store.toggleSource(s.id)"
                    @click.stop
                  />
                </q-item-section>
                <q-item-section>{{ s.country }} {{ s.name }}</q-item-section>
              </q-item>
            </q-list>
          </div>
        </q-btn-dropdown>

        <q-btn
          flat
          dense
          icon="restart_alt"
          label="Réinitialiser"
          @click="store.resetFilters()"
        />
      </div>
    </q-slide-transition>

    <!-- Méta : toggle IA, compteur, non pertinents, corbeille -->
    <div class="row items-center q-gutter-sm">
      <q-toggle
        v-model="store.aiEnabled"
        label="Analyse IA"
      />
      <q-space />
      <span class="text-caption text-grey">{{ store.resultCountText }}</span>
      <q-btn
        v-if="store.irrelevantCount"
        flat
        dense
        size="sm"
        :color="store.showIrrelevant ? 'primary' : undefined"
        :label="
          store.showIrrelevant
            ? `Masquer les ${store.irrelevantCount} non pertinents`
            : `Voir les ${store.irrelevantCount} non pertinents`
        "
        @click="store.toggleShowIrrelevant()"
      />
      <q-btn
        flat
        dense
        icon="delete"
        @click="emit('open-trash')"
      >
        Corbeille
        <q-badge
          v-if="store.trashOffers.length"
          color="red"
          floating
        >
          {{ store.trashOffers.length }}
        </q-badge>
      </q-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useSearchStore } from 'src/stores/search';

const store = useSearchStore();
const emit = defineEmits<{ (e: 'open-trash'): void }>();

function run(): void {
  void store.runSearch();
}

function clearDates(kind: 'pub' | 'close'): void {
  if (kind === 'pub') store.datePub = { from: null, to: null };
  else store.dateClose = { from: null, to: null };
  store.applyDates();
}

const fmt = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
};
const rangeLabel = (r: { from: string | null; to: string | null }, base: string): string => {
  if (r.from && r.to) return `${fmt(r.from)} → ${fmt(r.to)}`;
  if (r.from) return `dès ${fmt(r.from)}`;
  if (r.to) return `jusqu'au ${fmt(r.to)}`;
  return base;
};
const pubLabel = computed(() => rangeLabel(store.datePub, 'Publication'));
const closeLabel = computed(() => rangeLabel(store.dateClose, 'Clôture'));

const modeOptions = [
  { label: 'Souple (max de mots-clés)', value: 'souple' },
  { label: 'Strict (tous les mots-clés)', value: 'strict' },
  { label: 'Large (au moins 1)', value: 'ou' },
];
const domaineOptions = [
  { label: 'Domaine : tous', value: '' },
  { label: 'Services', value: 'SERVICES' },
  { label: 'Fournitures', value: 'FOURNITURES' },
  { label: 'Travaux', value: 'TRAVAUX' },
];
const familleOptions = [
  { label: 'Type de marché : tous', value: '' },
  { label: 'Marchés européens', value: 'Marchés européens' },
  { label: '90 k€ – seuils européens', value: 'Marchés entre 90 k€ et seuils européens' },
  { label: 'MAPA (< 90 k€)', value: 'Marchés <90 k€ (MAPA)' },
  { label: 'Délégation de service public', value: 'Délégation de service public' },
  { label: 'Divers', value: 'Divers' },
];
const procedureOptions = [
  { label: 'Procédure : toutes', value: '' },
  { label: 'Ouverte', value: 'Procédure Ouverte' },
  { label: 'Adaptée (MAPA)', value: 'Procédure Adaptée' },
  { label: 'Négociée', value: 'Procédure Négociée' },
  { label: 'Restreinte', value: 'Procédure Restreinte' },
  { label: 'Dialogue compétitif', value: 'Procédure Dialogue compétitif' },
  { label: 'Concours ouvert', value: 'Procédure Concours ouvert' },
  { label: 'Concours restreint', value: 'Procédure Concours restreint' },
  { label: "Partenariat d'innovation", value: 'Procédure Partenariat innovation' },
];
const natureOptions = [
  { label: "Type d'avis : tous", value: '' },
  { label: 'AAPC (avis de marché)', value: 'APPEL_OFFRE' },
  { label: "Avis d'attribution", value: 'ATTRIBUTION' },
  { label: 'Rectificatif', value: 'RECTIFICATIF' },
  { label: 'Intention de conclure', value: 'INTENTION_CONCLURE' },
  { label: 'Pré-information / périodique', value: 'PRE-INFORMATION' },
  { label: 'Modification', value: 'MODIFICATION' },
  { label: 'Annulation', value: 'ANNULATION' },
];
const etatOptions = [
  { label: 'État : tous', value: '' },
  { label: 'En cours', value: 'en-cours' },
  { label: 'Clôturé', value: 'cloture' },
];
</script>
