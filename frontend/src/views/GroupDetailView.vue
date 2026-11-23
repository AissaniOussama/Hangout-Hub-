<template>
  <div v-if="store.loading" class="flex justify-center py-12">
    <ProgressSpinner />
  </div>

  <div v-else-if="group" class="flex flex-col gap-6">
    <!-- Header -->
    <div class="flex items-center gap-2">
      <Button icon="pi pi-arrow-left" text label="Back" @click="router.push({ name: 'groups' })" />
    </div>

    <!-- Group info card -->
    <Card>
      <template #title>
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div v-if="renaming" class="flex items-center gap-2 flex-1">
            <InputText v-model="newName" class="flex-1" @keyup.enter="submitRename" @keyup.escape="cancelRename" />
            <Button icon="pi pi-check" severity="success" @click="submitRename" :loading="saving" />
            <Button icon="pi pi-times" severity="secondary" @click="cancelRename" />
          </div>
          <span v-else>{{ group.name }}</span>

          <div class="flex items-center gap-2">
            <Tag :value="group.myRole" :severity="roleSeverity(group.myRole)" />
            <Button
              v-if="canModerate"
              icon="pi pi-pencil"
              text
              size="small"
              title="Rename group"
              @click="startRename"
            />
          </div>
        </div>
      </template>

      <template #content>
        <div class="flex gap-2 flex-wrap">
          <!-- Danger actions -->
          <Button
            v-if="isOwner"
            label="Delete group"
            icon="pi pi-trash"
            severity="danger"
            outlined
            @click="confirmDelete = true"
          />
          <Button
            v-else
            label="Leave group"
            icon="pi pi-sign-out"
            severity="secondary"
            outlined
            @click="confirmLeave = true"
          />
        </div>
      </template>
    </Card>

    <!-- Invite link card (OWNER / ADMIN only) -->
    <Card v-if="canModerate">
      <template #title><i class="pi pi-link mr-2" />Invite link</template>
      <template #content>
        <p class="text-sm text-gray-500 mb-3">
          Share this link with people you want to invite. Anyone with the link can join.
        </p>
        <div class="flex items-center gap-2">
          <InputText :value="inviteLink" readonly class="flex-1 font-mono text-sm" />
          <Button icon="pi pi-copy" label="Copy" severity="secondary" @click="copyToken" />
          <Button icon="pi pi-refresh" label="Regenerate" severity="secondary" outlined @click="doRegenerate" :loading="regenerating" />
        </div>
        <small v-if="copied" class="text-green-600">Copied to clipboard!</small>
      </template>
    </Card>

    <!-- Group events card -->
    <Card>
      <template #title><i class="pi pi-calendar mr-2" />Events</template>
      <template #content>
        <div v-if="eventStore.loading" class="flex justify-center py-6">
          <ProgressSpinner />
        </div>
        <p v-else-if="groupEvents.length === 0" class="text-sm text-gray-500">
          No upcoming events for this group.
        </p>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <EventCard
            v-for="event in groupEvents"
            :key="event.id"
            :event="event"
            @click="router.push({ name: 'event-detail', params: { id: event.id } })"
          />
        </div>
      </template>
    </Card>

    <!-- Members card -->
    <Card>
      <template #title><i class="pi pi-users mr-2" />Members ({{ group.members.length }})</template>
      <template #content>
        <ul class="divide-y">
          <li
            v-for="member in sortedMembers"
            :key="member.userId"
            class="flex items-center justify-between py-3"
          >
            <div class="flex items-center gap-3">
              <i class="pi pi-user text-gray-400" />
              <span class="font-medium">{{ member.username }}</span>
              <span v-if="member.userId === auth.userId" class="text-xs text-gray-400">(you)</span>
            </div>

            <div class="flex items-center gap-2">
              <Tag :value="member.role" :severity="roleSeverity(member.role)" class="text-xs" />

              <!-- Actions (only shown if the current user can act on this member) -->
              <template v-if="member.userId !== auth.userId">
                <!-- Owner can promote MEMBERs to ADMIN -->
                <Button
                  v-if="isOwner && member.role === 'MEMBER'"
                  label="Promote"
                  icon="pi pi-arrow-up"
                  size="small"
                  severity="secondary"
                  outlined
                  @click="doPromote(member.userId)"
                />
                <!-- Owner can demote ADMINs -->
                <Button
                  v-if="isOwner && member.role === 'ADMIN'"
                  label="Demote"
                  icon="pi pi-arrow-down"
                  size="small"
                  severity="secondary"
                  outlined
                  @click="doDemote(member.userId)"
                />
                <!-- Owner/Admin can kick MEMBERs; Owner can also kick ADMINs -->
                <Button
                  v-if="canKick(member)"
                  icon="pi pi-times"
                  size="small"
                  severity="danger"
                  outlined
                  title="Remove from group"
                  @click="doKick(member.userId)"
                />
              </template>
            </div>
          </li>
        </ul>
      </template>
    </Card>

    <!-- Confirm delete dialog -->
    <Dialog v-model:visible="confirmDelete" header="Delete group" :modal="true" class="w-full max-w-sm">
      <p class="mb-4">Are you sure? This will permanently delete <strong>{{ group.name }}</strong> and all its data.</p>
      <div class="flex justify-end gap-2">
        <Button label="Cancel" severity="secondary" @click="confirmDelete = false" />
        <Button label="Delete" severity="danger" :loading="deleting" @click="doDelete" />
      </div>
    </Dialog>

    <!-- Confirm leave dialog -->
    <Dialog v-model:visible="confirmLeave" header="Leave group" :modal="true" class="w-full max-w-sm">
      <p class="mb-4">Are you sure you want to leave <strong>{{ group.name }}</strong>?</p>
      <div class="flex justify-end gap-2">
        <Button label="Cancel" severity="secondary" @click="confirmLeave = false" />
        <Button label="Leave" severity="danger" :loading="leaving" @click="doLeave" />
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import InputText from 'primevue/inputtext'
import Dialog from 'primevue/dialog'
import ProgressSpinner from 'primevue/progressspinner'
import { useGroupStore } from '@/stores/groupStore'
import { useAuthStore } from '@/stores/authStore'
import { useEventStore } from '@/stores/eventStore'
import EventCard from '@/components/event/EventCard.vue'
import type { GroupMemberInfo, GroupRole } from '@/types'

