<template>
  <AutoComplete
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    :suggestions="suggestions"
    @complete="search"
    :delay="300"
    :min-length="3"
    :force-selection="false"
    placeholder="Search for an address…"
    class="w-full"
    input-class="w-full"
    :invalid="invalid"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import AutoComplete from 'primevue/autocomplete'

defineProps<{ modelValue: string; invalid?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const suggestions = ref<string[]>([])

// Debounced by AutoComplete's own `delay`; Nominatim is free and needs no API key.
async function search(event: { query: string }) {
  const query = event.query.trim()
  if (!query) {
    suggestions.value = []
    return
  }
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=0`,
      { headers: { 'Accept-Language': 'de,en' } }
    )
    const results = await res.json()
    suggestions.value = results.map((r: { display_name: string }) => r.display_name)
  } catch {
    suggestions.value = []
  }
}
</script>
