import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/api/client'
import type { PublicProduct } from '@/api/types'
import { EmptyState, Input } from '@/components/ui'
import { useStorefront } from './StorefrontContext'

export default function StoreHome() {
  const { business, slug } = useStorefront()
  const [products, setProducts] = useState<PublicProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    const timeout = setTimeout(() => {
      api
        .get<PublicProduct[]>(`/public/stores/${slug}/products${search ? `?search=${encodeURIComponent(search)}` : ''}`, { auth: false })
        .then(setProducts)
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(timeout)
  }, [slug, search])

  return (
    <div>
      {business.show_search && (
        <div className="mb-4">
          <Input placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      )}

      {loading ? (
        <p className="py-10 text-center text-ink-500">Loading…</p>
      ) : products.length === 0 ? (
        <EmptyState icon="🛍️" title="No products yet" description="This store hasn't added any products yet. Check back soon!" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <Link key={p.id} to={`/store/${slug}/product/${p.id}`} className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="relative aspect-square w-full bg-cream-100">
                {p.images[0] ? (
                  <img src={p.images[0].url} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-4xl">📷</div>
                )}
                {!p.is_orderable && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-ink-900">SOLD OUT</span>
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-semibold text-ink-900">{p.name}</p>
                <p className="mt-0.5 text-sm text-ink-700">
                  Rs. {(p.sale_price ?? p.price).toLocaleString()}
                  {p.sale_price && <span className="ml-1.5 text-xs text-ink-300 line-through">Rs. {p.price.toLocaleString()}</span>}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
