import type { LoginType, RegistrationType } from '../types/auth'

export const AuthApi = {
  async login(args: LoginType) {},
  async registraion(args: RegistrationType) {},
  //TODO Login with google
  async googleLogin(agrs: any) {}
}
