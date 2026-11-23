import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/services/api'
import type { Poll, CreatePollRequest } from '@/types'

export const usePollStore = defineStore('polls', () => {
  const polls   = ref<Poll[]>([])
  const loading = ref(false)

  async function fetchPolls(eventId: number) {
    loading.value = true
    try {
      const { data } = await api.get<Poll[]>(`/events/${eventId}/polls`)
      polls.value = data
    } finally {
      loading.value = false
    }
  }

  async function createPoll(eventId: number, req: CreatePollRequest) {
    const { data } = await api.post<Poll>(`/events/${eventId}/polls`, req)
    polls.value.unshift(data)
    return data
  }

  function replacePoll(updated: Poll) {
    const idx = polls.value.findIndex((p) => p.id === updated.id)
    if (idx !== -1) polls.value[idx] = updated
  }

  async function vote(eventId: number, pollId: number, optionId: number) {
    const { data } = await api.post<Poll>(
      `/events/${eventId}/polls/${pollId}/options/${optionId}/vote`
    )
    replacePoll(data)
    return data
  }

  async function retractVote(eventId: number, pollId: number, optionId: number) {
    const { data } = await api.delete<Poll>(
      `/events/${eventId}/polls/${pollId}/options/${optionId}/vote`
    )
    replacePoll(data)
    return data
  }

  async function closePoll(eventId: number, pollId: number) {
    const { data } = await api.post<Poll>(`/events/${eventId}/polls/${pollId}/close`)
    replacePoll(data)
    return data
  }

  async function deletePoll(eventId: number, pollId: number) {
    await api.delete(`/events/${eventId}/polls/${pollId}`)
    polls.value = polls.value.filter((p) => p.id !== pollId)
  }

  return {
    polls, loading,
    fetchPolls, createPoll, vote, retractVote, closePoll, deletePoll,
  }
})
