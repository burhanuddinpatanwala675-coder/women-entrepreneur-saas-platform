import { useRef, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { FullScreenSpinner } from '@/components/ui'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenSpinner />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}

export function RequireBusiness({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <FullScreenSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (!user.has_business) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

export function RequireNoBusiness({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  // Decide once, when the onboarding page first opens. The wizard creates the business
  // in step 2, which updates users/{uid} live — without this, that update would redirect
  // to /dashboard immediately and the "first product" and "store is ready" steps would
  // never show. A seller who already has a business is still sent to /dashboard.
  const allowRef = useRef<boolean | null>(null)
  if (loading) return <FullScreenSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (allowRef.current === null) allowRef.current = !user.has_business
  if (!allowRef.current) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <FullScreenSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'platform_admin') return <Navigate to="/" replace />
  return <>{children}</>
}
