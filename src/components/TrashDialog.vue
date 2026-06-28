<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card style="min-width: 420px; max-width: 600px">
      <q-card-section class="row items-center q-gutter-sm">
        <q-icon name="delete" />
        <div class="text-h6">
          Corbeille
        </div>
      </q-card-section>
      <q-card-section class="q-pt-none text-body2 text-grey-7">
        Les offres supprimées n'apparaissent plus dans vos recherches. Restaurez-en
        une, ou videz la corbeille pour les masquer définitivement.
      </q-card-section>

      <q-card-section
        class="q-pt-none"
        style="max-height: 50vh; overflow: auto"
      >
        <div
          v-if="!store.trashOffers.length"
          class="text-grey text-center q-pa-md"
        >
          La corbeille est vide.
        </div>
        <q-list
          v-else
          bordered
          separator
        >
          <q-item
            v-for="o in store.trashOffers"
            :key="o.url + o.title"
          >
            <q-item-section>
              <q-item-label lines="2">
                {{ o.title || 'Offre' }}
              </q-item-label>
              <q-item-label
                v-if="o.desc"
                caption
                lines="1"
              >
                {{ o.desc }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn
                flat
                dense
                size="sm"
                icon="undo"
                label="Restaurer"
                @click="store.restoreFromTrash(o)"
              />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn
          flat
          label="Fermer"
          @click="emit('update:modelValue', false)"
        />
        <q-btn
          color="negative"
          label="Vider la corbeille"
          :disable="!store.trashOffers.length"
          @click="confirmEmpty"
        />
      </q-card-actions>
      <q-card-section class="q-pt-none text-center">
        <q-btn
          flat
          dense
          size="sm"
          color="grey"
          label="Tout réinitialiser (réafficher toutes les offres supprimées)"
          @click="confirmReset"
        />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { useSearchStore } from 'src/stores/search';

defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

const $q = useQuasar();
const store = useSearchStore();

function confirmEmpty(): void {
  $q.dialog({
    title: 'Vider la corbeille ?',
    message:
      'Ces offres resteront masquées de vos recherches, mais disparaîtront de la corbeille.',
    cancel: true,
  }).onOk(() => store.emptyTrash());
}

function confirmReset(): void {
  $q.dialog({
    title: 'Tout réinitialiser ?',
    message:
      'Toutes les offres supprimées (y compris celles déjà retirées de la corbeille) redeviendront visibles.',
    cancel: true,
  }).onOk(() => store.resetAllTrash());
}
</script>
