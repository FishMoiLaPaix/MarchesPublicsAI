<template>
  <q-page class="q-pa-md column q-gutter-md" style="max-width: 760px; margin: 0 auto">
    <div class="text-h5">{{ addon.displayName }}</div>
    <div class="text-body2 text-grey-8">
      {{ addon.description }}
    </div>

    <!-- Étape 1 : connexion persoIA (auth + token partagé). -->
    <PersoiaLoginCard @change="onAuthChange" />

    <!-- Étape 2 : appel /v1/chat/completions (l'exemple à remplacer par votre outil). -->
    <q-card v-if="connected" flat bordered class="q-pa-md column q-gutter-sm">
      <div class="text-h6">Essai : poser une question</div>
      <q-input
        v-model="prompt"
        type="textarea"
        outlined
        autogrow
        label="Votre message"
        @keyup.ctrl.enter="ask"
      />
      <div class="row items-center q-gutter-sm">
        <q-btn
          color="primary"
          icon="send"
          label="Envoyer"
          :loading="busy"
          :disable="!prompt.trim()"
          @click="ask"
        />
        <span class="text-caption text-grey-7">Ctrl+Entrée pour envoyer</span>
      </div>

      <q-banner v-if="error" dense class="bg-negative text-white">
        {{ error }}
      </q-banner>

      <q-card v-if="answer" flat bordered class="q-pa-md bg-grey-1">
        <div class="text-caption text-grey-7 q-mb-xs">Réponse persoIA</div>
        <div style="white-space: pre-wrap">{{ answer }}</div>
      </q-card>
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { addon } from 'src/shared/addon';
import { getConfig } from 'src/shared/persoia/auth';
import { PersoiaClient, PersoiaError } from 'src/shared/persoia/client';
import PersoiaLoginCard from 'components/PersoiaLoginCard.vue';

const connected = ref(false);
const prompt = ref('Bonjour ! Présente-toi en une phrase.');
const answer = ref('');
const error = ref('');
const busy = ref(false);

function onAuthChange(value: boolean): void {
  connected.value = value;
}

// ⬇️ C'EST ICI que vit la logique métier de votre outil. Remplacez l'appel chat()
// par ce dont votre addon a besoin (ocr(), documents, synthesis…). Tout le reste
// — auth, token partagé, headers, mises à jour — est déjà géré par src/shared.
async function ask(): Promise<void> {
  busy.value = true;
  error.value = '';
  answer.value = '';
  try {
    const cfg = await getConfig();
    const client = PersoiaClient.fromConfig(cfg, addon.clientId);
    answer.value = await client.chat([
      { role: 'user', content: prompt.value },
    ]);
  } catch (e) {
    error.value =
      e instanceof PersoiaError
        ? `Erreur API (${e.status}) : ${e.message}`
        : `Erreur : ${(e as Error).message}`;
  } finally {
    busy.value = false;
  }
}
</script>
