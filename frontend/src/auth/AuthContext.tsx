import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, tokenStore } from '@/api/client'
import type { User } from '@/api/types'

interface SignupPayload {
  full_name: string
  password: string
  email?: string
  phone?: string
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (identifier: string, password: string) => Promise<User>
  signup: (payload: SignupPayload) => Promise<User>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    if (!tokenStore.access) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const me = await api.get<User>('/auth/me')
      setUser(me)
    } catch {
      tokenStore.clear()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const login = useCallback(async (identifier: string, password: string) => {
    const tokens = await api.post<{ access_token: string; refresh_token: string }>('/auth/login', { identifier, password }, { auth: false })
    tokenStore.set(tokens.access_token, tokens.refresh_token)
    const me = await api.get<User>('/auth/me')
    setUser(me)
    return me
  }, [])

  const signup = useCallback(async (payload: SignupPayload) => {
    const tokens = await api.post<{ access_token: string; refresh_token: string }>('/auth/signup', payload, { auth: false })
    tokenStore.set(tokens.access_token, tokens.refresh_token)
    const me = await api.get<User>('/auth/me')
    setUser(me)
    return me
  }, [])

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
