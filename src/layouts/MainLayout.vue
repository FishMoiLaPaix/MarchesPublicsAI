<template>
  <q-layout view="lHh Lpr lFf">
    <q-header
      elevated
      class="bg-primary text-white"
    >
      <q-toolbar>
        <q-btn
          flat
          dense
          round
          icon="menu"
          aria-label="Menu"
          @click="drawer = !drawer"
        />
        <q-toolbar-title class="row items-center q-gutter-sm">
          <q-icon name="account_balance" />
          <span>{{ addon.displayName }}</span>
        </q-toolbar-title>
        <q-btn
          flat
          dense
          round
          :icon="$q.dark.isActive ? 'light_mode' : 'dark_mode'"
          :title="$q.dark.isActive ? 'Thème clair' : 'Thème sombre'"
          @click="toggleDark"
        />
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="drawer"
      show-if-above
      bordered
      :width="320"
    >
      <q-scroll-area class="fit">
        <PersoiaSidebar />
        <q-separator />
        <SourceList />
      </q-scroll-area>
    </q-drawer>

    <q-page-container>
      <UpdateBanner />
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useQuasar, LocalStorage } from 'quasar';
import { addon } from 'src/shared/addon';
import PersoiaSidebar from 'components/PersoiaSidebar.vue';
import SourceList from 'components/SourceList.vue';
import UpdateBanner from 'components/UpdateBanner.vue';

const $q = useQuasar();
const drawer = ref(true);

function toggleDark(): void {
  $q.dark.set(!$q.dark.isActive);
  LocalStorage.set('theme', $q.dark.isActive ? 'dark' : 'light');
}

onMounted(() => {
  // Thème sombre par défaut (parité avec l'app actuelle).
  const saved = LocalStorage.getItem('theme') as string | null;
  $q.dark.set(saved ? saved === 'dark' : true);
});
</script>
