import { AxiosResponse } from 'axios'

export interface RegistrationType {
  email: string
  password: string
  passwordConfirmation: string
  userName: string
  captchaToken: string
}

export interface UserSchema {
  _id: string
  username: string
  email: string
  isBanned: boolean
  config: string
  createAt: Date
  updatedAt: Date
  lastIn: Date
  lastOut: Date
  registrationDate: string
}

export interface AuthLoginResponse {
  user: UserSchema
  accessToken: string
  refreshToken: string
}

export interface LoginType {
  email: string
  password: string
  captchaToken: string
}

export interface ApiResponce<T> {
  data: T
  status: number
  statusText: string
}
