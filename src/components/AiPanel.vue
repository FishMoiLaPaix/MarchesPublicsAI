<template>
  <q-card
    v-if="visible"
    flat
    bordered
    class="q-pa-md q-mb-md"
  >
    <div class="row items-center q-gutter-sm q-mb-xs">
      <q-icon
        name="smart_toy"
        color="primary"
      />
      <div class="text-subtitle2">
        Analyse IA
      </div>
      <q-spinner
        v-if="store.aiAnalyzing"
        size="sm"
        color="primary"
      />
    </div>
    <div
      v-if="store.aiNotice"
      class="text-body2"
    >
      {{ store.aiNotice }}
    </div>
    <template v-else-if="store.aiAnalysis">
      <div
        v-if="store.aiAnalysis.summary"
        class="text-body2"
      >
        {{ store.aiAnalysis.summary }}
      </div>
      <div
        v-if="store.aiAnalysis.recommendations"
        class="text-body2 text-grey-7 q-mt-sm"
      >
        💡 {{ store.aiAnalysis.recommendations }}
      </div>
    </template>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useSearchStore } from 'src/stores/search';

const store = useSearchStore();
const visible = computed(
  () => !!store.aiNotice || !!store.aiAnalysis || store.aiAnalyzing,
);
</script>
