<template>
  <header class="sticky top-0 z-50 bg-white/85 backdrop-blur border-b border-slate-200/70">
    <!-- Brand bar: the four friends from the logo -->
    <div class="flex h-1">
      <div class="flex-1 bg-brand-red" />
      <div class="flex-1 bg-brand-yellow" />
      <div class="flex-1 bg-brand-green" />
      <div class="flex-1 bg-brand-blue" />
    </div>

    <div class="container mx-auto px-4 h-16 flex items-center justify-between">
      <RouterLink to="/" class="flex items-center gap-2.5 group">
        <AppLogo class="h-9 w-auto transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3" />
        <span class="text-xl font-extrabold tracking-tight text-slate-800">
          Hangout<span class="text-primary-600">Hub</span>
        </span>
      </RouterLink>

      <nav class="flex items-center gap-1.5">
        <RouterLink to="/" class="nav-pill">Events</RouterLink>
        <RouterLink v-if="auth.isLoggedIn" to="/calendar" class="nav-pill">Calendar</RouterLink>
        <RouterLink v-if="auth.isLoggedIn" to="/groups" class="nav-pill">Groups</RouterLink>

        <template v-if="auth.isLoggedIn">
          <NotificationBell />
          <div class="flex items-center gap-2 ml-1">
            <div class="h-8 w-8 rounded-full bg-primary-100 text-primary-700 font-bold grid place-items-center text-sm select-none">
              {{ userInitial }}
            </div>
            <span class="text-sm font-semibold text-slate-700 hidden sm:inline">{{ auth.username }}</span>
          </div>
          <Button label="Sign Out" size="small" text severity="secondary" @click="signOut" />
        </template>
        <template v-else>
          <RouterLink to="/login">
            <Button label="Sign In" size="small" rounded />
          </RouterLink>
        </template>
      </nav>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import { useAuthStore } from '@/stores/authStore'
import NotificationBell from '@/components/layout/NotificationBell.vue'
import AppLogo from '@/components/layout/AppLogo.vue'

const router = useRouter()
const auth = useAuthStore()

const userInitial = computed(() => auth.username?.charAt(0).toUpperCase() ?? '?')

function signOut() {
  auth.logout()
  router.push({ name: 'home' })
}
</script>
