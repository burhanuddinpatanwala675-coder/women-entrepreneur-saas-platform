import { createContext, useContext } from 'react'
import type { PublicBusiness } from '@/api/types'

export interface StorefrontContextValue {
  business: PublicBusiness
  slug: string
}

export const StorefrontContext = createContext<StorefrontContextValue | null>(null)

export function useStorefront() {
  const ctx = useContext(StorefrontContext)
  if (!ctx) throw new Error('useStorefront must be used within StorefrontLayout')
  return ctx
}
