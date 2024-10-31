import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { LoginType, RegistrationType, UserSchema } from './types/auth'
import { useOnline } from '@vueuse/core'
import { AuthApi } from './api/authApi'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserSchema | null>(null)
  const isAuth = computed(() => !!user.value)
  const isOnline = useOnline()
  const accessToken = ref<string | null>(null)

  const logout = () => {
    user.value = null
    accessToken.value = null
  }

  const register = async (args: RegistrationType) => {
    const response = await AuthApi.registration(args)
    if (response.success && response.data) {
      user.value = response.data.user
    } else {
      console.error('Registration failed:', response.error)
      throw new Error(response.error || 'Unknown error during registration')
    }
  }

  const login = async (args: LoginType) => {
    const response = await AuthApi.login(args)
    if (response.success && response.data) {
      user.value = response.data.user
      accessToken.value = response.data.accessToken
    } else {
      console.error('Login failed:', response.error)
      throw new Error(response.error || 'Unknown error during login')
    }
  }

  const refreshAuthToken = () => {}
  const initializeAuth = async () => {}

  return {
    user,
    register,
    login,
    logout,
    refreshAuthToken,
    initializeAuth,
    isAuth
  }
})
