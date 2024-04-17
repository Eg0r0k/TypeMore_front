import axios from 'axios'

export const INSTANCE_TIMEOUT = 1500
export const INSTANCE_HEADER = {
  'Content-Type': 'application/json' //!  Возможно позже заменить
}
type Tokens = {
  access_token: string
  refresh_token: string
}

export const authInstance = axios.create({
  timeout: INSTANCE_TIMEOUT,
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: INSTANCE_HEADER
})
