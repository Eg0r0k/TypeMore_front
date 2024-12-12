export interface RegistrationType {
  email: string
  password: string
  passwordConfirmation: string
  username: string
  captchaToken: string
}

export enum GlobalRole {
  SuperAdmin = 'superAdmin',
  Admin = 'admin',
  User = 'user',
  Guest = 'guest',
  Invalid = 'invalid'
}
export enum GlobalPermissions {
  CreateLobby = 'createLobby',
  EditProfile = 'editProfile',
  DeleteProfile = 'deleteProfile'
}

export interface UserSchema {
  _id: string
  username: string
  email: string
  isBanned: boolean
  globalRole: GlobalRole
  globalPremissions: GlobalPermissions[]
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
  username: string
  password: string
  // captchaToken: string
}

export interface ApiResponse<T> {
  data?: T
  error?: string
  success: boolean
}
