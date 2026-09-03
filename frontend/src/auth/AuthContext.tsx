import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '@/firebase/client'
import type { AppUser, UserDoc } from '@/firebase/types'

interface SignupPayload {
  full_name: string
  password: string
  email: string
  phone?: string
}

interface AuthContextValue {
  user: AppUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (payload: SignupPayload) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * There are no Cloud Functions in this build (see ARCHITECTURE.md's migration note), so
 * there's no server-side trigger to create `users/{uid}` after signup — the client does
 * it directly, synchronously, right here. Security Rules (see firestore.rules) only allow
 * a user to create their OWN doc, with role:"seller" and businessId:null — this is the
 * entire root of the multi-tenancy model (section 3.1).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const docUnsubRef = useRef<(() => void) | undefined>(undefined)

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      docUnsubRef.current?.()
      docUnsubRef.current = undefined

      if (!fbUser) {
        setUser(null)
        setLoading(false)
        return
      }

      docUnsubRef.current = onSnapshot(doc(db, 'users', fbUser.uid), (snap) => {
        const data = snap.data() as UserDoc | undefined
        if (!data) {
          // Doc hasn't landed yet (signup just wrote it a moment ago) — stay in loading
          // state rather than showing a half-built user; the listener will fire again the
          // instant the create commits.
          return
        }
        setUser({
          uid: fbUser.uid,
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          role: data.role,
          businessId: data.businessId,
          isActive: data.isActive,
          has_business: !!data.businessId,
        })
        setLoading(false)
      })
    })
    return () => {
      unsubAuth()
      docUnsubRef.current?.()
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }, [])

  const signup = useCallback(async (payload: SignupPayload) => {
    const cred = await createUserWithEmailAndPassword(auth, payload.email, payload.password)
    await setDoc(doc(db, 'users', cred.user.uid), {
      fullName: payload.full_name,
      email: payload.email,
      phone: payload.phone || null,
      role: 'seller',
      businessId: null,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }, [])

  const logout = useCallback(async () => {
    await firebaseSignOut(auth)
  }, [])

  return <AuthContext.Provider value={{ user, loading, login, signup, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
