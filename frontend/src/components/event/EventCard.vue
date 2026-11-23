<template>
  <Card class="event-card cursor-pointer h-full flex flex-col" :style="{ '--accent': accentColor }">
    <template #title>{{ event.title }}</template>
    <template #subtitle>
      <span><i class="pi pi-calendar mr-1" />{{ formatDate(event.startTime) }}</span>
    </template>
    <template #content>
      <p v-if="event.description" class="text-sm text-gray-600 line-clamp-2">
        {{ event.description }}
      </p>
      <div class="flex flex-wrap gap-2 mt-3 text-xs text-gray-500">
        <span v-if="event.location" class="flex items-center gap-1">
          <i class="pi pi-map-marker" /> {{ event.location }}
        </span>
        <span v-if="event.admissionFee"><i class="pi pi-euro mr-1" />{{ event.admissionFee }} €</span>
        <span><i class="pi pi-user mr-1" />{{ event.organizer.username }}</span>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end mt-auto pt-2" v-if="event.location">
        <RouteButton :location="event.location" size="small" outlined severity="secondary" />
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Card from 'primevue/card'
import RouteButton from '@/components/event/RouteButton.vue'
import type { Event } from '@/types'

const props = defineProps<{ event: Event }>()

// Rotate through the four brand colors so the event grid feels like the logo
const BRAND_ACCENTS = [
  'var(--color-brand-red)',
  'var(--color-brand-yellow)',
  'var(--color-brand-green)',
  'var(--color-brand-blue)',
]
const accentColor = computed(() => BRAND_ACCENTS[props.event.id % BRAND_ACCENTS.length])

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
}
</script>
