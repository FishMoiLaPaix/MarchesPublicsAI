<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated class="bg-primary text-white">
      <q-toolbar>
        <q-toolbar-title>
          {{ addon.displayName }}
        </q-toolbar-title>
        <q-chip
          dense
          square
          color="white"
          text-color="primary"
          :label="platformLabel"
        />
      </q-toolbar>
    </q-header>

    <q-page-container>
      <UpdateBanner />
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { addon } from 'src/shared/addon';
import { detectPlatform } from 'src/shared/persoia/auth';
import UpdateBanner from 'components/UpdateBanner.vue';

const platformLabel = computed(() =>
  detectPlatform() === 'electron' ? 'desktop' : 'web',
);
</script>
