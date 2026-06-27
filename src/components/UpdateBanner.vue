<template>
  <q-banner v-if="info?.updateAvailable" dense class="bg-info text-white">
    <template #avatar>
      <q-icon name="system_update" />
    </template>
    Une nouvelle version est disponible ({{ info.latest }}, vous avez
    {{ info.current }}).
    <template #action>
      <q-btn
        flat
        color="white"
        label="Voir la release"
        :href="info.url ?? undefined"
        target="_blank"
      />
    </template>
  </q-banner>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { updateRepo } from 'src/shared/addon';
import { checkForUpdate } from 'src/shared/persoia/updater';
import type { UpdateInfo } from 'src/shared/persoia/types';

const info = ref<UpdateInfo | null>(null);

onMounted(async () => {
  // process.env.APP_VERSION est injecté par Quasar depuis package.json.
  const current = process.env.APP_VERSION ?? '0.0.0';
  info.value = await checkForUpdate({ current, repo: updateRepo });
});
</script>
