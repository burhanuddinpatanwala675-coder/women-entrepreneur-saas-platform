import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/api/client'
import type { Customer } from '@/api/types'
import { PageHeader } from '@/components/SellerLayout'
import { Card, EmptyState } from '@/components/ui'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<Customer[]>('/customers')
      .then(setCustomers)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <PageHeader title="Customers" subtitle={`${customers.length} customer${customers.length === 1 ? '' : 's'}`} />

      {loading ? (
        <p className="py-10 text-center text-ink-500">Loading…</p>
      ) : customers.length === 0 ? (
        <EmptyState icon="👥" title="No customers yet" description="Customers appear here automatically after their first order." />
      ) : (
        <Card className="divide-y divide-black/5">
          {customers.map((c) => (
            <Link key={c.id} to={`/dashboard/customers/${c.id}`} className="flex items-center justify-between px-4 py-3.5">
              <div>
                <p className="font-semibold text-ink-900">{c.name}</p>
                <p className="text-xs text-ink-500">{c.phone}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-ink-900">Rs. {c.total_spent.toLocaleString()}</p>
                <p className="text-xs text-ink-500">{c.order_count} order{c.order_count === 1 ? '' : 's'}</p>
              </div>
            </Link>
          ))}
        </Card>
      )}
    </div>
  )
}
