import axios from 'axios'
const INSTANCE_TIMEOUT = 3000
const INSTANCE_HEADER = {
  'Content-Type': 'application/json'
}
export const instance = axios.create({
  timeout: INSTANCE_TIMEOUT,
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: INSTANCE_HEADER
})
