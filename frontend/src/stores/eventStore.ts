import { defineStore } from 'pinia'
import { ref } from 'vue'
import { z } from 'zod'
import api from '@/services/api'
import type { Event, EventRole, ParticipantsResponse, UserSearchResult } from '@/types'

// ── Validation schema (Feature 3 & 4) ─────────────────────────────────────
export const CreateEventSchema = z
  .object({
    title:           z.string().min(1, 'Title is required'),
    description:     z.string().optional(),
    startTime:       z.string().min(1, 'Start time is required'),
    endTime:         z.string().optional(),
    location:        z.string().optional(),
    admissionFee:    z.number().int().nonnegative().optional(),

    // Feature 1: optional group
    groupId:         z.number().int().positive().optional(),

    // Feature 3: participant limits
    // Edge case fix: fields may be left completely empty (null) to mean "no limit"
    minParticipants: z.number().int().nonnegative().nullish(),
    maxParticipants: z.number().int().positive().nullish(),

    // Feature 7 optional: visibility & series
    isPublic:        z.boolean().optional(),
    seriesParentId:  z.number().int().positive().optional(),

    // Bring list ("Mitbringliste") toggle
    hasBringList:    z.boolean().optional(),
  })
  // Feature 4: maxParticipants must be >= minParticipants
  .refine(
    (data) =>
      data.minParticipants == null ||
      data.maxParticipants == null ||
      data.maxParticipants >= data.minParticipants,
    {
      message: 'Max participants must be ≥ min participants',
      path: ['maxParticipants'],
    }
  )

export type CreateEventForm = z.infer<typeof CreateEventSchema>

export interface EventFilters {
  q?: string
  groupId?: number
  range?: 'week' | 'month'
  page?: number
  size?: number
}

interface EventsPage {
  items: Event[]
  totalItems: number
}

// ── Store ──────────────────────────────────────────────────────────────────
export const useEventStore = defineStore('events', () => {
  const events        = ref<Event[]>([])
  const totalItems     = ref(0)
  const currentEvent  = ref<Event | null>(null)
  const loading       = ref(false)

  async function fetchUpcoming(filters?: EventFilters) {
    loading.value = true
    try {
      const { data } = await api.get<EventsPage>('/events', { params: filters })
      events.value = data.items
      totalItems.value = data.totalItems
    } finally {
      loading.value = false
    }
  }

  async function fetchById(id: number) {
    loading.value = true
    try {
      const { data } = await api.get<Event>(`/events/${id}`)
      currentEvent.value = data
    } finally {
      loading.value = false
    }
  }

  async function create(form: CreateEventForm) {
    const { data } = await api.post<Event>('/events', form)
    events.value.unshift(data)
    return data
  }

  async function update(id: number, form: CreateEventForm) {
    const { data } = await api.put<Event>(`/events/${id}`, form)
    const idx = events.value.findIndex((e) => e.id === id)
    if (idx !== -1) events.value[idx] = data
    currentEvent.value = data
    return data
  }

  async function remove(id: number) {
    await api.delete(`/events/${id}`)
    events.value = events.value.filter((e) => e.id !== id)
    if (currentEvent.value?.id === id) currentEvent.value = null
  }

  // ── Participants & roles ───────────────────────────────────────────────────

  async function fetchParticipants(eventId: number): Promise<ParticipantsResponse> {
    const { data } = await api.get<ParticipantsResponse>(`/events/${eventId}/participants`)
    return data
  }

  async function setEventRole(eventId: number, userId: number, role: EventRole): Promise<ParticipantsResponse> {
    const { data } = await api.put<ParticipantsResponse>(`/events/${eventId}/roles/${userId}`, { role })
    return data
  }

  async function removeEventRole(eventId: number, userId: number): Promise<void> {
    await api.delete(`/events/${eventId}/roles/${userId}`)
  }

  async function regenerateEventInvite(eventId: number): Promise<string> {
    const { data } = await api.post<{ inviteToken: string }>(`/events/${eventId}/invite/regenerate`)
    return data.inviteToken
  }

  async function previewInvite(token: string): Promise<{ id: number; title: string }> {
    const { data } = await api.get<{ id: number; title: string }>(`/events/join/${token}`)
    return data
  }

  async function joinViaToken(token: string): Promise<Event> {
    const { data } = await api.post<Event>(`/events/join/${token}`)
    return data
  }

  async function searchUsers(q: string): Promise<UserSearchResult[]> {
    if (q.trim().length < 2) return []
    const { data } = await api.get<UserSearchResult[]>(`/users/search?q=${encodeURIComponent(q)}`)
    return data
  }

  return {
    events, totalItems, currentEvent, loading,
    fetchUpcoming, fetchById, create, update, remove,
    fetchParticipants, setEventRole, removeEventRole,
    regenerateEventInvite, previewInvite, joinViaToken, searchUsers,
  }
})
