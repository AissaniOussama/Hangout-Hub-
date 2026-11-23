import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/services/api'
import type { Group } from '@/types'

export const useGroupStore = defineStore('groups', () => {
  const groups = ref<Group[]>([])
  const loading = ref(false)

  async function fetchMyGroups() {
    loading.value = true
    try {
      const { data } = await api.get<Group[]>('/groups')
      groups.value = data
    } finally {
      loading.value = false
    }
  }

  async function fetchGroup(id: number): Promise<Group> {
    const { data } = await api.get<Group>(`/groups/${id}`)
    const idx = groups.value.findIndex((g) => g.id === id)
    if (idx !== -1) groups.value[idx] = data
    else groups.value.push(data)
    return data
  }

  async function createGroup(name: string): Promise<Group> {
    const { data } = await api.post<Group>('/groups', { name })
    groups.value.push(data)
    return data
  }

  async function renameGroup(id: number, name: string): Promise<Group> {
    const { data } = await api.put<Group>(`/groups/${id}`, { name })
    _replace(data)
    return data
  }

  async function deleteGroup(id: number) {
    await api.delete(`/groups/${id}`)
    groups.value = groups.value.filter((g) => g.id !== id)
  }

  async function leaveGroup(id: number) {
    await api.delete(`/groups/${id}/leave`)
    groups.value = groups.value.filter((g) => g.id !== id)
  }

  async function kickMember(groupId: number, userId: number): Promise<Group> {
    const { data } = await api.delete<Group>(`/groups/${groupId}/members/${userId}`)
    _replace(data)
    return data
  }

  async function promoteMember(groupId: number, userId: number): Promise<Group> {
    const { data } = await api.post<Group>(`/groups/${groupId}/members/${userId}/promote`)
    _replace(data)
    return data
  }

  async function demoteMember(groupId: number, userId: number): Promise<Group> {
    const { data } = await api.post<Group>(`/groups/${groupId}/members/${userId}/demote`)
    _replace(data)
    return data
  }

  async function regenerateInvite(groupId: number): Promise<string> {
    const { data } = await api.post<{ inviteToken: string }>(`/groups/${groupId}/invite/regenerate`)
    const group = groups.value.find((g) => g.id === groupId)
    if (group) group.inviteToken = data.inviteToken
    return data.inviteToken
  }

  async function previewInvite(token: string): Promise<{ id: number; name: string }> {
    const { data } = await api.get<{ id: number; name: string }>(`/groups/join/${token}`)
    return data
  }

  async function joinViaToken(token: string): Promise<Group> {
    const { data } = await api.post<Group>(`/groups/join/${token}`)
    const idx = groups.value.findIndex((g) => g.id === data.id)
    if (idx !== -1) groups.value[idx] = data
    else groups.value.push(data)
    return data
  }

  function _replace(updated: Group) {
    const idx = groups.value.findIndex((g) => g.id === updated.id)
    if (idx !== -1) groups.value[idx] = updated
  }

  return {
    groups,
    loading,
    fetchMyGroups,
    fetchGroup,
    createGroup,
    renameGroup,
    deleteGroup,
    leaveGroup,
    kickMember,
    promoteMember,
    demoteMember,
    regenerateInvite,
    previewInvite,
    joinViaToken,
  }
})
