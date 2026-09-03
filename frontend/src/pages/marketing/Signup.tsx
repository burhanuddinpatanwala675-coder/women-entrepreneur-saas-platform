import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { Banner, Button, Input, Label } from '@/components/ui'
import { getFirebaseErrorMessage } from '@/firebase/errors'

export default function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signup({ full_name: fullName, email, phone: phone || undefined, password })
      navigate('/onboarding', { replace: true })
    } catch (err) {
      setError(getFirebaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-50 px-5 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="text-2xl">💗</span>
          <span className="text-lg font-bold text-ink-900">HerCommerce</span>
        </Link>
        <h1 className="text-center text-2xl font-bold text-ink-900">Start your online business</h1>
        <p className="mt-1 text-center text-sm text-ink-500">Free to get started. Takes less than 5 minutes.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {error && <Banner tone="danger">{error}</Banner>}
          <div>
            <Label htmlFor="fullName">Your name</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div>
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03xxxxxxxxx" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          <Button type="submit" fullWidth loading={loading}>
            Create my account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-500">
          Already have a store?{' '}
          <Link to="/login" className="font-semibold text-brand-600">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
