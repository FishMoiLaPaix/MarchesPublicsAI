<template>
  <div class="q-pa-md">
    <div class="text-overline text-grey">
      Intelligence Artificielle — persoIA
    </div>

    <div class="row items-center q-gutter-xs q-mt-xs">
      <q-icon
        :name="store.persoiaConnected ? 'check_circle' : 'cancel'"
        :color="store.persoiaConnected ? 'positive' : 'grey'"
        size="sm"
      />
      <span class="text-body2">{{ statusText }}</span>
    </div>

    <q-btn
      v-if="!store.persoiaConnected"
      class="full-width q-mt-sm"
      color="primary"
      icon="login"
      :loading="busy"
      label="Se connecter à persoIA"
      @click="doLogin"
    />
    <q-btn
      v-else
      class="full-width q-mt-sm"
      flat
      color="negative"
      icon="logout"
      label="Se déconnecter"
      @click="doLogout"
    />

    <div class="text-caption text-grey q-mt-sm">
      Connexion unique, partagée avec vos autres outils persoIA. Aucune clé à
      saisir : l'identification se fait dans le navigateur.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import { addon } from 'src/shared/addon';
import { detectPlatform, login, logout } from 'src/shared/persoia/auth';
import { useSearchStore } from 'src/stores/search';

const $q = useQuasar();
const store = useSearchStore();
const busy = ref(false);

const statusText = computed(() =>
  store.persoiaConnected
    ? '✓ Connecté à persoIA' + (store.persoiaTenant ? ' — ' + store.persoiaTenant : '')
    : 'Non connecté.',
);

async function doLogin(): Promise<void> {
  busy.value = true;
  try {
    const key = await login(addon.clientId);
    await store.refreshPersoiaStatus();
    if (!key && !store.persoiaConnected)
      $q.notify({ type: 'negative', message: 'Connexion annulée ou échouée.' });
  } finally {
    busy.value = false;
  }
}

async function doLogout(): Promise<void> {
  await logout();
  await store.refreshPersoiaStatus();
}

onMounted(async () => {
  await store.refreshPersoiaStatus();
  // Premier lancement (desktop) : si aucune config, on déclenche le login navigateur.
  if (detectPlatform() === 'electron' && !store.persoiaConnected) {
    await doLogin();
  }
});
</script>
