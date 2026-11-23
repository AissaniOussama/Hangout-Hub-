import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/services/api'
import type { Notification } from '@/types'

export const useNotificationStore = defineStore('notifications', () => {
  const notifications = ref<Notification[]>([])
  const loading = ref(false)

  const unreadCount = computed(() => notifications.value.filter((n) => !n.isRead).length)

  async function fetchAll() {
    loading.value = true
    try {
      const { data } = await api.get<Notification[]>('/notifications')
      notifications.value = data
    } finally {
      loading.value = false
    }
  }

  async function markRead(id: number) {
    const notification = notifications.value.find((n) => n.id === id)
    if (notification) notification.isRead = true
    await api.patch(`/notifications/${id}/read`)
  }

  async function markAllRead() {
    notifications.value.forEach((n) => (n.isRead = true))
    await api.patch('/notifications/read-all')
  }

  return {
    notifications, loading, unreadCount,
    fetchAll, markRead, markAllRead,
  }
})
