import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/firebase/client'
import type { CustomerDoc } from '@/firebase/types'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/SellerLayout'
import { Card, EmptyState } from '@/components/ui'

type Customer = CustomerDoc & { id: string }

export default function CustomersPage() {
  const { user } = useAuth()
  const businessId = user!.businessId!
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'customers'), where('businessId', '==', businessId))
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as CustomerDoc) }))
      items.sort((a, b) => (b.lastOrderAt?.toMillis() ?? 0) - (a.lastOrderAt?.toMillis() ?? 0))
      setCustomers(items)
      setLoading(false)
    })
    return unsub
  }, [businessId])

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
                <p className="font-semibold text-ink-900">Rs. {c.totalSpent.toLocaleString()}</p>
                <p className="text-xs text-ink-500">{c.orderCount} order{c.orderCount === 1 ? '' : 's'}</p>
              </div>
            </Link>
          ))}
        </Card>
      )}
    </div>
  )
}
