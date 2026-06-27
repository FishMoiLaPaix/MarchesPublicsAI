<template>
  <q-card flat bordered class="q-pa-md">
    <div class="text-h6 q-mb-sm">Connexion persoIA</div>

    <div v-if="connected" class="row items-center q-gutter-sm">
      <q-icon name="check_circle" color="positive" size="sm" />
      <span>Connecté ({{ platform }}).</span>
      <q-space />
      <q-btn flat dense color="negative" label="Déconnexion" @click="doLogout" />
    </div>

    <template v-else>
      <!-- Desktop : login navigateur transparent (loopback). -->
      <div v-if="platform === 'electron'">
        <p class="text-body2 text-grey-8">
          Le bouton ouvre votre navigateur sur le portail persoIA. La clé obtenue
          est partagée avec tous les autres outils persoIA de ce poste.
        </p>
        <q-btn
          color="primary"
          icon="login"
          label="Se connecter avec persoIA"
          :loading="busy"
          @click="doLogin"
        />
      </div>

      <!-- Web : pas de loopback possible → saisie manuelle de la clé. -->
      <div v-else>
        <p class="text-body2 text-grey-8">
          En mode web, collez votre clé API persoIA (persoia_sk_…). En desktop
          (Electron), la connexion se fait par le navigateur, sans copier de clé.
        </p>
        <q-input
          v-model="manualKey"
          dense
          outlined
          type="password"
          label="Clé API persoIA"
          class="q-mb-sm"
          @keyup.enter="doLogin"
        />
        <q-btn
          color="primary"
          icon="login"
          label="Utiliser cette clé"
          :loading="busy"
          :disable="!manualKey.trim()"
          @click="doLogin"
        />
      </div>
    </template>
  </q-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import { addon } from 'src/shared/addon';
import {
  detectPlatform,
  isAuthenticated,
  login,
  logout,
} from 'src/shared/persoia/auth';

const emit = defineEmits<{ (e: 'change', connected: boolean): void }>();

const $q = useQuasar();
const platform = detectPlatform();
const connected = ref(false);
const busy = ref(false);
const manualKey = ref('');

async function refresh(): Promise<void> {
  connected.value = await isAuthenticated();
  emit('change', connected.value);
}

async function doLogin(): Promise<void> {
  busy.value = true;
  try {
    const key = await login(addon.clientId, manualKey.value);
    if (!key) {
      $q.notify({ type: 'negative', message: 'Connexion annulée ou échouée.' });
      return;
    }
    manualKey.value = '';
    await refresh();
  } finally {
    busy.value = false;
  }
}

async function doLogout(): Promise<void> {
  await logout();
  await refresh();
}

onMounted(refresh);
</script>
