import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import { definePreset } from '@primevue/themes'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import 'primeicons/primeicons.css'

import App from './App.vue'
import router from './router'
import './assets/main.css'

// Brand preset: primary = HangoutHub blue (from the logo)
const HangoutHubPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#eff8ff',
      100: '#daeeff',
      200: '#bde2ff',
      300: '#90cfff',
      400: '#5bb4fc',
      500: '#3495f8',
      600: '#1e7fdb',
      700: '#1765b3',
      800: '#185590',
      900: '#194874',
      950: '#122d49',
    },
  },
})

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(PrimeVue, {
  theme: {
    preset: HangoutHubPreset,
    options: {
      darkModeSelector: '.dark',
    },
  },
})
app.use(ToastService)
app.use(ConfirmationService)

app.mount('#app')
