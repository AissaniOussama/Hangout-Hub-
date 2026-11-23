<template>
  <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 mb-8 mt-2">
    <!-- HEADER -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 tracking-tight">Calendar</h1>
        <p class="text-sm text-gray-500 mt-1">Plan and manage your upcoming events</p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <!-- Group Filter -->
        <MultiSelect
            v-if="availableGroups.length > 0"
            v-model="selectedGroupIds"
            :options="availableGroups"
            optionLabel="name"
            optionValue="id"
            placeholder="Filter by Group..."
            :maxSelectedLabels="2"
            :showToggleAll="false"
            class="w-full md:w-64"
        />

        <!-- View Toggle -->
        <SelectButton v-model="viewMode" :options="viewOptions" :allowEmpty="false" />
      </div>
    </div>

    <!-- SPINNER -->
    <div v-if="store.loading" class="flex justify-center py-12">
      <ProgressSpinner />
    </div>

    <!-- CALENDAR CONTENT -->
    <div v-else>
      <!-- Navigation Bar -->
      <div class="flex items-center justify-between mb-4 bg-gray-50 p-2 rounded-xl border border-gray-100">
        <Button icon="pi pi-chevron-left" text rounded @click="prev" severity="secondary" />
        <div class="text-center flex flex-col items-center">
          <h2 class="text-lg md:text-xl font-bold text-gray-800">{{ currentLabel }}</h2>
          <span class="text-xs text-primary-600 font-semibold bg-primary-50 px-3 py-0.5 rounded-full mt-1 border border-primary-100">
            {{ displayEventsCount }} Event(s) in dieser Ansicht
          </span>
        </div>
        <Button icon="pi pi-chevron-right" text rounded @click="next" severity="secondary" />
      </div>

      <!-- MONTH VIEW (Grid of Days) -->
      <div v-if="viewMode === 'Month'" class="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-xl overflow-hidden shadow-inner">
        <!-- Day Labels -->
        <div v-for="d in dayLabels" :key="d" class="bg-gray-50 text-center text-[11px] font-bold text-gray-500 py-3 uppercase tracking-wider">
          {{ d }}
        </div>

        <!-- Day Cells -->
        <div v-for="(day, i) in displayDays" :key="i"
             class="bg-white p-2 min-h-[120px] transition-colors duration-200 group/cell relative"
             :class="day ? 'hover:bg-blue-50/30' : 'bg-gray-50/50 opacity-50'"
        >
          <template v-if="day">
            <div class="flex justify-between items-start mb-2">
              <!-- Date Number -->
              <span class="inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold transition-all"
                    :class="[
                      isToday(day) ? 'bg-primary-500 text-white shadow-md scale-110' : 'text-gray-700',
                      eventsOnDay(day).length > 2 ? 'cursor-pointer hover:ring-2 hover:ring-primary-300' : ''
                    ]"
                    @click="eventsOnDay(day).length > 2 && openDayModal(day)">
                 {{ day.getDate() }}
               </span>
            </div>

            <!-- Event List for the Day -->
            <div class="flex flex-col gap-1.5">
              <div v-for="event in eventsOnDay(day).slice(0, 2)" :key="event.id"
                   class="relative group cursor-pointer"
                   @click="router.push({ name: 'event-detail', params: { id: event.id } })"
              >
                <!-- Event Chip -->
                <div class="px-2 py-1.5 rounded-lg text-xs font-medium border truncate transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
                     :class="event.group
                        ? 'bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300'
                        : 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300'"
                >
                  <div class="flex items-center justify-between gap-1">
                    <span class="truncate font-semibold">{{ event.title }}</span>
                    <i v-if="event.location" class="pi pi-map-marker text-[9px] opacity-70 shrink-0"></i>
                  </div>
                  <div class="text-[10px] opacity-80 mt-0.5 font-normal tracking-wide">{{ formatTime(event.startTime) }}</div>
                </div>

                <!-- Hover Tooltip -->
                <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col gap-1.5 bg-gray-900 text-white text-xs rounded-xl p-3 z-50 w-52 shadow-2xl border border-gray-700 before:content-[''] before:absolute before:top-full before:left-1/2 before:-translate-x-1/2 before:border-4 before:border-transparent before:border-t-gray-900 cursor-default" @click.stop>
                  <p class="font-bold text-sm truncate border-b border-gray-700 pb-1 mb-1">{{ event.title }}</p>
                  <div class="flex items-center gap-2 text-gray-300">
                    <i class="pi pi-clock text-[10px] text-gray-400"></i>
                    <span>{{ formatTime(event.startTime) }}</span>
                  </div>
                  <div v-if="event.location" class="flex flex-col gap-1 mt-0.5">
                    <div class="flex items-start gap-2 text-gray-300">
                      <i class="pi pi-map-marker text-[10px] text-gray-400 mt-0.5"></i>
                      <span class="break-words line-clamp-2 leading-tight">{{ event.location }}</span>
                    </div>
                    <RouteButton
                        :location="event.location"
                        wrapperClass="ml-5 inline-flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      <i class="pi pi-directions text-[9px]"></i> Google Maps öffnen
                    </RouteButton>
                  </div>
                  <div v-if="event.group" class="flex items-center gap-2 text-indigo-300 mt-1 bg-indigo-900/30 px-2 py-1 rounded-md border border-indigo-800/50">
                    <i class="pi pi-users text-[10px]"></i>
                    <span class="truncate font-medium">{{ event.group.name }}</span>
                  </div>
                </div>
              </div>

              <!-- Overflow Indicator -->
              <button v-if="eventsOnDay(day).length > 2"
                      class="text-[10px] text-primary-600 font-semibold text-left hover:underline mt-0.5"
                      @click="openDayModal(day)">
                + {{ eventsOnDay(day).length - 2 }} more
              </button>
            </div>
          </template>
        </div>
      </div>

      <!-- YEAR VIEW (Grid of Months) -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div v-for="m in yearlyData" :key="m.index"
             class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-primary-300 hover:-translate-y-1 transition-all duration-200 cursor-pointer group"
             @click="goToMonth(m.index)"
        >
          <div class="flex justify-between items-center mb-3 border-b border-gray-50 pb-2">
            <h3 class="text-lg font-bold text-gray-800 group-hover:text-primary-600 transition-colors">{{ m.name }}</h3>
            <span class="text-[11px] font-bold px-2 py-1 rounded-full"
                  :class="m.events.length > 0 ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'">
              {{ m.events.length }}
            </span>
          </div>
          <div class="flex flex-col gap-1.5">
            <!-- Event Previews -->
            <div v-for="evt in m.events.slice(0, 3)" :key="evt.id" class="text-xs text-gray-600 truncate flex items-center gap-1.5">
              <div class="w-1.5 h-1.5 rounded-full shrink-0" :class="evt.group ? 'bg-indigo-400' : 'bg-emerald-400'"></div>
              <span class="truncate">{{ evt.title }}</span>
            </div>
            <!-- More Indicator -->
            <div v-if="m.events.length > 3" class="text-[10px] text-gray-400 italic mt-1 font-medium">
              + {{ m.events.length - 3 }} weitere...
            </div>
            <!-- Empty State -->
            <div v-if="m.events.length === 0" class="text-xs text-gray-400 italic opacity-70">
              Keine Events
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Day Events Modal -->
    <Dialog v-model:visible="dayModalVisible" :header="dayModalTitle" :modal="true" class="w-full max-w-md">
      <div class="flex flex-col gap-2">
        <div v-for="event in dayModalEvents" :key="event.id"
             class="p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md"
             :class="event.group
                ? 'bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300'
                : 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300'"
             @click="goToEvent(event.id)"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="font-semibold truncate">{{ event.title }}</span>
            <i v-if="event.location" class="pi pi-map-marker text-xs opacity-70 shrink-0"></i>
          </div>
          <div class="text-xs opacity-80 mt-0.5">{{ formatTime(event.startTime) }}</div>
          <div v-if="event.group" class="flex items-center gap-1.5 mt-1.5 text-[11px] text-indigo-500">
            <i class="pi pi-users"></i>
            <span class="truncate">{{ event.group.name }}</span>
          </div>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import ProgressSpinner from 'primevue/progressspinner'
