import type { User } from '@/types/auth'
import { api } from './api'

export type RegisterData = {
  username: string
  password: string
  email?: string
  first_name?: string
}

export const authService = {
  me: () => api<User>('/auth/me/'),
  login: (username: string, password: string) => api<User>('/auth/login/', { method: 'POST', body: { username, password } }),
  register: (data: RegisterData) => api<User>('/auth/register/', { method: 'POST', body: data }),
  registrationStatus: () => api<{ enabled: boolean }>('/auth/register/'),
  requestPasswordReset: (email: string) =>
    api<{ message: string }>('/auth/password-reset/', { method: 'POST', body: { email } }),
  confirmPasswordReset: (data: { uid: string; token: string; new_password: string }) =>
    api<{ message: string }>('/auth/password-reset-confirm/', { method: 'POST', body: data }),
  logout: () => api<void>('/auth/logout/', { method: 'POST' }),
}
