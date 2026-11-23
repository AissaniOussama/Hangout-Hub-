<template>
  <div class="flex flex-col items-center justify-center min-h-[40vh] gap-4">
    <ProgressSpinner v-if="loading" />

    <div v-else-if="error" class="text-center">
      <p class="text-red-600 mb-4">{{ error }}</p>
      <Button label="Go to Events" @click="router.push({ name: 'home' })" />
    </div>

    <Card v-else-if="preview" class="w-full max-w-sm">
      <template #title>You've been invited</template>
      <template #content>
        <p class="mb-6 text-gray-600">
          Do you want to join <strong>{{ preview.title }}</strong>?
        </p>
        <div class="flex justify-end gap-2">
          <Button label="Decline" severity="secondary" @click="router.push({ name: 'home' })" />
          <Button label="Join event" icon="pi pi-check" :loading="joining" @click="doJoin" />
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Card from 'primevue/card'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import { useEventStore } from '@/stores/eventStore'

const route  = useRoute()
const router = useRouter()
const store  = useEventStore()

const loading = ref(true)
const joining = ref(false)
const error   = ref('')
const preview = ref<{ id: number; title: string } | null>(null)

const token = route.params.token as string

onMounted(async () => {
  try {
    preview.value = await store.previewInvite(token)
  } catch {
    error.value = 'This invite link is invalid or has expired.'
  } finally {
    loading.value = false
  }
})

async function doJoin() {
  joining.value = true
  try {
    const event = await store.joinViaToken(token)
    router.replace({ name: 'event-detail', params: { id: event.id } })
  } catch {
    error.value = 'Failed to join the event. The link may have expired.'
  } finally {
    joining.value = false
  }
}
</script>