import SelectButton from 'primevue/selectbutton'
import MultiSelect from 'primevue/multiselect'
import { useEventStore } from '@/stores/eventStore'
import RouteButton from '@/components/event/RouteButton.vue'

const router = useRouter()
const store = useEventStore()

const today = new Date()

// --- Views & Navigation ---
const viewOptions = ['Year', 'Month']
const viewMode = ref('Month')

const currentYear = ref(today.getFullYear())
const currentMonth = ref(today.getMonth())

// --- Group Filtering ---
const selectedGroupIds = ref<number[]>([])

const availableGroups = computed(() => {
  const map = new Map()
  store.events.forEach(e => {
    if (e.group) map.set(e.group.id, e.group)
  })
  return Array.from(map.values())
})

const filteredEvents = computed(() => {
  if (selectedGroupIds.value.length === 0) return store.events
  return store.events.filter(e => e.group && selectedGroupIds.value.includes(e.group.id))
})

// --- Math & Labels ---
const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const currentLabel = computed(() => {
  if (viewMode.value === 'Month') {
    return new Date(currentYear.value, currentMonth.value).toLocaleString('de-DE', { month: 'long', year: 'numeric' })
  } else {
    return currentYear.value.toString()
  }
})

// Month View Days
const displayDays = computed(() => {
  const first = new Date(currentYear.value, currentMonth.value, 1)
  const last = new Date(currentYear.value, currentMonth.value + 1, 0)
  const startOffset = (first.getDay() + 6) % 7
  const days: (Date | null)[] = Array(startOffset).fill(null)
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(currentYear.value, currentMonth.value, d))
  }
  return days
})

