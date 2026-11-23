<template>
  <!-- Mitbringliste trigger card -->
  <Card>
    <template #title><i class="pi pi-shopping-bag mr-2" />Mitbringliste</template>
    <template #content>
      <Button
        label="Liste öffnen"
        icon="pi pi-external-link"
        class="w-full"
        @click="openDialog"
      />
    </template>
  </Card>

  <!-- Mitbringliste dialog -->
  <Dialog v-model:visible="dialogVisible" header="Mitbringliste" :modal="true" class="w-full max-w-lg">
    <div v-if="bringListStore.loading" class="flex justify-center py-8">
      <ProgressSpinner style="width:24px;height:24px" />
    </div>
    <div v-else class="flex flex-col gap-4">
      <!-- Add item (organizer only) -->
      <div v-if="canManage" class="flex items-center gap-2">
        <InputText
          v-model="newItemDescription"
          placeholder="Was wird gebraucht?"
          class="flex-1"
          @keydown.enter="handleAdd"
        />
        <Button label="Hinzufügen" icon="pi pi-plus" :loading="adding" @click="handleAdd" />
      </div>

      <Message v-if="formError" severity="error">{{ formError }}</Message>

      <!-- Banner -->
      <div
        v-if="items.length > 0"
        class="rounded-md px-3 py-2 text-sm font-medium flex items-center gap-2"
        :class="allClaimed ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'"
      >
        <i v-if="allClaimed" class="pi pi-check-circle" />
        <span v-if="allClaimed">Alles abgedeckt!</span>
        <span v-else>{{ claimedCount }} von {{ items.length }} Sachen vergeben</span>
      </div>

      <!-- Empty state -->
      <div v-if="items.length === 0" class="flex flex-col items-center justify-center py-10 text-center text-gray-400">
        <i class="pi pi-shopping-bag text-4xl mb-3" />
        <p>Der Organisator hat noch keine Sachen eingetragen.</p>
      </div>

      <!-- Items -->
      <ul v-else class="flex flex-col divide-y">
        <li v-for="item in items" :key="item.id" class="flex items-center justify-between gap-3 py-3">
          <div class="w-1/3 shrink-0 flex items-center gap-2 text-sm">
            <template v-if="item.claimedBy">
              <i class="pi pi-user text-gray-400" />
              <span>{{ item.claimedBy.username }}</span>
            </template>
            <span v-else class="text-gray-400">Noch offen</span>
          </div>
          <div class="flex-1 text-sm">{{ item.description }}</div>
          <div class="flex items-center gap-1 shrink-0">
            <Button
              v-if="!item.claimedBy"
              label="Ich bring's mit!"
              size="small"
              outlined
              @click="handleClaim(item)"
            />
            <Button
              v-else-if="item.claimedBy.id === auth.userId"
              label="Doch nicht"
              text
              size="small"
              @click="handleUnclaim(item)"
            />
            <Button
              v-if="canManage"
              icon="pi pi-trash"
              text
              severity="danger"
              size="small"
              title="Eintrag löschen"
              @click="handleDelete(item)"
            />
          </div>
        </li>
      </ul>
    </div>

    <div class="flex justify-end mt-4">
      <Button label="Schließen" severity="secondary" @click="dialogVisible = false" />
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import { useBringListStore } from '@/stores/bringListStore'
import { useAuthStore } from '@/stores/authStore'
import type { BringItem } from '@/types'

const props = defineProps<{ eventId: number; canManage: boolean; autoOpen?: boolean }>()
const bringListStore = useBringListStore()
const auth = useAuthStore()

const items = computed(() => bringListStore.items)
const claimedCount = computed(() => items.value.filter((i) => i.claimedBy).length)
const allClaimed = computed(() => items.value.length > 0 && claimedCount.value === items.value.length)

onMounted(() => {
  bringListStore.fetchItems(props.eventId)
  if (props.autoOpen) openDialog()
})
watch(() => props.eventId, (id) => bringListStore.fetchItems(id))

const dialogVisible = ref(false)
const newItemDescription = ref('')
const adding = ref(false)
const formError = ref('')

function openDialog() {
  formError.value = ''
  dialogVisible.value = true
}

async function handleAdd() {
  const description = newItemDescription.value.trim()
  if (!description) return
  formError.value = ''
  adding.value = true
  try {
    await bringListStore.addItem(props.eventId, description)
    newItemDescription.value = ''
  } catch (err: any) {
    formError.value = err.response?.data?.error ?? 'Eintrag konnte nicht hinzugefügt werden.'
  } finally {
    adding.value = false
  }
}

async function handleClaim(item: BringItem) {
  await bringListStore.claimItem(props.eventId, item.id)
}

async function handleUnclaim(item: BringItem) {
  await bringListStore.unclaimItem(props.eventId, item.id)
}

// EDGE CASE: confirm before deleting an item
async function handleDelete(item: BringItem) {
  if (!window.confirm('Bist du sicher, dass du diesen Eintrag wirklich löschen möchtest?')) {
    return
  }
  await bringListStore.deleteItem(props.eventId, item.id)
}
</script>
