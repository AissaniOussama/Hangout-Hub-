<template>
  <div v-if="store.loading" class="flex justify-center py-12">
    <ProgressSpinner />
  </div>
  <div v-else-if="!event" class="py-12 text-center text-gray-500">
    Event not found or you don't have access to it.
  </div>
  <div v-else class="flex flex-col gap-6">
    <div class="mb-6 flex items-center gap-2">
      <Button icon="pi pi-arrow-left" text label="Back" @click="router.back()" />
      <Button
          v-if="canEdit"
          icon="pi pi-pencil"
          label="Edit"
          severity="secondary"
          @click="editMode = true"
      />
      <Button
        v-if="canDelete"
        icon="pi pi-trash"
        label="Delete"
        severity="danger"
        outlined
        @click="confirmDelete = true"
      />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Left column -->
      <div class="lg:col-span-2 flex flex-col gap-4">

        <!-- Event details card -->
        <Card>
          <template #title>
            {{ event.title }}
            <Tag v-if="!event.isPublic" value="Private" severity="warning" class="ml-2 text-xs" />
            <Tag v-if="event.group" :value="event.group.name" severity="info" class="ml-2 text-xs" />
            <Tag v-if="myEventRole" :value="myEventRole" :severity="roleSeverity(myEventRole)" class="ml-2 text-xs" />
          </template>
          <template #content>
            <p v-if="event.description" class="text-gray-600 mb-4">{{ event.description }}</p>
            <div class="flex flex-col gap-2 text-sm">
              <span><i class="pi pi-calendar mr-2" />{{ formatDate(event.startTime) }}</span>
              <span v-if="event.location"><i class="pi pi-map-marker mr-2" />{{ event.location }}</span>
              <span v-if="event.admissionFee"><i class="pi pi-euro mr-2" />{{ event.admissionFee }} €</span>
              <span><i class="pi pi-user mr-2" />Organized by {{ event.organizer.username }}</span>
              <span v-if="event.minParticipants != null || event.maxParticipants != null">
                <i class="pi pi-users mr-2" />Participants:
                <template v-if="event.minParticipants != null">min {{ event.minParticipants }}</template>
                <template v-if="event.minParticipants != null && event.maxParticipants != null"> / </template>
                <template v-if="event.maxParticipants != null">max {{ event.maxParticipants }}</template>
              </span>

              <span v-if="event.seriesParent">
                <i class="pi pi-list mr-2" />Part of series:
                <router-link :to="{ name: 'event-detail', params: { id: event.seriesParent.id } }" class="underline text-primary-600">
                  {{ event.seriesParent.title }}
                </router-link>
              </span>
            </div>
            <div class="mt-4">
              <a :href="icsDownloadUrl" download>
                <Button icon="pi pi-calendar-plus" label="Add to Calendar (.ics)" severity="secondary" size="small" />
              </a>
            </div>
          </template>
        </Card>

        <!-- Feature 2: Map preview -->
        <Card v-if="event.location">
          <template #title>
            <div class="flex items-center justify-between">
              <span><i class="pi pi-map mr-2" />Location</span>
              <RouteButton :location="event.location" outlined size="small" label="Route planen" />
            </div>
          </template>
          <template #content>
            <LeafletMap :location="event.location" @resolved-address="resolvedLocation = $event" />
          </template>
        </Card>

        <!-- RSVP -->
        <Card>
          <template #title>RSVP</template>
          <template #content>
            <div v-if="auth.isLoggedIn" class="flex gap-2">
              <Button label="Attending"  icon="pi pi-check"    @click="submitRsvp('ATTENDING')"     :severity="rsvpStatus === 'ATTENDING'     ? 'success' : 'secondary'" />
              <Button label="Maybe"      icon="pi pi-question" @click="submitRsvp('MAYBE')"         :severity="rsvpStatus === 'MAYBE'         ? 'warning' : 'secondary'" />
              <Button label="Declining"  icon="pi pi-times"    @click="submitRsvp('NOT_ATTENDING')" :severity="rsvpStatus === 'NOT_ATTENDING' ? 'danger'  : 'secondary'" />
            </div>
            <p v-else class="text-sm text-gray-500">
              <router-link :to="{ name: 'login' }" class="underline text-primary-600">Log in</router-link> to RSVP.
            </p>
          </template>
        </Card>

        <!-- Participants -->
        <Card>
          <template #title>
            <i class="pi pi-users mr-2" />Participants
            <span class="text-sm font-normal text-gray-500 ml-2">
              {{ participantsData.attending }} attending · {{ participantsData.maybe }} maybe
            </span>
          </template>
          <template #content>
            <div v-if="participantsLoading" class="flex justify-center py-4">
              <ProgressSpinner style="width:24px;height:24px" />
            </div>
            <p v-else-if="participantsData.participants.length === 0" class="text-sm text-gray-500">
              No participants yet.
            </p>
            <ul v-else class="divide-y">
              <li v-for="p in participantsData.participants" :key="p.userId"
                  class="flex items-center justify-between py-3">
                <div class="flex items-center gap-2 text-sm">
                  <i class="pi pi-user text-gray-400" />
                  <span class="font-medium">{{ p.username }}</span>
                  <span v-if="p.userId === auth.userId" class="text-xs text-gray-400">(you)</span>
                  <Tag v-if="p.eventRole" :value="p.eventRole" :severity="roleSeverity(p.eventRole)" class="text-xs" />
                </div>
                <div class="flex items-center gap-2">
                  <Tag v-if="p.rsvpStatus" :value="rsvpLabel(p.rsvpStatus)" :severity="rsvpSeverity(p.rsvpStatus)" class="text-xs" />
                  <span v-else class="text-xs text-gray-400">no response</span>
                  <template v-if="myEventRole === 'OWNER' && p.userId !== auth.userId && p.eventRole !== 'OWNER'">
                    <Button
                      v-if="p.eventRole === 'VIEWER'"
                      label="Make Editor"
                      icon="pi pi-arrow-up"
                      size="small"
                      severity="secondary"
                      outlined
                      @click="doSetRole(p.userId, 'EDITOR')"
                    />
                    <Button
                      v-if="p.eventRole === 'EDITOR'"
                      label="Make Viewer"
                      icon="pi pi-arrow-down"
                      size="small"
                      severity="secondary"
                      outlined
                      @click="doSetRole(p.userId, 'VIEWER')"
                    />
                    <Button
                      icon="pi pi-times"
                      size="small"
                      severity="danger"
                      outlined
                      title="Remove from event"
                      @click="doRemoveRole(p.userId)"
                    />
                  </template>
                </div>
              </li>
            </ul>
          </template>
        </Card>

        <!-- Polls -->
        <EventPolls v-if="auth.isLoggedIn" :event-id="eventId" :can-manage="canEdit" />

        <!-- Invite link (OWNER only) -->
        <Card v-if="myEventRole === 'OWNER'">
          <template #title><i class="pi pi-link mr-2" />Invite Link</template>
          <template #content>
            <p class="text-sm text-gray-500 mb-3">
              Share this link to give people viewer access to this event.
            </p>
            <div v-if="inviteToken" class="flex items-center gap-2 mb-3">
              <InputText :value="inviteLink" readonly class="flex-1 font-mono text-sm" />
              <Button icon="pi pi-copy" label="Copy" severity="secondary" @click="copyInviteLink" />
            </div>
            <Button :label="inviteToken ? 'Regenerate' : 'Generate invite link'"
                    :icon="inviteToken ? 'pi pi-refresh' : 'pi pi-plus'"
                    severity="secondary" outlined
                    @click="doRegenerateInvite" :loading="regeneratingInvite" />
            <small v-if="copiedInvite" class="block mt-1 text-green-600">Copied to clipboard!</small>
          </template>
        </Card>
      </div>

      <!-- Right column -->
      <div class="flex flex-col gap-4">
        <Card>
          <template #title><i class="pi pi-comments mr-2" />Chat</template>
          <template #content>
            <Button
                label="Open Chat"
                icon="pi pi-external-link"
                @click="router.push({ name: 'event-chat', params: { id: event.id } })"
                class="w-full"
            />
          </template>
        </Card>

        <!-- Mitbringliste -->
        <EventBringList
          v-if="event.hasBringList && auth.isLoggedIn"
          :event-id="eventId"
          :can-manage="isOrganizer"
          :auto-open="route.query.openBringList === '1'"
        />
      </div>
    </div>

    <!-- Confirm delete dialog -->
    <Dialog v-model:visible="confirmDelete" header="Delete event" :modal="true" class="w-full max-w-sm">
      <p class="mb-4">Are you sure you want to permanently delete <strong>{{ event.title }}</strong>?</p>
      <div class="flex justify-end gap-2">
        <Button label="Cancel" severity="secondary" @click="confirmDelete = false" />
        <Button label="Delete" severity="danger" :loading="deleting" @click="doDelete" />
      </div>
    </Dialog>

    <!-- Edit event dialog -->
    <Dialog v-model:visible="editMode" header="Edit Event" :modal="true" class="w-full max-w-lg">
      <EventForm :event="event" @submitted="onEdited" @cancel="editMode = false" />
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed, ref, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import ProgressSpinner from 'primevue/progressspinner'
import { useEventStore } from '@/stores/eventStore'
import { useAuthStore } from '@/stores/authStore'
import api from '@/services/api'
import LeafletMap from '@/components/event/LeafletMap.vue'
import EventPolls from '@/components/event/EventPolls.vue'
import EventBringList from '@/components/event/EventBringList.vue'
import EventForm from '@/components/event/EventForm.vue'
import type { EventRole, ParticipantsResponse, RsvpStatus } from '@/types'
import RouteButton from '@/components/event/RouteButton.vue'

