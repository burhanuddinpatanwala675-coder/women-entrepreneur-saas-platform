import { createContext, useContext } from 'react'
import type { BusinessDoc } from '@/firebase/types'

export type StorefrontBusiness = BusinessDoc & { id: string; categoryName: string | null }

export interface StorefrontContextValue {
  business: StorefrontBusiness
  slug: string
}

export const StorefrontContext = createContext<StorefrontContextValue | null>(null)

export function useStorefront() {
  const ctx = useContext(StorefrontContext)
  if (!ctx) throw new Error('useStorefront must be used within StorefrontLayout')
  return ctx
}
