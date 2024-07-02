import axios from 'axios'

export const INSTANCE_TIMEOUT = 1500
export const INSTANCE_HEADER = {
  'Content-Type': 'application/json' //!  Возможно позже заменить
}

type TokenResponse = {
  access_token: string
  refresh_token: string
}

export const authInstance = axios.create({
  timeout: INSTANCE_TIMEOUT,
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: INSTANCE_HEADER
})

export const getNewToken = async () => {
  // const refreshToken
  const responce = await axios.post<TokenResponse>(
    `${import.meta.env.VITE_API_BASE_URL}/auth/access-token`,
    {}
  )
}
