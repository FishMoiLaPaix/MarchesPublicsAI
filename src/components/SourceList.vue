<template>
  <div class="q-pa-md">
    <div class="row items-center justify-between">
      <div class="text-overline text-grey">
        Sources
      </div>
      <q-btn
        flat
        dense
        size="sm"
        :label="allSelected ? 'Tout désélectionner' : 'Tout sélectionner'"
        @click="store.toggleSelectAll()"
      />
    </div>

    <q-list dense>
      <q-item
        v-for="s in store.sources"
        :key="s.id"
        clickable
        @click="store.toggleSource(s.id)"
      >
        <q-item-section
          side
          top
        >
          <q-checkbox
            :model-value="store.isSelected(s.id)"
            dense
            @update:model-value="store.toggleSource(s.id)"
          />
        </q-item-section>
        <q-item-section>
          <q-item-label>
            <span class="q-mr-xs">{{ s.country }}</span>{{ s.name }}
          </q-item-label>
          <q-item-label
            caption
            lines="2"
          >
            {{ s.description }}
          </q-item-label>
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useSearchStore } from 'src/stores/search';

const store = useSearchStore();
const allSelected = computed(
  () => store.selected.length === store.sources.length && store.sources.length > 0,
);
</script>
