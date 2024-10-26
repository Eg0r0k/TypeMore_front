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
    try {
      const response = await AuthApi.registration(args)
      user.value = response.data.user
    } catch (error) {
      console.error('Registration failed:', error)
      throw error
    }
  }


  const login = async (args: LoginType) => {
    try {
      const response = await AuthApi.login(args)
      user.value = response.data.user
    } catch (error) {
      console.error('Login failed:', error)
      throw error
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
