import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/services/api'
import type { BringItem } from '@/types'

/** Store for the event bring-along list ("Mitbringliste"). */
export const useBringListStore = defineStore('bringList', () => {
  const items   = ref<BringItem[]>([])
  const loading = ref(false)

  async function fetchItems(eventId: number) {
    loading.value = true
    try {
      const { data } = await api.get<BringItem[]>(`/events/${eventId}/bring-items`)
      items.value = data
    } finally {
      loading.value = false
    }
  }

  async function addItem(eventId: number, description: string) {
    const { data } = await api.post<BringItem>(`/events/${eventId}/bring-items`, { description })
    items.value.push(data)
    return data
  }

  function replaceItem(updated: BringItem) {
    const idx = items.value.findIndex((i) => i.id === updated.id)
    if (idx !== -1) items.value[idx] = updated
  }

  async function claimItem(eventId: number, itemId: number) {
    const { data } = await api.post<BringItem>(`/events/${eventId}/bring-items/${itemId}/claim`)
    replaceItem(data)
    return data
  }

  async function unclaimItem(eventId: number, itemId: number) {
    const { data } = await api.delete<BringItem>(`/events/${eventId}/bring-items/${itemId}/claim`)
    replaceItem(data)
    return data
  }

  async function deleteItem(eventId: number, itemId: number) {
    await api.delete(`/events/${eventId}/bring-items/${itemId}`)
    items.value = items.value.filter((i) => i.id !== itemId)
  }

  return {
    items, loading,
    fetchItems, addItem, claimItem, unclaimItem, deleteItem,
  }
})
