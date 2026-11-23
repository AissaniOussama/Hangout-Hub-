<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-extrabold text-slate-800">Upcoming Events</h1>
        <p class="text-sm text-slate-500 mt-0.5">See what's happening and grab a seat at the table 🎉</p>
      </div>
      <Button v-if="auth.isLoggedIn" label="Create Event" icon="pi pi-plus" rounded @click="showForm = true" />
    </div>

    <div class="flex flex-wrap items-center gap-3 mb-6">
      <IconField class="w-full sm:w-64">
        <InputIcon class="pi pi-search" />
        <InputText v-model="search" placeholder="Search by title..." class="w-full" />
      </IconField>

      <Select
        v-if="groupStore.groups.length > 0"
        v-model="groupId"
        :options="groupOptions"
        optionLabel="label"
        optionValue="value"
        placeholder="All groups"
        showClear
        class="w-full sm:w-48"
      />

      <SelectButton v-model="range" :options="rangeOptions" optionLabel="label" optionValue="value" :allowEmpty="false" />

      <Button
        v-if="hasActiveFilters"
        label="Clear filters"
        icon="pi pi-times"
        text
        size="small"
        @click="clearFilters"
      />
    </div>

    <div v-if="store.loading" class="flex justify-center py-12">
      <ProgressSpinner />
    </div>

    <div v-else-if="store.events.length === 0" class="flex flex-col items-center py-16 text-center">
      <AppLogo class="h-16 w-auto mb-4 opacity-80" />
      <p v-if="hasActiveFilters" class="text-slate-600 font-semibold">No events match your filters.</p>
      <p v-else class="text-slate-600 font-semibold">No upcoming events yet.</p>
      <p v-if="hasActiveFilters" class="text-sm text-slate-400 mt-1">Try adjusting your search or filters.</p>
      <p v-else class="text-sm text-slate-400 mt-1">Be the one who gets everyone together!</p>
      <Button
        v-if="auth.isLoggedIn && !hasActiveFilters"
        label="Create the first event"
        icon="pi pi-plus"
        rounded
        class="mt-4"
        @click="showForm = true"
      />
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <EventCard
        v-for="event in store.events"
        :key="event.id"
        :event="event"
        @click="router.push({ name: 'event-detail', params: { id: event.id } })"
      />
    </div>

    <Paginator
      v-if="store.totalItems > PAGE_SIZE"
      :rows="PAGE_SIZE"
      :totalRecords="store.totalItems"
      :first="currentPage * PAGE_SIZE"
      class="mt-6"
      @page="onPageChange"
    />

    <Dialog v-model:visible="showForm" header="New Event" :modal="true" class="w-full max-w-lg">
      <EventForm @submitted="onCreated" @cancel="showForm = false" />
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import ProgressSpinner from 'primevue/progressspinner'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Paginator, { type PageState } from 'primevue/paginator'
import EventCard from '@/components/event/EventCard.vue'
import EventForm from '@/components/event/EventForm.vue'
import AppLogo from '@/components/layout/AppLogo.vue'
import { useEventStore } from '@/stores/eventStore'
import { useAuthStore } from '@/stores/authStore'
import { useGroupStore } from '@/stores/groupStore'

const router = useRouter()
const store = useEventStore()
const auth = useAuthStore()
const groupStore = useGroupStore()
const showForm = ref(false)

// ── Filters ──────────────────────────────────────────────────────────────
const search = ref('')
const groupId = ref<number | null>(null)
const rangeOptions = [
  { label: 'All upcoming', value: undefined },
  { label: 'This week', value: 'week' },
  { label: 'This month', value: 'month' },
]
const range = ref<'week' | 'month' | undefined>(undefined)

const groupOptions = computed(() =>
  groupStore.groups.map((g) => ({ label: g.name, value: g.id }))
)

const hasActiveFilters = computed(() => !!search.value || groupId.value != null || !!range.value)

// ── Pagination ─────────────────────────────────────────────────────────────
const PAGE_SIZE = 12
const currentPage = ref(0)

function clearFilters() {
  search.value = ''
  groupId.value = null
  range.value = undefined
}

function runFetch() {
  store.fetchUpcoming({
    q: search.value.trim() || undefined,
    groupId: groupId.value ?? undefined,
    range: range.value,
    page: currentPage.value,
    size: PAGE_SIZE,
  })
}

function resetAndFetch() {
  currentPage.value = 0
  runFetch()
}

function onPageChange(event: PageState) {
  currentPage.value = event.page
  runFetch()
}

let debounceHandle: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(debounceHandle)
  debounceHandle = setTimeout(resetAndFetch, 300)
})
watch([groupId, range], resetAndFetch)

onMounted(() => {
  runFetch()
  if (auth.isLoggedIn) groupStore.fetchMyGroups()
})

function onCreated() {
  showForm.value = false
  resetAndFetch()
}
</script>
