<template>
  <div
    v-if="items.length"
    class="row items-center q-gutter-xs q-px-md q-pb-sm"
  >
    <span class="text-caption text-grey">{{ label }}</span>
    <q-chip
      v-for="q in items"
      :key="q"
      removable
      dense
      clickable
      color="grey-3"
      text-color="dark"
      @click="emit('use', q)"
      @remove="emit('remove', q)"
    >
      {{ q }}
    </q-chip>
  </div>
</template>

<script setup lang="ts">
defineProps<{ label: string; items: string[] }>();
const emit = defineEmits<{
  (e: 'use', value: string): void;
  (e: 'remove', value: string): void;
}>();
</script>