const route  = useRoute()
const router = useRouter()
const store  = useEventStore()
const auth   = useAuthStore()

const eventId = computed(() => Number(route.params.id))
const event   = computed(() => store.currentEvent)
const editMode   = ref(false)
const rsvpStatus = ref<string | null>(null)

// Participants
const participantsLoading = ref(false)
const participantsData = reactive<ParticipantsResponse>({
  myEventRole: null, attending: 0, maybe: 0, participants: [],
})

const myEventRole  = computed(() => participantsData.myEventRole)
const isOrganizer  = computed(() => event.value?.organizer?.id === auth.userId)
const canEdit      = computed(() => myEventRole.value === 'OWNER' || myEventRole.value === 'EDITOR' || isOrganizer.value)
const canDelete    = computed(() => myEventRole.value === 'OWNER' || isOrganizer.value)

// Invite
const inviteToken        = ref<string | null>(null)
const regeneratingInvite = ref(false)
const copiedInvite       = ref(false)
const inviteLink         = computed(() =>
  inviteToken.value ? `${window.location.origin}/events/join/${inviteToken.value}` : ''
)

// Delete
const confirmDelete = ref(false)
const deleting      = ref(false)

// Resolved address from Nominatim geocoding (used to enrich ICS export)
const resolvedLocation = ref<string | null>(null)
const icsDownloadUrl = computed(() => {
  const base = `/api/events/${event.value?.id}/export.ics`
  return resolvedLocation.value
    ? `${base}?location=${encodeURIComponent(resolvedLocation.value)}`
    : base
})

