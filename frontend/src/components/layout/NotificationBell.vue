<template>
  <div>
    <OverlayBadge v-if="store.unreadCount > 0" :value="String(store.unreadCount)" severity="danger">
      <Button icon="pi pi-bell" text rounded severity="secondary" @click="toggle" aria-label="Notifications" />
    </OverlayBadge>
    <Button v-else icon="pi pi-bell" text rounded severity="secondary" @click="toggle" aria-label="Notifications" />

    <Popover ref="popover">
      <div class="w-80 max-h-96 flex flex-col">
        <div class="flex items-center justify-between px-1 pb-2 mb-1 border-b">
          <span class="text-sm font-medium">Notifications</span>
          <Button
            v-if="store.unreadCount > 0"
            label="Mark all read"
            text
            size="small"
            @click="store.markAllRead()"
          />
        </div>

        <div v-if="store.notifications.length === 0" class="py-6 text-center text-sm text-gray-400">
          No notifications yet.
        </div>

        <ul v-else class="overflow-y-auto flex flex-col divide-y">
          <li
            v-for="n in store.notifications"
            :key="n.id"
            class="py-2 px-1 text-sm cursor-pointer hover:bg-gray-50"
            :class="{ 'font-medium': !n.isRead }"
            @click="open(n)"
          >
            <div>{{ n.message }}</div>
            <div class="text-xs text-gray-400 mt-0.5">{{ formatTime(n.createdAt) }}</div>
          </li>
        </ul>
      </div>
    </Popover>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import type { ToastMessageOptions } from 'primevue/toast'
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import OverlayBadge from 'primevue/overlaybadge'
import { useNotificationStore } from '@/stores/notificationStore'
import type { Notification } from '@/types'

const router = useRouter()
const toast = useToast()
const store = useNotificationStore()
const popover = ref()

const seenIds = new Set<number>()
let pollHandle: ReturnType<typeof setInterval> | undefined

function toggle(event: Event) {
  popover.value?.toggle(event)
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString()
}

async function open(n: Notification) {
  if (!n.isRead) await store.markRead(n.id)
  popover.value?.hide()
  if (n.link) router.push(n.link)
}

async function poll() {
  const before = new Set(store.notifications.map((n) => n.id))
  await store.fetchAll()
  for (const n of store.notifications) {
    if (!n.isRead && !before.has(n.id) && !seenIds.has(n.id)) {
      toast.add({
        severity: 'info',
        summary: 'Notification',
        detail: n.message,
        life: 6000,
        data: { link: n.link, id: n.id },
      } as ToastMessageOptions & { data: { link?: string; id: number } })
    }
    seenIds.add(n.id)
  }
}

onMounted(() => {
  poll()
  pollHandle = setInterval(poll, 20000)
})

onUnmounted(() => {
  if (pollHandle) clearInterval(pollHandle)
})
</script>
