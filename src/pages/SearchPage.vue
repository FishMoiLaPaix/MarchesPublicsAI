<template>
  <q-page>
    <FilterBar @open-trash="trashOpen = true" />

    <RecentChips
      label="Recherches :"
      :items="store.recentSearches"
      @use="store.useRecentSearch($event)"
      @remove="store.removeRecentSearch($event)"
    />
    <RecentChips
      label="Mots-clés :"
      :items="store.recentKeywords"
      @use="store.useRecentKeyword($event)"
      @remove="store.removeRecentKeyword($event)"
    />

    <div class="q-px-md q-pb-xl">
      <!-- Accueil -->
      <div
        v-if="!store.hasSearched && !store.searching"
        class="column items-center q-pa-xl text-center text-grey"
      >
        <div style="font-size: 3rem">
          🏛️
        </div>
        <div class="text-h6">
          Recherche dans les marchés publics
        </div>
        <p class="q-mt-sm">
          Connectez-vous à persoIA, sélectionnez les sources, puis lancez votre
          recherche.
        </p>
      </div>

      <!-- Progression -->
      <div
        v-if="store.searching"
        class="q-mb-md"
      >
        <div class="text-subtitle2 q-mb-sm">
          {{ store.progressTitle || 'Recherche en cours…' }}
        </div>
        <div class="row q-gutter-xs">
          <q-chip
            v-for="s in store.sourceStatuses"
            :key="s.id"
            dense
            :color="badgeColor(s.state)"
            text-color="white"
            :title="s.title"
          >
            <q-spinner
              v-if="s.state === 'loading'"
              size="xs"
              class="q-mr-xs"
            />
            {{ s.label || s.name }}
          </q-chip>
        </div>
      </div>

      <AiPanel />

      <!-- Résultats -->
      <div
        v-if="!store.searching && !store.pageItems.length && store.hasSearched"
        class="text-grey text-center q-pa-xl"
      >
        Aucun résultat ne correspond. Essayez d'autres mots-clés, élargissez la
        période, ou sélectionnez plus de sources.
      </div>

      <div class="column q-gutter-sm">
        <ResultCard
          v-for="r in store.pageItems"
          :key="r._idx"
          :result="r"
        />
      </div>

      <div
        v-if="store.totalPages > 1"
        class="row justify-center q-mt-md"
      >
        <q-pagination
          :model-value="store.currentPage"
          :max="store.totalPages"
          :max-pages="7"
          boundary-numbers
          direction-links
          @update:model-value="store.goToPage($event)"
        />
      </div>

      <div
        v-if="store.remainingFromSources > 0"
        class="column items-center q-mt-md"
      >
        <q-btn
          outline
          color="primary"
          :loading="store.loadingMore"
          label="Charger plus de marchés depuis les sources"
          @click="store.loadMore()"
        />
        <span class="text-caption text-grey q-mt-xs">
          {{ store.remainingFromSources.toLocaleString('fr-FR') }} résultats
          supplémentaires disponibles
        </span>
      </div>
    </div>

    <!-- Barre flottante de suppression -->
    <q-page-sticky
      v-if="store.pending.length"
      position="bottom"
      :offset="[0, 18]"
    >
      <q-card class="row items-center q-gutter-sm q-pa-sm shadow-4">
        <q-btn
          color="negative"
          icon="delete"
          :label="`Valider la suppression (${store.pending.length})`"
          @click="store.confirmDelete()"
        />
        <q-btn
          flat
          label="Annuler"
          @click="store.cancelDelete()"
        />
      </q-card>
    </q-page-sticky>

    <TrashDialog v-model="trashOpen" />
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import FilterBar from 'components/FilterBar.vue';
import RecentChips from 'components/RecentChips.vue';
import AiPanel from 'components/AiPanel.vue';
import ResultCard from 'components/ResultCard.vue';
import TrashDialog from 'components/TrashDialog.vue';
import { useSearchStore } from 'src/stores/search';

const store = useSearchStore();
const trashOpen = ref(false);

function badgeColor(state: 'loading' | 'done' | 'error'): string {
  return state === 'done' ? 'positive' : state === 'error' ? 'negative' : 'grey';
}

onMounted(() => {
  void store.init();
});
</script>
