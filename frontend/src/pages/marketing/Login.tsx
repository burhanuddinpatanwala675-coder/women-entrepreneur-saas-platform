import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { Banner, Button, Input, Label } from '@/components/ui'
import { ApiError } from '@/api/client'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const user = await login(identifier, password)
      const from = (location.state as { from?: Location })?.from?.pathname
      navigate(from || (user.has_business ? '/dashboard' : '/onboarding'), { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
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
        <h1 className="text-center text-2xl font-bold text-ink-900">Welcome back</h1>
        <p className="mt-1 text-center text-sm text-ink-500">Log in to manage your store</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {error && <Banner tone="danger">{error}</Banner>}
          <div>
            <Label htmlFor="identifier">Email or phone</Label>
            <Input id="identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoFocus />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" fullWidth loading={loading}>
            Log in
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-500">
          New here?{' '}
          <Link to="/signup" className="font-semibold text-brand-600">
            Create your store
          </Link>
        </p>
      </div>
    </div>
  )
}
