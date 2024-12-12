import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  GlobalPermissions,
  GlobalRole,
  LoginType,
  RegistrationType,
  UserSchema
} from '../types/auth'
import { AuthApi } from '../api/authApi'
// import { useOnline } from '@vueuse/core'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserSchema | null>(null)
  const isAuth = computed(() => !!user.value)
  // const isOnline = useOnline()
  const accessToken = ref<string | null>(null)
  const isMacOs = ref(false)
  const logout = () => {
    user.value = null
    accessToken.value = null
  }

  user.value = {
    _id: 'user1',
    username: 'Eg0rk',
    email: 'egorka@gmail.com',
    isBanned: false,
    globalRole: GlobalRole.User,
    globalPremissions: [GlobalPermissions.EditProfile, GlobalPermissions.CreateLobby],
    config: '',
    createAt: new Date(),
    updatedAt: new Date(),
    lastIn: new Date(),
    lastOut: new Date(),
    registrationDate: ''
  }

  const googleAuth = async () => {}
  const githubAuth = async () => {}
  const resetPassword = async () => {}
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

  const initializeAuth = async () => {}

  return {
    user,
    register,
    login,
    isMacOs,
    logout,
    googleAuth,
    githubAuth,
    initializeAuth,
    isAuth,

    resetPassword
  }
})
