import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/firebase/client'
import type { ProductDoc } from '@/firebase/types'
import { EmptyState, Input } from '@/components/ui'
import { useStorefront } from './StorefrontContext'

type Product = ProductDoc & { id: string }

export default function StoreHome() {
  const { business, slug } = useStorefront()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const q = query(collection(db, 'products'), where('businessId', '==', slug))
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as ProductDoc) }))
        .filter((p) => p.status !== 'hidden')
      items.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
      setProducts(items)
      setLoading(false)
    })
    return unsub
  }, [slug])

  const filtered = useMemo(() => {
    if (!search.trim()) return products
    const term = search.trim().toLowerCase()
    return products.filter((p) => p.name.toLowerCase().includes(term) || p.tags.some((t) => t.toLowerCase().includes(term)))
  }, [products, search])

  return (
    <div>
      {business.storeSettings.showSearch && (
        <div className="mb-4">
          <Input placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      )}

      {loading ? (
        <p className="py-10 text-center text-ink-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon="🛍️" title="No products yet" description="This store hasn't added any products yet. Check back soon!" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => {
            const orderable = p.status !== 'sold' && p.status !== 'out_of_stock'
            return (
              <Link key={p.id} to={`/store/${slug}/product/${p.id}`} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="relative aspect-square w-full bg-cream-100">
                  {p.images[0] ? (
                    <img src={p.images[0].url} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-4xl">📷</div>
                  )}
                  {!orderable && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-ink-900">SOLD OUT</span>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-semibold text-ink-900">{p.name}</p>
                  <p className="mt-0.5 text-sm text-ink-700">
                    Rs. {(p.salePrice ?? p.price).toLocaleString()}
                    {p.salePrice && <span className="ml-1.5 text-xs text-ink-300 line-through">Rs. {p.price.toLocaleString()}</span>}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
