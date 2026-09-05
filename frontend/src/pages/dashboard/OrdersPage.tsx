import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/firebase/client'
import type { OrderDoc, OrderStatus } from '@/firebase/types'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/SellerLayout'
import { Badge, Card, EmptyState, Modal } from '@/components/ui'

type Order = OrderDoc & { id: string }

const TABS: { key: OrderStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
  { key: 'dispatched', label: 'Dispatched' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
]

const STATUS_TONE: Record<OrderStatus, 'green' | 'amber' | 'red' | 'gray' | 'blue' | 'brand'> = {
  new: 'amber',
  confirmed: 'blue',
  preparing: 'blue',
  ready: 'brand',
  dispatched: 'brand',
  delivered: 'green',
  cancelled: 'red',
}

export default function OrdersPage() {
  const { user } = useAuth()
  const businessId = user!.businessId!
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<OrderStatus | 'all'>('all')
  const [itemsOrder, setItemsOrder] = useState<Order | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'orders'), where('businessId', '==', businessId))
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderDoc) }))
      items.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
      setOrders(items)
      setLoading(false)
    })
    return unsub
  }, [businessId])

  const filtered = tab === 'all' ? orders : orders.filter((o) => o.status === tab)

  return (
    <div>
      <PageHeader title="Orders" subtitle={`${orders.length} total`} />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${
              tab === t.key ? 'bg-brand-600 text-white' : 'bg-white text-ink-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-10 text-center text-ink-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🧾"
          title="No orders yet"
          description="When a customer orders on WhatsApp or your storefront, it will show up here."
        />
      ) : (
        <Card className="divide-y divide-black/5">
          {filtered.map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-2 px-4 py-3.5">
              <Link to={`/dashboard/orders/${o.id}`} className="min-w-0 flex-1">
                <p className="font-semibold text-ink-900">{o.orderNumber}</p>
                <p className="text-xs text-ink-500">{o.createdAt?.toDate().toLocaleDateString() ?? '—'}</p>
              </Link>
              <button
                onClick={() => setItemsOrder(o)}
                className="shrink-0 rounded-full bg-cream-100 px-3 py-1.5 text-xs font-semibold text-ink-700"
              >
                🧾 {o.items.length} item{o.items.length === 1 ? '' : 's'}
              </button>
              <Link to={`/dashboard/orders/${o.id}`} className="shrink-0 text-right">
                <p className="font-semibold text-ink-900">Rs. {o.total.toLocaleString()}</p>
                <Badge tone={STATUS_TONE[o.status]}>{o.status}</Badge>
              </Link>
            </div>
          ))}
        </Card>
      )}

      <Modal open={!!itemsOrder} onClose={() => setItemsOrder(null)} title={itemsOrder ? `Items — ${itemsOrder.orderNumber}` : 'Items'}>
        {itemsOrder && (
          <div className="divide-y divide-black/5">
            {itemsOrder.items.map((item, i) => (
              <div key={i} className="flex justify-between py-2 text-sm">
                <div>
                  <p className="font-medium text-ink-900">{item.productNameSnapshot}</p>
                  {item.variantNameSnapshot && <p className="text-ink-500">{item.variantNameSnapshot}</p>}
                  <p className="text-ink-500">Qty {item.quantity}</p>
                </div>
                <p className="font-medium text-ink-900">Rs. {item.lineTotal.toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
