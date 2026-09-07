import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/firebase/client'
import type { BusinessDoc, CustomerDoc, OrderDoc, ProductDoc } from '@/firebase/types'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/SellerLayout'
import { Badge, Button, Card, StatCard } from '@/components/ui'

type Order = OrderDoc & { id: string }
type Customer = CustomerDoc & { id: string }
type Product = ProductDoc & { id: string }

type Range = 'today' | 'week' | 'month' | 'year' | 'all'

const RANGES: { key: Range; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
  { key: 'all', label: 'All time' },
]

/** Start of the selected window, or null for "all time" (no lower bound). */
function rangeStart(range: Range): Date | null {
  const now = new Date()
  switch (range) {
    case 'today': {
      const d = new Date(now)
      d.setHours(0, 0, 0, 0)
      return d
    }
    case 'week': {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      return d
    }
    case 'month': {
      const d = new Date(now)
      d.setMonth(d.getMonth() - 1)
      return d
    }
    case 'year': {
      const d = new Date(now)
      d.setFullYear(d.getFullYear() - 1)
      return d
    }
    case 'all':
      return null
  }
}

function withinRange(ts: { toMillis: () => number } | null | undefined, start: Date | null): boolean {
  if (!start) return true // "all time"
  if (!ts) return false
  return ts.toMillis() >= start.getTime()
}

