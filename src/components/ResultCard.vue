<template>
  <q-card
    flat
    bordered
    class="result-card cursor-pointer"
    :class="{ highlighted, pending: store.isPending(result), read: isRead, irrelevant: result._irrelevant }"
    @click="open"
  >
    <q-card-section class="q-pb-xs">
      <div class="row items-center justify-between no-wrap">
        <div class="text-caption text-primary">
          {{ result.sourceName }}
        </div>
        <div
          v-if="score != null"
          class="text-caption"
          :style="{ color: scoreColor }"
        >
          {{ score }}%
        </div>
      </div>
      <div class="text-subtitle2">
        {{ result.title }}
        <q-badge
          v-if="result._irrelevant"
          outline
          color="grey"
          class="q-ml-xs"
        >
          non pertinent
        </q-badge>
      </div>
      <q-linear-progress
        v-if="score != null"
        :value="score / 100"
        :color="scoreBarColor"
        class="q-mt-xs"
        size="4px"
      />
    </q-card-section>

    <q-card-section
      v-if="result.desc"
      class="q-py-none text-body2 text-grey-8"
    >
      {{ result.desc }}
    </q-card-section>

    <q-card-section
      v-if="result._rel?.reason"
      class="q-py-xs text-caption"
    >
      🤖 {{ result._rel.reason }}
    </q-card-section>

    <q-card-section
      v-if="result._rel?.highlights?.length"
      class="q-py-none q-gutter-xs"
    >
      <q-badge
        v-for="(h, i) in result._rel.highlights"
        :key="i"
        outline
        color="primary"
      >
        {{ h }}
      </q-badge>
    </q-card-section>

    <q-card-actions class="justify-between items-center">
      <span class="text-caption text-grey">
        <span v-if="result.date">📅 {{ result.date }}</span>
        <span v-if="result.datelimite">&nbsp; ⏰ clôture {{ result.datelimite }}</span>
        <span v-if="result.procedure">&nbsp; · {{ result.procedure }}</span>
      </span>
      <div
        class="row items-center q-gutter-xs"
        @click.stop
      >
        <q-checkbox
          :model-value="isRead"
          dense
          size="sm"
          label="Lu"
          @update:model-value="store.toggleRead(result)"
        />
        <q-btn
          flat
          dense
          size="sm"
          :icon="store.isPending(result) ? 'check' : 'delete'"
          :color="store.isPending(result) ? 'positive' : undefined"
          :title="store.isPending(result) ? 'Marquée pour suppression' : 'Supprimer cette offre'"
          @click="store.togglePending(result)"
        />
        <q-btn
          flat
          dense
          size="sm"
          icon="open_in_new"
          label="Ouvrir"
          @click="open"
        />
      </div>
    </q-card-actions>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useSearchStore } from 'src/stores/search';
import type { ScoredResult } from 'src/domain/types';

const props = defineProps<{ result: ScoredResult }>();
const store = useSearchStore();

const score = computed(() => props.result._rel?.score ?? props.result._score);
const highlighted = computed(() => (score.value ?? 0) >= 60);
const isRead = computed(() => store.isRead(props.result));
const scoreColor = computed(() =>
  (score.value ?? 0) >= 80 ? '#00c853' : (score.value ?? 0) >= 60 ? '#2979ff' : '#ff9800',
);
const scoreBarColor = computed(() =>
  (score.value ?? 0) >= 80 ? 'positive' : (score.value ?? 0) >= 60 ? 'primary' : 'orange',
);

function open(): void {
  store.openUrl(props.result.url);
}
</script>

<style scoped>
.result-card.highlighted {
  border-left: 3px solid var(--q-primary);
}
.result-card.read {
  opacity: 0.55;
}
.result-card.pending {
  outline: 2px solid var(--q-negative);
}
.result-card.irrelevant {
  opacity: 0.75;
}
</style>