onMounted(async () => {
  await store.fetchById(eventId.value)
  await loadParticipants()
})

async function loadParticipants() {
  if (!auth.isLoggedIn) return
  participantsLoading.value = true
  try {
    const data = await store.fetchParticipants(eventId.value)
    Object.assign(participantsData, data)
  } catch {
    // unauthenticated or private event without access — leave empty
  } finally {
    participantsLoading.value = false
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
}

async function submitRsvp(status: string) {
  await api.put(`/events/${eventId.value}/rsvp`, { status })
  rsvpStatus.value = status
  await loadParticipants()
}

async function doSetRole(userId: number, role: EventRole) {
  const updated = await store.setEventRole(eventId.value, userId, role)
  Object.assign(participantsData, updated)
}

async function doRemoveRole(userId: number) {
  await store.removeEventRole(eventId.value, userId)
  await loadParticipants()
}

// Invite
async function doRegenerateInvite() {
  regeneratingInvite.value = true
  try {
    inviteToken.value = await store.regenerateEventInvite(eventId.value)
  } finally {
    regeneratingInvite.value = false
  }
}

function copyInviteLink() {
  navigator.clipboard.writeText(inviteLink.value)
  copiedInvite.value = true
  setTimeout(() => (copiedInvite.value = false), 2000)
}

// Delete
async function doDelete() {
  deleting.value = true
  try {
    await store.remove(eventId.value)
    router.push({ name: 'home' })
  } finally {
    deleting.value = false
    confirmDelete.value = false
  }
}

// Edit
async function onEdited() {
  editMode.value = false
  await store.fetchById(eventId.value)
}

function roleSeverity(role: EventRole | null) {
  if (role === 'OWNER')  return 'danger'
  if (role === 'EDITOR') return 'warning'
  return 'secondary'
}

function rsvpLabel(status: RsvpStatus) {
  if (status === 'ATTENDING')    return 'Attending'
  if (status === 'MAYBE')        return 'Maybe'
  return 'Not attending'
}

function rsvpSeverity(status: RsvpStatus) {
  if (status === 'ATTENDING') return 'success'
  if (status === 'MAYBE')     return 'warning'
  return 'danger'
}
</script>
