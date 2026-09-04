import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/firebase/client'
import type { CustomerDoc, OrderDoc } from '@/firebase/types'
import { toWhatsappDigits } from '@/firebase/whatsapp'
import { Badge, Card } from '@/components/ui'

type Customer = CustomerDoc & { id: string }
type Order = OrderDoc & { id: string }

export default function CustomerDetailPage() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    if (!customerId) return
    getDoc(doc(db, 'customers', customerId)).then((snap) => {
      if (snap.exists()) setCustomer({ id: snap.id, ...(snap.data() as CustomerDoc) })
    })
  }, [customerId])

  useEffect(() => {
    if (!customerId) return
    const q = query(collection(db, 'orders'), where('customerId', '==', customerId))
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderDoc) }))
      items.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
      setOrders(items)
    })
    return unsub
  }, [customerId])

  if (!customer) return <p className="py-10 text-center text-ink-500">Loading…</p>

  return (
    <div className="mx-auto max-w-2xl">
      <button onClick={() => navigate('/dashboard/customers')} className="mb-4 text-sm font-medium text-ink-500">
        ← Back to customers
      </button>

      <Card className="p-5">
        <h1 className="text-xl font-bold text-ink-900">{customer.name}</h1>
        <p className="text-sm text-ink-500">{customer.phone}</p>
        {customer.email && <p className="text-sm text-ink-500">{customer.email}</p>}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-cream-100 p-3">
            <p className="text-xs text-ink-500">Total spent</p>
            <p className="text-lg font-bold text-ink-900">Rs. {customer.totalSpent.toLocaleString()}</p>
          </div>
          <div className="rounded-xl bg-cream-100 p-3">
            <p className="text-xs text-ink-500">Orders</p>
            <p className="text-lg font-bold text-ink-900">{customer.orderCount}</p>
          </div>
        </div>

        <a href={`https://wa.me/${toWhatsappDigits(customer.phone)}`} target="_blank" rel="noreferrer" className="mt-4 block">
          <button className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white">💬 Message on WhatsApp</button>
        </a>
      </Card>

      <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-ink-500">Order history</h2>
      <Card className="divide-y divide-black/5">
        {orders.map((o) => (
          <Link key={o.id} to={`/dashboard/orders/${o.id}`} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium text-ink-900">{o.orderNumber}</p>
              <p className="text-xs text-ink-500">{o.createdAt?.toDate().toLocaleDateString() ?? '—'}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-ink-900">Rs. {o.total.toLocaleString()}</p>
              <Badge tone="gray">{o.status}</Badge>
            </div>
          </Link>
        ))}
      </Card>
    </div>
  )
}
