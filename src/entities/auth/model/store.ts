import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { UserSchema } from './types/auth'
import { useOnline } from '@vueuse/core'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserSchema | null>(null)
  const accessToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const isAuth = computed(() => !!user.value && !!accessToken.value)
  const isOnline = useOnline()
  const logout = () => {
    user.value = null
    accessToken.value = null
    refreshToken.value = null
  }

  const register = async () => {}
  const googleLogin = async () => {}
  const githubLogin = async () => {}
  const login = async () => {}
  const refreshAuthToken = () => {}
  const initializeAuth = async () => {}
  return {
    user,
    accessToken,
    refreshToken,
    register,
    login,
    logout,
    refreshAuthToken,
    initializeAuth,
    googleLogin,
    githubLogin,
    isAuth
  }
})
