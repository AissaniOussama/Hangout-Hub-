<template>
  <div class="flex justify-center items-center min-h-[60vh]">
    <Card class="w-full max-w-md">
      <template #title>Sign In</template>
      <template #content>
        <form @submit.prevent="submit" class="flex flex-col gap-4">
          <div>
            <label for="login-email" class="block text-sm font-medium mb-1">Email</label>
            <InputText id="login-email" v-model="form.email" type="email" class="w-full" :invalid="!!errors.email" />
            <small v-if="errors.email" class="text-red-500">{{ errors.email }}</small>
          </div>
          <div>
            <label for="login-password" class="block text-sm font-medium mb-1">Password</label>
            <Password inputId="login-password" v-model="form.password" :feedback="false" class="w-full" inputClass="w-full" :invalid="!!errors.password" />
            <small v-if="errors.password" class="text-red-500">{{ errors.password }}</small>
          </div>
          <Message v-if="serverError" severity="error">{{ serverError }}</Message>
          <Button type="submit" label="Sign In" :loading="loading" />
          <p class="text-center text-sm">
            No account?
            <RouterLink to="/register" class="text-primary-500 hover:underline">Register</RouterLink>
          </p>
        </form>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { LoginSchema, useAuthStore } from '@/stores/authStore'

const router = useRouter()
const auth = useAuthStore()

const form = reactive({ email: '', password: '' })
const errors = reactive<Record<string, string>>({})
const serverError = ref('')
const loading = ref(false)

async function submit() {
  Object.keys(errors).forEach((k) => delete errors[k])
  serverError.value = ''

  const result = LoginSchema.safeParse(form)
  if (!result.success) {
    result.error.errors.forEach((e) => {
      errors[e.path[0] as string] = e.message
    })
    return
  }

  loading.value = true
  try {
    await auth.login(result.data)
    router.push({ name: 'home' })
  } catch {
    serverError.value = 'Invalid email or password.'
  } finally {
    loading.value = false
  }
}
</script>
