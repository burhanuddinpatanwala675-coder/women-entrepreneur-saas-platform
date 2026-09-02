import { useEffect, useState } from 'react'
import { Link, Outlet, useParams } from 'react-router-dom'
import { api } from '@/api/client'
import type { PublicBusiness } from '@/api/types'
import { FullScreenSpinner } from '@/components/ui'
import { CartDrawer, CartFab } from './CartDrawer'
import { StorefrontContext } from './StorefrontContext'

export default function StorefrontLayout() {
  const { slug } = useParams<{ slug: string }>()
  const [business, setBusiness] = useState<PublicBusiness | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)

  useEffect(() => {
    if (!slug) return
    api
      .get<PublicBusiness>(`/public/stores/${slug}`, { auth: false })
      .then(setBusiness)
      .catch(() => setNotFound(true))
  }, [slug])

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <p className="text-5xl">🏪</p>
        <h1 className="mt-4 text-xl font-bold text-ink-900">This store isn't available</h1>
        <p className="mt-1.5 text-sm text-ink-500">It may have been moved or is temporarily unavailable.</p>
      </div>
    )
  }
  if (!business || !slug) return <FullScreenSpinner />

  return (
    <StorefrontContext.Provider value={{ business, slug }}>
      <div className="min-h-screen bg-cream-50" style={{ ['--accent' as string]: business.accent_color }}>
        {business.announcement_banner && (
          <div className="bg-brand-600 px-4 py-2 text-center text-sm font-medium text-white">{business.announcement_banner}</div>
        )}

        {business.cover_image_url && (
          <div className="h-32 w-full sm:h-48">
            <img src={business.cover_image_url} alt="" className="h-full w-full object-cover" />
          </div>
        )}

        <header className="mx-auto max-w-5xl px-4 pb-4 pt-4">
          <div className="flex items-center gap-3">
            {business.logo_url ? (
              <img src={business.logo_url} alt={business.name} className="h-16 w-16 rounded-2xl border-4 border-white object-cover shadow" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-2xl">🛍️</div>
            )}
            <div>
              <Link to={`/store/${slug}`}>
                <h1 className="text-xl font-bold text-ink-900">{business.name}</h1>
              </Link>
              {business.category_name && <p className="text-sm text-ink-500">{business.category_name}</p>}
            </div>
          </div>
          {business.short_description && <p className="mt-3 text-sm text-ink-700">{business.short_description}</p>}
        </header>

        <main className="mx-auto max-w-5xl px-4 pb-24">
          <Outlet />
        </main>

        <CartFab onClick={() => setCartOpen(true)} />
        <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />

        <footer className="mt-10 border-t border-black/5 py-6 text-center text-xs text-ink-500">
          Powered by HerCommerce · <Link to={`/store/${slug}/gift-card`} className="underline">Send a gift card</Link>
        </footer>
      </div>
    </StorefrontContext.Provider>
  )
}