// Year View Data
const yearlyData = computed(() => {
  const data = []
  for(let m = 0; m < 12; m++) {
    const date = new Date(currentYear.value, m)
    const name = date.toLocaleString('de-DE', { month: 'long' })
    const monthEvents = filteredEvents.value.filter(e => {
      const d = new Date(e.startTime)
      return d.getFullYear() === currentYear.value && d.getMonth() === m
    })
    // Sort by start time for the preview
    monthEvents.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    data.push({ index: m, name, events: monthEvents })
  }
  return data
})

const displayEventsCount = computed(() => {
  if (viewMode.value === 'Month') {
    let count = 0
    displayDays.value.forEach(day => {
      if (day) count += eventsOnDay(day).length
    })
    return count
  } else {
    // Total for the whole year
    return filteredEvents.value.filter(e => new Date(e.startTime).getFullYear() === currentYear.value).length
  }
})

function eventsOnDay(day: Date) {
  return filteredEvents.value.filter((e) => {
    const d = new Date(e.startTime)
    return d.getFullYear() === day.getFullYear() &&
        d.getMonth() === day.getMonth() &&
        d.getDate() === day.getDate()
  })
}

// --- Day Events Modal ---
const dayModalVisible = ref(false)
const selectedDay = ref<Date | null>(null)

const dayModalEvents = computed(() => selectedDay.value ? eventsOnDay(selectedDay.value) : [])

const dayModalTitle = computed(() => {
  return selectedDay.value
      ? selectedDay.value.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
      : ''
})

function openDayModal(day: Date) {
  selectedDay.value = day
  dayModalVisible.value = true
}

function goToEvent(id: number) {
  dayModalVisible.value = false
  router.push({ name: 'event-detail', params: { id } })
}

function isToday(day: Date) {
  return day.toDateString() === today.toDateString()
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

// Interactivity
function goToMonth(monthIndex: number) {
  currentMonth.value = monthIndex
  viewMode.value = 'Month'
}

function prev() {
  if (viewMode.value === 'Month') {
    if (currentMonth.value === 0) { currentMonth.value = 11; currentYear.value-- }
    else currentMonth.value--
  } else {
    currentYear.value--
  }
}

function next() {
  if (viewMode.value === 'Month') {
    if (currentMonth.value === 11) { currentMonth.value = 0; currentYear.value++ }
    else currentMonth.value++
  } else {
    currentYear.value++
  }
}

onMounted(() => store.fetchUpcoming())
</script>