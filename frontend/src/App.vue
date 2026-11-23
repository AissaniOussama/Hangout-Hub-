<template>
  <AppHeader />
  <main class="container mx-auto px-4 py-6">
    <RouterView />
  </main>
  <Toast>
    <template #message="slotProps">
      <div
        class="flex flex-col gap-1"
        :class="{ 'cursor-pointer': slotProps.message.data?.link }"
        @click="handleToastClick(slotProps.message)"
      >
        <div class="font-medium">{{ slotProps.message.summary }}</div>
        <div v-if="slotProps.message.detail" class="text-sm">{{ slotProps.message.detail }}</div>
      </div>
    </template>
  </Toast>
</template>

<script setup lang="ts">
import Toast from 'primevue/toast'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/layout/AppHeader.vue'
import { useNotificationStore } from '@/stores/notificationStore'

const router = useRouter()
const notificationStore = useNotificationStore()

function handleToastClick(message: { data?: { link?: string; id?: number } }) {
  const link = message.data?.link
  if (!link) return
  if (message.data?.id != null) notificationStore.markRead(message.data.id)
  router.push(link)
}
</script>