const route = useRoute()
const router = useRouter()
const store = useGroupStore()
const auth = useAuthStore()
const eventStore = useEventStore()

const id = Number(route.params.id)

const group = computed(() => store.groups.find((g) => g.id === id) ?? null)
const isOwner = computed(() => group.value?.myRole === 'OWNER')
const canModerate = computed(() => group.value?.myRole === 'OWNER' || group.value?.myRole === 'ADMIN')

const groupEvents = computed(() =>
  eventStore.events.filter((e) => e.group?.id === id)
)

const roleOrder: Record<GroupRole, number> = { OWNER: 0, ADMIN: 1, MEMBER: 2 }
const sortedMembers = computed(() =>
  [...(group.value?.members ?? [])].sort((a, b) => roleOrder[a.role] - roleOrder[b.role])
)

function canKick(member: GroupMemberInfo) {
  if (!canModerate.value) return false
  if (member.role === 'OWNER') return false
  if (member.role === 'ADMIN' && !isOwner.value) return false
  return true
}

// Rename
const renaming = ref(false)
const newName = ref('')
const saving = ref(false)

function startRename() {
  newName.value = group.value?.name ?? ''
  renaming.value = true
}

function cancelRename() {
  renaming.value = false
}

async function submitRename() {
  if (!newName.value.trim()) return
  saving.value = true
  try {
    await store.renameGroup(id, newName.value.trim())
    renaming.value = false
  } finally {
    saving.value = false
  }
}

// Invite
const copied = ref(false)
const regenerating = ref(false)
const inviteLink = computed(() =>
  group.value?.inviteToken ? `${window.location.origin}/groups/join/${group.value.inviteToken}` : ''
)

function copyToken() {
  if (inviteLink.value) {
    navigator.clipboard.writeText(inviteLink.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  }
}

async function doRegenerate() {
  regenerating.value = true
  try {
    await store.regenerateInvite(id)
  } finally {
    regenerating.value = false
  }
}

// Member actions
async function doPromote(userId: number) {
  await store.promoteMember(id, userId)
}

async function doDemote(userId: number) {
  await store.demoteMember(id, userId)
}

async function doKick(userId: number) {
  await store.kickMember(id, userId)
}

// Delete / Leave
const confirmDelete = ref(false)
const confirmLeave = ref(false)
const deleting = ref(false)
const leaving = ref(false)

async function doDelete() {
  deleting.value = true
  try {
    await store.deleteGroup(id)
    router.push({ name: 'groups' })
  } finally {
    deleting.value = false
    confirmDelete.value = false
  }
}

async function doLeave() {
  leaving.value = true
  try {
    await store.leaveGroup(id)
    router.push({ name: 'groups' })
  } finally {
    leaving.value = false
    confirmLeave.value = false
  }
}

function roleSeverity(role: GroupRole) {
  if (role === 'OWNER') return 'danger'
  if (role === 'ADMIN') return 'warning'
  return 'secondary'
}

onMounted(() => {
  store.fetchGroup(id)
  eventStore.fetchUpcoming()
})
</script>
