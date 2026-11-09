import type { User } from '@/types/auth'
import { api } from './api'

export const authService = {
  me: () => api<User>('/auth/me/'),
  login: (username: string, password: string) => api<User>('/auth/login/', { method: 'POST', body: { username, password } }),
  logout: () => api<void>('/auth/logout/', { method: 'POST' }),
}
