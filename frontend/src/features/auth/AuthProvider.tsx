import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError } from '@/services/api'
import { authService, type RegisterData } from '@/services/auth'
import type { User } from '@/types/auth'

type AuthState = {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    authService
      .me()
      .then((u) => active && setUser(u))
      .catch((e: unknown) => {
        // 401/403 = sem sessão (esperado). Outros erros também resultam em tela de login.
        if (!(e instanceof ApiError)) console.error(e)
      })
      .finally(() => active && setLoading(false))
    const onUnauthorized = () => {
      if (active) setUser(null)
    }
    window.addEventListener('nexo:unauthorized', onUnauthorized)
    return () => {
      active = false
      window.removeEventListener('nexo:unauthorized', onUnauthorized)
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    setUser(await authService.login(username, password))
  }, [])

  const register = useCallback(async (data: RegisterData) => {
    setUser(await authService.register(data))
  }, [])

  const logout = useCallback(async () => {
    await authService.logout()
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    setUser(await authService.me())
  }, [])

  const value = useMemo(() => ({ user, loading, login, register, logout, refreshUser }), [user, loading, login, register, logout, refreshUser])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>.')
  return ctx
}
