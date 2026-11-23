<template>
  <div class="flex flex-col max-w-2xl mx-auto">
    <div class="flex items-center gap-2 mb-4">
      <Button icon="pi pi-arrow-left" text @click="router.back()" />
      <h1 class="text-xl font-bold">Discussion</h1>
    </div>

    <form @submit.prevent="send" class="flex flex-col gap-2 mb-6">
      <Textarea
        v-model="draft"
        placeholder="Write a post…"
        auto-resize
        rows="3"
        class="w-full"
      />
      <Button type="submit" label="Post" icon="pi pi-send" :disabled="!draft.trim()" class="self-end" />
    </form>

    <div class="flex flex-col gap-3">
      <Card v-for="msg in posts" :key="msg.id" class="shadow-sm">
        <template #content>
          <div class="flex gap-3">
            <Avatar :label="initials(msg.sender.username)" shape="circle" :style="avatarStyle(msg.sender.username)" />
            <div class="flex-1 min-w-0">
              <div class="flex items-baseline gap-2 mb-1">
                <span class="font-semibold">{{ msg.sender.username }}</span>
                <span v-if="msg.sender.id === auth.userId" class="text-xs text-primary-500 font-medium">you</span>
                <span class="text-xs text-gray-400">{{ formatDateTime(msg.sentAt) }}</span>
              </div>
              <p class="text-sm text-gray-800 whitespace-pre-wrap break-words">{{ msg.content }}</p>
            </div>
          </div>
        </template>
      </Card>

      <p v-if="!posts.length" class="text-sm text-gray-400 text-center py-8">No posts yet. Be the first to write something.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import Card from 'primevue/card'
import Avatar from 'primevue/avatar'
import api from '@/services/api'
import { useAuthStore } from '@/stores/authStore'
import type { Message } from '@/types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const messages = ref<Message[]>([])
const draft = ref('')
let ws: WebSocket | null = null

const posts = computed(() =>
  [...messages.value].sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
)

onMounted(async () => {
  const { data } = await api.get<Message[]>(`/events/${route.params.id}/messages`)
  messages.value = data

  ws = new WebSocket(`/ws/chat/${route.params.id}`)
  ws.onmessage = (e) => {
    try {
      const msg: Message = JSON.parse(e.data)
      if (msg.id) {
        messages.value.push(msg)
      }
    } catch {
      // ignore non-JSON control messages
    }
  }
})

onUnmounted(() => ws?.close())

async function send() {
  const content = draft.value.trim()
  if (!content) return
  draft.value = ''
  const { data } = await api.post<Message>(`/events/${route.params.id}/messages`, { content })
  messages.value.push(data)
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
}

function initials(name: string) {
  return name.slice(0, 2).toUpperCase()
}

const avatarColors = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#0ea5e9']

function avatarStyle(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  const color = avatarColors[Math.abs(hash) % avatarColors.length]
  return { backgroundColor: color, color: '#fff' }
}
</script>
