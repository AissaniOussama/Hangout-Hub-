<template>
  <Card>
    <template #title>
      <div class="flex items-center justify-between">
        <span><i class="pi pi-chart-bar mr-2" />Polls</span>
        <Button v-if="canManage" label="New Poll" icon="pi pi-plus" size="small" @click="openCreateDialog" />
      </div>
    </template>
    <template #content>
      <div v-if="pollStore.loading" class="flex justify-center py-4">
        <ProgressSpinner style="width:24px;height:24px" />
      </div>
      <p v-else-if="pollStore.polls.length === 0" class="text-sm text-gray-500">
        No polls yet.
      </p>
      <div v-else class="flex flex-col gap-5">
        <div v-for="poll in pollStore.polls" :key="poll.id" class="border rounded-lg p-3">
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="font-medium">{{ poll.question }}</p>
              <div class="flex flex-wrap gap-1 mt-1">
                <Tag :value="voteModeLabel(poll.voteMode)" severity="info" class="text-xs" />
                <Tag v-if="poll.closed" value="Closed" severity="danger" class="text-xs" />
                <Tag v-else-if="poll.closesAt" :value="`Closes ${formatDateTime(poll.closesAt)}`" severity="warning" class="text-xs" />
              </div>
            </div>
            <div class="flex gap-1 shrink-0">
              <Button icon="pi pi-users" text size="small" title="Show who voted" @click="detailsPollId = poll.id" />
              <template v-if="canManage">
                <Button v-if="!poll.closed" icon="pi pi-lock" text size="small" title="Close poll" @click="doClose(poll)" />
                <Button icon="pi pi-trash" text severity="danger" size="small" title="Delete poll" @click="confirmDeleteId = poll.id" />
              </template>
            </div>
          </div>

          <p class="text-xs text-gray-500 mt-2">{{ statusHint(poll) }}</p>

          <div class="flex flex-col gap-2 mt-2">
            <div
              v-for="option in poll.options"
              :key="option.id"
              class="rounded-md border px-3 py-2 transition-colors"
              :class="[
                option.votedByMe ? 'border-blue-400 bg-blue-50' : 'border-gray-200',
                canVote(poll) ? 'cursor-pointer hover:border-blue-300 hover:bg-blue-50' : 'cursor-default',
              ]"
              role="button"
              :aria-pressed="option.votedByMe"
              :tabindex="canVote(poll) ? 0 : -1"
              @click="handleOptionClick(poll, option)"
              @keydown.enter.prevent="handleOptionClick(poll, option)"
              @keydown.space.prevent="handleOptionClick(poll, option)"
            >
              <div class="flex items-center gap-2">
                <span
                  class="flex items-center justify-center shrink-0 w-4 h-4 border-2"
                  :class="[
                    poll.voteMode === 'MULTIPLE' ? 'rounded' : 'rounded-full',
                    option.votedByMe ? 'border-blue-500 bg-blue-500' : 'border-gray-300 bg-white',
                  ]"
                >
                  <i v-if="option.votedByMe" class="pi pi-check text-white" style="font-size: 10px" />
                </span>
                <span class="flex-1 text-sm">{{ optionLabel(option) }}</span>
                <span class="text-xs text-gray-500 shrink-0">
                  {{ option.voteCount }} · {{ percentage(poll, option) }}%
                </span>
              </div>
              <ProgressBar :value="percentage(poll, option)" :showValue="false" style="height: 6px" class="mt-2" />
            </div>
          </div>
        </div>
      </div>
    </template>
  </Card>

  <!-- Create poll dialog -->
  <Dialog v-model:visible="showCreateDialog" header="New Poll" :modal="true" class="w-full max-w-lg">
    <form @submit.prevent="submitCreate" class="flex flex-col gap-4">
      <div>
        <label class="block text-sm font-medium mb-1">Question *</label>
        <InputText v-model="form.question" class="w-full" />
      </div>

      <div>
        <label class="block text-sm font-medium mb-1">Voting mode</label>
        <Select v-model="form.voteMode" :options="voteModeOptions" option-label="label" option-value="value" class="w-full" />
      </div>

      <div>
        <label class="block text-sm font-medium mb-1">Closes at (optional)</label>
        <InputText v-model="form.closesAt" type="datetime-local" class="w-full" />
      </div>

      <div>
        <label class="block text-sm font-medium mb-1">Options *</label>
        <div class="flex flex-col gap-2">
          <div v-for="(option, idx) in form.options" :key="idx" class="flex items-center gap-2">
            <Select
              v-model="option.optionType"
              :options="optionTypeOptions"
              option-label="label"
              option-value="value"
              class="w-32 shrink-0"
            />
            <InputText v-if="option.optionType === 'TEXT'" v-model="option.text" placeholder="Option text" class="flex-1" />
            <InputText v-else v-model="option.dateValue" type="date" class="flex-1" />
            <Button
              icon="pi pi-times"
              text
              severity="danger"
              :disabled="form.options.length <= 2"
              @click="removeOption(idx)"
            />
          </div>
        </div>
        <Button label="Add option" icon="pi pi-plus" text size="small" class="mt-2" @click="addOption" />
      </div>

      <Message v-if="formError" severity="error">{{ formError }}</Message>

      <div class="flex justify-end gap-2">
        <Button label="Cancel" severity="secondary" type="button" @click="showCreateDialog = false" />
        <Button label="Create Poll" type="submit" :loading="creating" />
      </div>
    </form>
  </Dialog>

  <!-- Confirm delete dialog -->
  <Dialog v-model:visible="confirmDeleteVisible" header="Delete poll" :modal="true" class="w-full max-w-sm">
    <p class="mb-4">Are you sure you want to permanently delete this poll?</p>
    <div class="flex justify-end gap-2">
      <Button label="Cancel" severity="secondary" @click="confirmDeleteId = null" />
      <Button label="Delete" severity="danger" @click="doDelete" />
    </div>
  </Dialog>

  <!-- Poll details: who voted for what -->
  <Dialog v-model:visible="detailsVisible" :header="detailsPoll?.question ?? 'Poll details'" :modal="true" class="w-full max-w-lg">
    <div v-if="detailsPoll" class="flex flex-col gap-4">
      <div v-for="option in detailsPoll.options" :key="option.id">
        <div class="flex items-center justify-between text-sm font-medium">
          <span>{{ optionLabel(option) }}</span>
          <span class="text-gray-500 font-normal">{{ option.voteCount }} vote{{ option.voteCount === 1 ? '' : 's' }}</span>
        </div>
        <div v-if="option.voters.length > 0" class="flex flex-wrap gap-1 mt-2">
          <Tag v-for="voter in option.voters" :key="voter.userId" :value="voter.username" severity="secondary" class="text-xs" />
        </div>
        <p v-else class="text-xs text-gray-400 mt-1">No votes yet.</p>
      </div>
    </div>
    <div class="flex justify-end mt-4">
      <Button label="Close" severity="secondary" @click="detailsPollId = null" />
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Message from 'primevue/message'
import ProgressBar from 'primevue/progressbar'
import ProgressSpinner from 'primevue/progressspinner'
import { usePollStore } from '@/stores/pollStore'
import type { Poll, PollOption, VoteMode, PollOptionType, CreatePollRequest } from '@/types'

