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

function isToday(ts: { toDate: () => Date } | null | undefined) {
  if (!ts) return false
  const d = ts.toDate()
  const now = new Date()
  return d.toDateString() === now.toDateString()
}

export default function DashboardHome() {
  const { user } = useAuth()
  const businessId = user!.businessId!
  const [business, setBusiness] = useState<BusinessDoc | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

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

  const todayOrders = useMemo(() => orders.filter((o) => isToday(o.createdAt)), [orders])
  const todaySales = useMemo(
    () => todayOrders.filter((o) => o.status !== 'cancelled').reduce((sum, o) => sum + o.total, 0),
    [todayOrders],
  )
  const newCustomersToday = useMemo(() => customers.filter((c) => isToday(c.createdAt)).length, [customers])
  const pendingOrders = useMemo(() => orders.filter((o) => o.status === 'new' || o.status === 'confirmed').length, [orders])

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

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">Today's overview</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total sales" value={`Rs. ${todaySales.toLocaleString()}`} />
        <StatCard label="Orders" value={todayOrders.length} />
        <StatCard label="New customers" value={newCustomersToday} />
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

      {orders.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-ink-500">Recent orders</h2>
          <Card className="divide-y divide-black/5">
            {orders.slice(0, 5).map((o) => (
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
