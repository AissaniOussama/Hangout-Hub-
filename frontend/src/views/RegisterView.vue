<template>
  <div class="flex justify-center items-center min-h-[60vh]">
    <Card class="w-full max-w-md">
      <template #title>Create Account</template>
      <template #content>
        <form @submit.prevent="submit" class="flex flex-col gap-4">
          <div>
            <label for="register-username" class="block text-sm font-medium mb-1">Username</label>
            <InputText id="register-username" v-model="form.username" class="w-full" :invalid="!!errors.username" />
            <small v-if="errors.username" class="text-red-500">{{ errors.username }}</small>
          </div>
          <div>
            <label for="register-email" class="block text-sm font-medium mb-1">Email</label>
            <InputText id="register-email" v-model="form.email" type="email" class="w-full" :invalid="!!errors.email" />
            <small v-if="errors.email" class="text-red-500">{{ errors.email }}</small>
          </div>
          <div>
            <label for="register-password" class="block text-sm font-medium mb-1">Password</label>
            <Password inputId="register-password" v-model="form.password" class="w-full" inputClass="w-full" :invalid="!!errors.password" />
            <small v-if="errors.password" class="text-red-500">{{ errors.password }}</small>
          </div>
          <Message v-if="serverError" severity="error">{{ serverError }}</Message>
          <Button type="submit" label="Register" :loading="loading" />
          <p class="text-center text-sm">
            Already have an account?
            <RouterLink to="/login" class="text-primary-500 hover:underline">Sign in</RouterLink>
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
import { RegisterSchema, useAuthStore } from '@/stores/authStore'

const router = useRouter()
const auth = useAuthStore()

const form = reactive({ username: '', email: '', password: '' })
const errors = reactive<Record<string, string>>({})
const serverError = ref('')
const loading = ref(false)

async function submit() {
  Object.keys(errors).forEach((k) => delete errors[k])
  serverError.value = ''

  const result = RegisterSchema.safeParse(form)
  if (!result.success) {
    result.error.errors.forEach((e) => {
      errors[e.path[0] as string] = e.message
    })
    return
  }

  loading.value = true
  try {
    await auth.register(result.data)
    router.push({ name: 'home' })
  } catch (err: any) {
    serverError.value = err.response?.data?.error ?? 'Registration failed.'
  } finally {
    loading.value = false
  }
}
</script>
