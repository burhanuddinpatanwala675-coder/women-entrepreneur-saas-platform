import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/SellerLayout'
import { Card } from '@/components/ui'

const LINKS = [
  { to: '/dashboard/store', label: 'Store settings', icon: '🛍️', desc: 'Logo, cover photo, WhatsApp number, template' },
  { to: '/dashboard/vouchers', label: 'Vouchers', icon: '🏷️', desc: 'Discount codes for customers' },
  { to: '/dashboard/gift-cards', label: 'Gift cards', icon: '🎁', desc: 'Digital gift cards' },
  { to: '/dashboard/ai-assistant', label: 'AI Assistant', icon: '✨', desc: 'AI-generated product content' },
]

export default function SettingsPage() {
  const { user } = useAuth()

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" />

      <Card className="mb-5 p-5">
        <h2 className="font-semibold text-ink-900">Account</h2>
        <p className="mt-1 text-sm text-ink-700">{user?.full_name}</p>
        <p className="text-sm text-ink-500">{user?.email || user?.phone}</p>
      </Card>

      <div className="space-y-2">
        {LINKS.map((l) => (
          <Link key={l.to} to={l.to}>
            <Card className="flex items-center gap-3 p-4">
              <span className="text-2xl">{l.icon}</span>
              <div>
                <p className="font-medium text-ink-900">{l.label}</p>
                <p className="text-xs text-ink-500">{l.desc}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
