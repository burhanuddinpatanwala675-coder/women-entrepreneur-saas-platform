import { type ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { useAuth } from '@/auth/AuthContext'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Home', icon: '🏠', end: true },
  { to: '/dashboard/products', label: 'Products', icon: '📦' },
  { to: '/dashboard/orders', label: 'Orders', icon: '🧾' },
  { to: '/dashboard/customers', label: 'Customers', icon: '👥' },
  { to: '/dashboard/vouchers', label: 'Vouchers', icon: '🏷️' },
  { to: '/dashboard/gift-cards', label: 'Gift Cards', icon: '🎁' },
  { to: '/dashboard/store', label: 'Store', icon: '🛍️' },
  { to: '/dashboard/ai-assistant', label: 'AI Assistant', icon: '✨' },
  { to: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
]

// Bottom nav on mobile keeps only the essentials — everything else is one tap away via Home.
const MOBILE_NAV_ITEMS = [
  { to: '/dashboard', label: 'Home', icon: '🏠', end: true },
  { to: '/dashboard/products', label: 'Products', icon: '📦' },
  { to: '/dashboard/orders', label: 'Orders', icon: '🧾' },
  { to: '/dashboard/customers', label: 'Customers', icon: '👥' },
  { to: '/dashboard/settings', label: 'More', icon: '⚙️' },
]

export function SellerLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-cream-50 md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-black/5 bg-white md:flex">
        <div className="flex items-center gap-2 px-6 py-6">
          <span className="text-2xl">💗</span>
          <span className="text-lg font-bold text-ink-900">HerCommerce</span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-cream-100',
                )
              }
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-black/5 p-4">
          <p className="truncate text-sm font-semibold text-ink-900">{user?.fullName}</p>
          <button
            onClick={() => {
              logout()
              navigate('/login')
            }}
            className="mt-2 text-sm text-ink-500 hover:text-brand-600"
          >
            Log out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-black/5 bg-white px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xl">💗</span>
            <span className="font-bold text-ink-900">HerCommerce</span>
          </div>
          <button
            onClick={() => {
              logout()
              navigate('/login')
            }}
            className="tap-target rounded-full px-3 py-1.5 text-sm font-medium text-ink-500"
          >
            Log out
          </button>
        </header>

        <main className="flex-1 px-4 py-5 pb-24 md:px-8 md:py-8 md:pb-8">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-black/5 bg-white md:hidden">
          {MOBILE_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx('flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium', isActive ? 'text-brand-600' : 'text-ink-500')
              }
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
