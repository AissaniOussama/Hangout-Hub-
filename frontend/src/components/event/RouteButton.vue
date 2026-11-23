<template>
  <a
      v-if="location"
      :href="`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`"
      target="_blank"
      rel="noopener noreferrer"
      @click.stop
      :class="wrapperClass"
  >
    <slot>
      <Button
          :icon="icon"
          :label="label"
          :size="size"
          :outlined="outlined"
          :text="text"
          :severity="severity"
          :class="buttonClass"
      />
    </slot>
  </a>
</template>

<script setup lang="ts">
import Button from 'primevue/button'

withDefaults(defineProps<{
  location?: string
  label?: string
  icon?: string
  size?: 'small' | 'large' | undefined
  outlined?: boolean
  text?: boolean
  severity?: string
  wrapperClass?: string
  buttonClass?: string
}>(), {
  label: 'Route',
  icon: 'pi pi-directions',
  outlined: false,
  text: false,
  severity: 'primary'
})
</script>