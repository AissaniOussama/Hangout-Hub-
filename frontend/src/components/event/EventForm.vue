<template>
  <!-- BUG FIX: uses a <div> instead of <form> to avoid the PrimeVue InputNumber
       "NaN loop" and the Chrome autofill loop that occur with a native <form> here. -->
  <div class="flex flex-col gap-4">
    <!-- Title -->
    <div>
      <label for="event-title" class="block text-sm font-medium mb-1">Title *</label>
      <InputText id="event-title" v-model="form.title" class="w-full" :invalid="!!errors.title" />
      <small v-if="errors.title" class="text-red-500">{{ errors.title }}</small>
    </div>

    <!-- Description -->
    <div>
      <label for="event-description" class="block text-sm font-medium mb-1">Description</label>
      <Textarea id="event-description" v-model="form.description" rows="3" class="w-full" />
    </div>

    <!-- Date/time -->
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="event-start" class="block text-sm font-medium mb-1">Start *</label>
        <InputText id="event-start" v-model="form.startTime" type="datetime-local" class="w-full" :invalid="!!errors.startTime" />
        <small v-if="errors.startTime" class="text-red-500">{{ errors.startTime }}</small>
      </div>
      <div>
        <label for="event-end" class="block text-sm font-medium mb-1">End</label>
        <InputText id="event-end" v-model="form.endTime" type="datetime-local" class="w-full" />
      </div>
    </div>

    <!-- Location -->
    <div>
      <label for="event-location" class="block text-sm font-medium mb-1">Location</label>
      <LocationAutocomplete id="event-location" v-model="form.location" class="mt-1" />
    </div>

    <!-- Admission fee -->
    <div>
      <label for="event-admission-fee" class="block text-sm font-medium mb-1">Admission fee (€)</label>
      <InputNumber inputId="event-admission-fee" v-model="form.admissionFee" :min="0" class="w-full" />
    </div>

    <!-- Participant limits -->
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="event-min-participants" class="block text-sm font-medium mb-1">Min participants</label>
        <InputNumber inputId="event-min-participants" v-model="form.minParticipants" :min="0" class="w-full" />
      </div>
      <div>
        <label for="event-max-participants" class="block text-sm font-medium mb-1">Max participants</label>
        <InputNumber inputId="event-max-participants" v-model="form.maxParticipants" :min="1" class="w-full" :invalid="!!errors.maxParticipants" />
        <small v-if="errors.maxParticipants" class="text-red-500">{{ errors.maxParticipants }}</small>
      </div>
    </div>

    <!-- Group selector (only shown when user is OWNER or ADMIN in at least one group) -->
    <div v-if="adminGroups.length > 0">
      <label for="event-group" class="block text-sm font-medium mb-1">Group</label>
      <Select
        inputId="event-group"
        v-model="form.groupId"
        :options="groupOptions"
        option-label="label"
        option-value="value"
        placeholder="No group (public event)"
        class="w-full"
        show-clear
      />
      <small class="text-gray-500">Only groups where you are owner or admin are shown.</small>
    </div>

    <!-- Visibility -->
    <div class="flex items-center gap-2">
      <Checkbox v-model="form.isPublic" :binary="true" inputId="isPublic" :disabled="isGroupSelected" />
      <label for="isPublic" class="text-sm font-medium" :class="{ 'opacity-50': isGroupSelected }">
        Public event (visible to everyone)
        <span v-if="isGroupSelected" class="font-normal text-gray-400"> — group events are always private</span>
      </label>
    </div>

    <!-- Mitbringliste -->
    <div class="flex items-center gap-2">
      <Checkbox v-model="form.hasBringList" :binary="true" inputId="hasBringList" />
      <label for="hasBringList" class="text-sm font-medium">
        Mitbringliste aktivieren
      </label>
    </div>

    <Message v-if="serverError" severity="error">{{ serverError }}</Message>

    <div class="flex justify-end gap-2">
      <Button label="Cancel" severity="secondary" @click="emit('cancel')" type="button" />
      <Button :label="isEditing ? 'Save Changes' : 'Create Event'" type="button" :loading="loading" @click="submit" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Checkbox from 'primevue/checkbox'
import Select from 'primevue/select'
import LocationAutocomplete from '@/components/event/LocationAutocomplete.vue'
import { CreateEventSchema, useEventStore } from '@/stores/eventStore'
import { useGroupStore } from '@/stores/groupStore'
import type { Event } from '@/types'

const props = defineProps<{ event?: Event }>()
const emit = defineEmits<{ submitted: []; cancel: [] }>()
const store = useEventStore()
const groupStore = useGroupStore()

const isEditing = computed(() => !!props.event)

// datetime-local inputs need "YYYY-MM-DDTHH:mm" — trim any seconds the backend sends back
function toLocalInput(value?: string): string {
  return value ? value.slice(0, 16) : ''
}

const form = reactive({
  title:           props.event?.title ?? '',
  description:     props.event?.description ?? '',
  startTime:       toLocalInput(props.event?.startTime),
  endTime:         toLocalInput(props.event?.endTime),
  location:        props.event?.location ?? '',
  // BUG FIX: numeric values are initialized with null (not undefined) to avoid the
  // PrimeVue InputNumber "NaN loop"; they are mapped back to undefined on submit.
  admissionFee:    props.event?.admissionFee ?? null as number | null,
  minParticipants: props.event?.minParticipants ?? null as number | null,
  maxParticipants: props.event?.maxParticipants ?? null as number | null,
  isPublic:        props.event?.isPublic ?? true,
  hasBringList:    props.event?.hasBringList ?? false,
  groupId:         props.event?.group?.id ?? undefined as number | undefined,
})
const errors      = reactive<Record<string, string>>({})
const serverError = ref('')
const loading     = ref(false)

const adminGroups = computed(() =>
  groupStore.groups.filter((g) => g.myRole === 'OWNER' || g.myRole === 'ADMIN')
)

const groupOptions = computed(() =>
  adminGroups.value.map((g) => ({ label: g.name, value: g.id }))
)

const isGroupSelected = computed(() => form.groupId != null)

watch(isGroupSelected, (selected) => {
  if (selected) form.isPublic = false
})

onMounted(() => groupStore.fetchMyGroups())

async function submit() {
  Object.keys(errors).forEach((k) => delete errors[k])
  serverError.value = ''

  const payload = {
    ...form,
    endTime: form.endTime || undefined,
    // BUG FIX: map the null-initialized numeric fields to undefined for the backend/schema
    admissionFee:    form.admissionFee    ?? undefined,
    minParticipants: form.minParticipants ?? undefined,
    maxParticipants: form.maxParticipants ?? undefined,
  }

  const result = CreateEventSchema.safeParse(payload)
  if (!result.success) {
    result.error.errors.forEach((e) => {
      errors[e.path[0] as string] = e.message
    })
    return
  }

  loading.value = true
  try {
    if (isEditing.value) {
      await store.update(props.event!.id, result.data)
    } else {
      await store.create(result.data)
    }
    emit('submitted')
  } catch (err: any) {
    serverError.value = err.response?.data?.error ?? (isEditing.value ? 'Could not update event.' : 'Could not create event.')
  } finally {
    loading.value = false
  }
}
</script>
