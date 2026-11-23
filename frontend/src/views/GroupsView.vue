<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">My Groups</h1>
      <div class="flex gap-2">
        <Button label="Join via invite" icon="pi pi-sign-in" severity="secondary" @click="joinDialog = true" />
        <Button label="Create group" icon="pi pi-plus" @click="createDialog = true" />
      </div>
    </div>

    <div v-if="store.loading" class="flex justify-center py-12">
      <ProgressSpinner />
    </div>

    <div v-else-if="store.groups.length === 0" class="text-center py-12 text-gray-500">
      You are not in any groups yet.
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <Card
        v-for="group in store.groups"
        :key="group.id"
        class="cursor-pointer hover:shadow-md transition-shadow"
        @click="router.push({ name: 'group-detail', params: { id: group.id } })"
      >
        <template #title>
          <div class="flex items-center justify-between">
            <span>{{ group.name }}</span>
            <Tag
              :value="group.myRole"
              :severity="roleSeverity(group.myRole)"
              class="text-xs"
            />
          </div>
        </template>
        <template #content>
          <span class="text-sm text-gray-500">
            <i class="pi pi-users mr-1" />{{ group.members.length }} member{{ group.members.length !== 1 ? 's' : '' }}
          </span>
        </template>
      </Card>
    </div>

    <!-- Create group dialog -->
    <Dialog v-model:visible="createDialog" header="Create group" :modal="true" class="w-full max-w-sm">
      <div class="flex flex-col gap-4 pt-2">
        <div>
          <label for="group-name" class="block text-sm font-medium mb-1">Group name *</label>
          <InputText id="group-name" v-model="newName" class="w-full" @keyup.enter="submitCreate" />
          <small v-if="createError" class="text-red-500">{{ createError }}</small>
        </div>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" severity="secondary" @click="createDialog = false" />
          <Button label="Create" :loading="creating" @click="submitCreate" />
        </div>
      </div>
    </Dialog>

    <!-- Join via invite dialog -->
    <Dialog v-model:visible="joinDialog" header="Join group" :modal="true" class="w-full max-w-sm">
      <div class="flex flex-col gap-4 pt-2">
        <div>
          <label for="group-invite-token" class="block text-sm font-medium mb-1">Invite code</label>
          <InputText id="group-invite-token" v-model="inviteToken" class="w-full" placeholder="Paste the invite code here" @keyup.enter="submitJoin" />
          <small v-if="joinError" class="text-red-500">{{ joinError }}</small>
        </div>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" severity="secondary" @click="joinDialog = false" />
          <Button label="Join" :loading="joining" @click="submitJoin" />
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'
import ProgressSpinner from 'primevue/progressspinner'
import { useGroupStore } from '@/stores/groupStore'
import type { GroupRole } from '@/types'

const router = useRouter()
const store = useGroupStore()

const createDialog = ref(false)
const newName = ref('')
const createError = ref('')
const creating = ref(false)

const joinDialog = ref(false)
const inviteToken = ref('')
const joinError = ref('')
const joining = ref(false)

onMounted(() => store.fetchMyGroups())

function roleSeverity(role: GroupRole) {
  if (role === 'OWNER') return 'danger'
  if (role === 'ADMIN') return 'warning'
  return 'secondary'
}

async function submitCreate() {
  createError.value = ''
  if (!newName.value.trim()) {
    createError.value = 'Name is required'
    return
  }
  creating.value = true
  try {
    await store.createGroup(newName.value.trim())
    newName.value = ''
    createDialog.value = false
  } catch {
    createError.value = 'Could not create group'
  } finally {
    creating.value = false
  }
}

async function submitJoin() {
  joinError.value = ''
  if (!inviteToken.value.trim()) {
    joinError.value = 'Invite code is required'
    return
  }
  joining.value = true
  try {
    const group = await store.joinViaToken(inviteToken.value.trim())
    inviteToken.value = ''
    joinDialog.value = false
    router.push({ name: 'group-detail', params: { id: group.id } })
  } catch {
    joinError.value = 'Invalid or expired invite code'
  } finally {
    joining.value = false
  }
}
</script>
