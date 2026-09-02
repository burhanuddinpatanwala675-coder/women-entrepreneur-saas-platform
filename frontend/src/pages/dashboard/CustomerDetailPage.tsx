import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '@/api/client'
import type { CustomerDetail } from '@/api/types'
import { Badge, Card } from '@/components/ui'

export default function CustomerDetailPage() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<CustomerDetail | null>(null)

  useEffect(() => {
    if (customerId) api.get<CustomerDetail>(`/customers/${customerId}`).then(setCustomer)
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
            <p className="text-lg font-bold text-ink-900">Rs. {customer.total_spent.toLocaleString()}</p>
          </div>
          <div className="rounded-xl bg-cream-100 p-3">
            <p className="text-xs text-ink-500">Orders</p>
            <p className="text-lg font-bold text-ink-900">{customer.order_count}</p>
          </div>
        </div>

        <a href={`https://wa.me/${customer.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="mt-4 block">
          <button className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white">💬 Message on WhatsApp</button>
        </a>
      </Card>

      <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-ink-500">Order history</h2>
      <Card className="divide-y divide-black/5">
        {customer.orders.map((o) => (
          <Link key={o.id} to={`/dashboard/orders/${o.id}`} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium text-ink-900">{o.order_number}</p>
              <p className="text-xs text-ink-500">{new Date(o.created_at).toLocaleDateString()}</p>
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
