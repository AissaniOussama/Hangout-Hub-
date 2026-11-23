<template>
  <!-- Feature 2: Map preview using Leaflet.js + OpenStreetMap (no API key needed) -->
  <div class="isolate">
    <div v-if="loadError" class="text-sm text-gray-400 italic py-2">
      <i class="pi pi-map-marker mr-1" />Map preview unavailable for this location.
    </div>
    <div v-else ref="mapContainer" class="rounded-lg overflow-hidden" style="height: 200px;" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{ location: string }>()
const emit = defineEmits<{ resolvedAddress: [address: string] }>()

const mapContainer = ref<HTMLElement | null>(null)
const loadError = ref(false)

// Leaflet instance kept in a ref so we can destroy it on unmount
let mapInstance: any = null

async function initMap(locationStr: string) {
  if (!mapContainer.value || !locationStr.trim()) {
    loadError.value = true
    return
  }

  try {
    // Geocode via Nominatim (free, no key required)
    const encoded = encodeURIComponent(locationStr)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'de,en' } }
    )
    const results = await res.json()

    if (!results.length) {
      loadError.value = true
      return
    }

    const { lat, lon, display_name } = results[0]
    emit('resolvedAddress', display_name)

    // Dynamically import Leaflet to keep the bundle lean
    const L = (await import('leaflet')).default
    await import('leaflet/dist/leaflet.css')

    // Fix default marker icon paths broken by Vite bundling
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
      iconUrl:       new URL('leaflet/dist/images/marker-icon.png',   import.meta.url).href,
      shadowUrl:     new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
    })

    // Destroy previous map instance if re-initialising
    if (mapInstance) {
      mapInstance.remove()
      mapInstance = null
    }

    mapInstance = L.map(mapContainer.value, { zoomControl: true, scrollWheelZoom: false })
      .setView([parseFloat(lat), parseFloat(lon)], 14)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mapInstance)

    L.marker([parseFloat(lat), parseFloat(lon)])
      .addTo(mapInstance)
      .bindPopup(locationStr)

  } catch {
    // Fallback: show error message instead of crashing
    loadError.value = true
  }
}

onMounted(() => initMap(props.location))

// Re-render if the location prop changes
watch(() => props.location, (newLoc) => {
  loadError.value = false
  initMap(newLoc)
})

onUnmounted(() => {
  if (mapInstance) {
    mapInstance.remove()
    mapInstance = null
  }
})
</script>
