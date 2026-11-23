import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { z } from 'zod'
import api from '@/services/api'
import type { AuthResponse } from '@/types'

const LoginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const RegisterSchema = LoginSchema.extend({
  username: z.string().min(3, 'Username must be at least 3 characters').max(50),
})

export type LoginForm = z.infer<typeof LoginSchema>
export type RegisterForm = z.infer<typeof RegisterSchema>
export { LoginSchema, RegisterSchema }

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'))
  const userId = ref<number | null>(Number(localStorage.getItem('userId')) || null)
  const username = ref<string | null>(localStorage.getItem('username'))
  const email = ref<string | null>(localStorage.getItem('email'))

  const isLoggedIn = computed(() => !!token.value)

  async function login(form: LoginForm) {
    const { data } = await api.post<AuthResponse>('/auth/login', form)
    setSession(data)
  }

  async function register(form: RegisterForm) {
    const { data } = await api.post<AuthResponse>('/auth/register', form)
    setSession(data)
  }

  function logout() {
    token.value = null
    userId.value = null
    username.value = null
    email.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('userId')
    localStorage.removeItem('username')
    localStorage.removeItem('email')
  }

  function setSession(data: AuthResponse) {
    token.value = data.token
    userId.value = data.userId
    username.value = data.username
    email.value = data.email
    localStorage.setItem('token', data.token)
    localStorage.setItem('userId', String(data.userId))
    localStorage.setItem('username', data.username)
    localStorage.setItem('email', data.email)
  }

  return { token, userId, username, email, isLoggedIn, login, register, logout }
})
