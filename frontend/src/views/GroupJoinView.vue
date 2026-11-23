<template>
  <div class="flex flex-col items-center justify-center min-h-[40vh] gap-4">
    <ProgressSpinner v-if="loading" />

    <div v-else-if="error" class="text-center">
      <p class="text-red-600 mb-4">{{ error }}</p>
      <Button label="Go to Groups" @click="router.push({ name: 'groups' })" />
    </div>

    <Card v-else-if="preview" class="w-full max-w-sm">
      <template #title>You've been invited</template>
      <template #content>
        <p class="mb-6 text-gray-600">
          Do you want to join <strong>{{ preview.name }}</strong>?
        </p>
        <div class="flex justify-end gap-2">
          <Button label="Decline" severity="secondary" @click="router.push({ name: 'groups' })" />
          <Button label="Join group" icon="pi pi-check" :loading="joining" @click="doJoin" />
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
import { useGroupStore } from '@/stores/groupStore'

const route  = useRoute()
const router = useRouter()
const store  = useGroupStore()

const loading = ref(true)
const joining = ref(false)
const error   = ref('')
const preview = ref<{ id: number; name: string } | null>(null)

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
    const group = await store.joinViaToken(token)
    router.replace({ name: 'group-detail', params: { id: group.id } })
  } catch {
    error.value = 'Failed to join the group. The link may have expired.'
  } finally {
    joining.value = false
  }
}
</script>