const props = defineProps<{ eventId: number; canManage: boolean }>()
const pollStore = usePollStore()

onMounted(() => pollStore.fetchPolls(props.eventId))
watch(() => props.eventId, (id) => pollStore.fetchPolls(id))

// ── Voting ─────────────────────────────────────────────────────────────────

function canVote(poll: Poll) {
  if (poll.closed) return false
  if (poll.voteMode === 'SINGLE_LOCKED' && poll.options.some((o) => o.votedByMe)) return false
  return true
}

async function handleOptionClick(poll: Poll, option: PollOption) {
  if (!canVote(poll)) return
  if (poll.voteMode === 'MULTIPLE') {
    await pollStore.vote(props.eventId, poll.id, option.id)
  } else if (option.votedByMe) {
    await pollStore.retractVote(props.eventId, poll.id, option.id)
  } else {
    await pollStore.vote(props.eventId, poll.id, option.id)
  }
}

function statusHint(poll: Poll): string {
  if (poll.closed) return 'This poll is closed — voting is no longer possible.'
  if (poll.voteMode === 'MULTIPLE') return 'Select as many options as you like.'
  const hasVoted = poll.options.some((o) => o.votedByMe)
  if (poll.voteMode === 'SINGLE_LOCKED') {
    return hasVoted
      ? 'You already voted — votes are locked for this poll.'
      : 'Pick one option. Your vote cannot be changed once cast.'
  }
  return 'Pick one option. You can change your vote anytime.'
}