export default function DashboardHome() {
  const { user } = useAuth()
  const businessId = user!.businessId!
  const [business, setBusiness] = useState<BusinessDoc | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<Range>('today')

  useEffect(() => {
    let loaded = { business: false, orders: false, customers: false, products: false }
    function maybeDone() {
      if (Object.values(loaded).every(Boolean)) setLoading(false)
    }

    const unsubs = [
      onSnapshot(doc(db, 'businesses', businessId), (snap) => {
        setBusiness(snap.exists() ? (snap.data() as BusinessDoc) : null)
        loaded.business = true
        maybeDone()
      }),
      onSnapshot(query(collection(db, 'orders'), where('businessId', '==', businessId)), (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderDoc) }))
        items.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
        setOrders(items)
        loaded.orders = true
        maybeDone()
      }),
      onSnapshot(query(collection(db, 'customers'), where('businessId', '==', businessId)), (snap) => {
        setCustomers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as CustomerDoc) })))
        loaded.customers = true
        maybeDone()
      }),
      onSnapshot(query(collection(db, 'products'), where('businessId', '==', businessId)), (snap) => {
        setProducts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProductDoc) })))
        loaded.products = true
        maybeDone()
      }),
    ]
    return () => unsubs.forEach((u) => u())
  }, [businessId])

  const start = useMemo(() => rangeStart(range), [range])
  const rangeOrders = useMemo(() => orders.filter((o) => withinRange(o.createdAt, start)), [orders, start])
  // A cancelled order isn't a real sale or a real order — excluded from both stats below,
  // same reasoning as the sales total.
  const rangeOrdersExcludingCancelled = useMemo(() => rangeOrders.filter((o) => o.status !== 'cancelled'), [rangeOrders])
  const rangeSales = useMemo(
    () => rangeOrdersExcludingCancelled.reduce((sum, o) => sum + o.total, 0),
    [rangeOrdersExcludingCancelled],
  )
  const newCustomersInRange = useMemo(() => customers.filter((c) => withinRange(c.createdAt, start)).length, [customers, start])
  // Deliberately NOT scoped to the selected range — this is "what needs your attention right
  // now", not a historical figure, so it always reflects the live backlog regardless of
  // which time window is selected above.
  const pendingOrders = useMemo(() => orders.filter((o) => o.status === 'new' || o.status === 'confirmed').length, [orders])
  // Cancelled orders are excluded here too — a seller who cancels an order shouldn't keep
  // seeing it front and center; it's still fully visible in Orders > Cancelled for records.
  const recentOrders = useMemo(() => orders.filter((o) => o.status !== 'cancelled').slice(0, 5), [orders])
  const outOfStockProducts = useMemo(() => products.filter((p) => p.status === 'out_of_stock'), [products])

  const checklist = [
    { done: products.length > 0, label: 'Add your first product', to: '/dashboard/products' },
    { done: !!business?.whatsappNumber, label: 'Set your WhatsApp number', to: '/dashboard/store' },
    { done: !!business?.logoUrl || !!business?.coverImageUrl, label: 'Customize your store look', to: '/dashboard/store' },
    { done: orders.length > 0, label: 'Share your store link and get your first order', to: '/dashboard/store' },
  ]
  const nextStep = checklist.find((c) => !c.done)

  if (loading) {
    return <div className="py-20 text-center text-ink-500">Loading your dashboard…</div>
  }

  return (
    <div>
      <PageHeader title={`Welcome back, ${user?.fullName.split(' ')[0]} 👋`} subtitle={business?.name} />

      {outOfStockProducts.length > 0 && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 border-red-200 bg-red-50 p-4">
          <div>
            <p className="text-sm font-semibold text-red-700">
              ⚠️ {outOfStockProducts.length} product{outOfStockProducts.length === 1 ? ' is' : 's are'} out of stock
            </p>
            <p className="text-sm text-ink-700">
              {outOfStockProducts
                .slice(0, 3)
                .map((p) => p.name)
                .join(', ')}
              {outOfStockProducts.length > 3 ? `, +${outOfStockProducts.length - 3} more` : ''}
            </p>
          </div>
          <Link to="/dashboard/products?filter=out_of_stock">
            <Button size="sm" variant="outline">
              Restock now
            </Button>
          </Link>
        </Card>
      )}

      {nextStep && (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 border-brand-200 bg-brand-50 p-4">
          <div>
            <p className="text-sm font-semibold text-brand-700">What should I do next?</p>
            <p className="text-sm text-ink-700">{nextStep.label}</p>
          </div>
          <Link to={nextStep.to}>
            <Button size="sm">Do it now</Button>
          </Link>
        </Card>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Overview</h2>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                range === r.key ? 'bg-brand-600 text-white' : 'bg-white text-ink-700'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total sales" value={`Rs. ${rangeSales.toLocaleString()}`} />
        <StatCard label="Orders" value={rangeOrdersExcludingCancelled.length} />
        <StatCard label="New customers" value={newCustomersInRange} />
        <StatCard label="Pending orders" value={pendingOrders} tone={pendingOrders > 0 ? 'amber' : 'brand'} />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-ink-500">Quick actions</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link to="/dashboard/products">
          <Card className="flex items-center gap-3 p-4 hover:shadow-md">
            <span className="text-2xl">📦</span>
            <span className="font-semibold text-ink-900">Add Product</span>
          </Card>
        </Link>
        <Link to="/dashboard/orders">
          <Card className="flex items-center gap-3 p-4 hover:shadow-md">
            <span className="text-2xl">📲</span>
            <span className="font-semibold text-ink-900">WhatsApp Orders</span>
          </Card>
        </Link>
        <Link to="/dashboard/vouchers">
          <Card className="flex items-center gap-3 p-4 hover:shadow-md">
            <span className="text-2xl">🎁</span>
            <span className="font-semibold text-ink-900">Create Voucher</span>
          </Card>
        </Link>
      </div>

      {recentOrders.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-ink-500">Recent orders</h2>
          <Card className="divide-y divide-black/5">
            {recentOrders.map((o) => (
              <Link key={o.id} to={`/dashboard/orders/${o.id}`} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium text-ink-900">{o.orderNumber}</p>
                  <p className="text-xs text-ink-500">{o.createdAt?.toDate().toLocaleDateString() ?? '—'}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-ink-900">Rs. {o.total.toLocaleString()}</p>
                  <Badge tone={statusTone(o.status)}>{o.status}</Badge>
                </div>
              </Link>
            ))}
          </Card>
        </>
      )}
    </div>
  )
}

function statusTone(status: OrderDoc['status']) {
  switch (status) {
    case 'new':
      return 'amber' as const
    case 'cancelled':
      return 'red' as const
    case 'delivered':
      return 'green' as const
    default:
      return 'blue' as const
  }
}
