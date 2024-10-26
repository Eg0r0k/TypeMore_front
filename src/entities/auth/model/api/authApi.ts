import axios, { AxiosResponse } from 'axios'
import type { LoginType, RegistrationType, AuthLoginResponse, ApiResponce } from '../types/auth'
import { useAuthStore } from '../store'

const API_URL = 'http://localhost:3000/api/v1'

export const AuthApi = {
  async login(args: LoginType): Promise<ApiResponce<AuthLoginResponse>> {
    const response: AxiosResponse<AuthLoginResponse> = await axios.post(
      `${API_URL}/auth/login`,
      args,
      { withCredentials: true }
    )
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText
    }
  },
  async refresh(): Promise<ApiResponce<{ accessToken: string }>> {
    const response: AxiosResponse<{ accessToken: string }> = await axios.post(
      `${API_URL}/auth/refresh`,
      {},
      { withCredentials: true }
    )
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText
    }
  },
  async registration(args: RegistrationType): Promise<ApiResponce<AuthLoginResponse>> {
    const response: AxiosResponse<AuthLoginResponse> = await axios.post(
      `${API_URL}/auth/signup`,
      args,
      { withCredentials: true }
    )
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText
    }
  }
}

const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true
})

apiClient.interceptors.response.use(
  (response) => {
    return response
  },
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      const authStore = useAuthStore()

      try {
        const response = await AuthApi.refresh()
        const { accessToken } = response.data

        if (accessToken) {
          originalRequest.headers['Authorization'] = `Bearer ${accessToken}`
          return apiClient(originalRequest)
        }
      } catch (refreshError) {
        authStore.logout()
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default apiClient