function percentage(poll: Poll, option: PollOption) {
  const total = poll.options.reduce((sum, o) => sum + o.voteCount, 0)
  return total === 0 ? 0 : Math.round((option.voteCount / total) * 100)
}

function optionLabel(option: PollOption) {
  if (option.optionType === 'DATE' && option.dateValue) {
    return new Date(option.dateValue).toLocaleDateString('de-DE', { dateStyle: 'medium' })
  }
  return option.text ?? ''
}

function voteModeLabel(mode: VoteMode) {
  return voteModeOptions.find((o) => o.value === mode)?.label ?? mode
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
}

// ── Lifecycle actions ────────────────────────────────────────────────────────

async function doClose(poll: Poll) {
  await pollStore.closePoll(props.eventId, poll.id)
}

const confirmDeleteId = ref<number | null>(null)
const confirmDeleteVisible = computed({
  get: () => confirmDeleteId.value !== null,
  set: (v) => { if (!v) confirmDeleteId.value = null },
})

async function doDelete() {
  if (confirmDeleteId.value === null) return
  await pollStore.deletePoll(props.eventId, confirmDeleteId.value)
  confirmDeleteId.value = null
}

// ── Poll details (who voted for what) ─────────────────────────────────────────

const detailsPollId = ref<number | null>(null)
const detailsPoll = computed(() => pollStore.polls.find((p) => p.id === detailsPollId.value) ?? null)
const detailsVisible = computed({
  get: () => detailsPollId.value !== null,
  set: (v) => { if (!v) detailsPollId.value = null },
})

// ── Create poll form ─────────────────────────────────────────────────────────

const voteModeOptions: { label: string; value: VoteMode }[] = [
  { label: 'Single choice (changeable)', value: 'SINGLE_CHANGEABLE' },
  { label: 'Single choice (locked)', value: 'SINGLE_LOCKED' },
  { label: 'Multiple choice', value: 'MULTIPLE' },
]

const optionTypeOptions: { label: string; value: PollOptionType }[] = [
  { label: 'Text', value: 'TEXT' },
  { label: 'Date', value: 'DATE' },
]

const showCreateDialog = ref(false)
const creating = ref(false)
const formError = ref('')

function blankOption() {
  return { optionType: 'TEXT' as PollOptionType, text: '', dateValue: '' }
}

const form = reactive({
  question: '',
  voteMode: 'SINGLE_CHANGEABLE' as VoteMode,
  closesAt: '',
  options: [blankOption(), blankOption()],
})

function openCreateDialog() {
  form.question = ''
  form.voteMode = 'SINGLE_CHANGEABLE'
  form.closesAt = ''
  form.options = [blankOption(), blankOption()]
  formError.value = ''
  showCreateDialog.value = true
}

function addOption() {
  form.options.push(blankOption())
}

function removeOption(idx: number) {
  if (form.options.length <= 2) return
  form.options.splice(idx, 1)
}

async function submitCreate() {
  formError.value = ''

  if (!form.question.trim()) {
    formError.value = 'Question is required.'
    return
  }
  for (const option of form.options) {
    if (option.optionType === 'TEXT' && !option.text?.trim()) {
      formError.value = 'All text options need a value.'
      return
    }
    if (option.optionType === 'DATE' && !option.dateValue) {
      formError.value = 'All date options need a date.'
      return
    }
  }

  const payload: CreatePollRequest = {
    question: form.question,
    voteMode: form.voteMode,
    closesAt: form.closesAt || undefined,
    options: form.options.map((o) =>
      o.optionType === 'TEXT'
        ? { optionType: 'TEXT', text: o.text }
        : { optionType: 'DATE', dateValue: o.dateValue }
    ),
  }

  creating.value = true
  try {
    await pollStore.createPoll(props.eventId, payload)
    showCreateDialog.value = false
  } catch (err: any) {
    formError.value = err.response?.data?.error ?? 'Could not create poll.'
  } finally {
    creating.value = false
  }
}
</script>
