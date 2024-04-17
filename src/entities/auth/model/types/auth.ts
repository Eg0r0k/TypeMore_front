export interface RegistrationType {
  email: string
  password: string
  userName: string
}

export interface AuthLoginResponse {
  //TODO user interface
  accessToken: string
  refreshToken: string
}

export interface LoginType {
  email: string
  password: string
}
