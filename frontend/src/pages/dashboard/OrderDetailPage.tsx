import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/firebase/client'
import { getFirebaseErrorMessage } from '@/firebase/errors'
import type { CustomerDoc, OrderDoc, OrderStatus } from '@/firebase/types'
import { Badge, Banner, Button, Card } from '@/components/ui'

type Order = OrderDoc & { id: string }

const FLOW: OrderStatus[] = ['new', 'confirmed', 'preparing', 'ready', 'dispatched', 'delivered']

export default function OrderDetailPage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState<Order | null>(null)
  const [customer, setCustomer] = useState<CustomerDoc | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (!orderId) return
    const unsub = onSnapshot(doc(db, 'orders', orderId), (snap) => {
      if (snap.exists()) setOrder({ id: snap.id, ...(snap.data() as OrderDoc) })
    })
    return unsub
  }, [orderId])

  useEffect(() => {
    if (!order?.customerId) return
    getDoc(doc(db, 'customers', order.customerId)).then((snap) => {
      if (snap.exists()) setCustomer(snap.data() as CustomerDoc)
    })
  }, [order?.customerId])

  async function setStatus(status: OrderStatus) {
    if (!order) return
    setUpdating(true)
    setError(null)
    try {
      await updateDoc(doc(db, 'orders', order.id), { status, updatedAt: serverTimestamp() })
    } catch (err) {
      setError(getFirebaseErrorMessage(err))
    } finally {
      setUpdating(false)
    }
  }

  if (!order) return <p className="py-10 text-center text-ink-500">Loading…</p>

  const currentIndex = FLOW.indexOf(order.status)
  const nextStatus = order.status === 'cancelled' || order.status === 'delivered' ? null : FLOW[currentIndex + 1]

  return (
    <div className="mx-auto max-w-2xl">
      <button onClick={() => navigate('/dashboard/orders')} className="mb-4 text-sm font-medium text-ink-500">
        ← Back to orders
      </button>

      {error && (
        <div className="mb-4">
          <Banner tone="danger">{error}</Banner>
        </div>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-ink-900">{order.orderNumber}</h1>
            <p className="text-sm text-ink-500">{order.createdAt?.toDate().toLocaleString() ?? '—'}</p>
          </div>
          <Badge tone={order.status === 'cancelled' ? 'red' : order.status === 'delivered' ? 'green' : 'amber'}>{order.status}</Badge>
        </div>

        {customer && (
          <div className="mt-4 rounded-xl bg-cream-100 p-3">
            <p className="text-sm font-semibold text-ink-900">{customer.name}</p>
            <p className="text-sm text-ink-500">{customer.phone}</p>
          </div>
        )}

        <div className="mt-4 divide-y divide-black/5">
          {order.items.map((item, i) => (
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

        <div className="mt-3 space-y-1 border-t border-black/5 pt-3 text-sm">
          <div className="flex justify-between text-ink-500">
            <span>Subtotal</span>
            <span>Rs. {order.subtotal.toLocaleString()}</span>
          </div>
          {order.discountTotal > 0 && (
            <div className="flex justify-between text-ink-500">
              <span>Discount</span>
              <span>- Rs. {order.discountTotal.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-ink-900">
            <span>Total</span>
            <span>Rs. {order.total.toLocaleString()}</span>
          </div>
        </div>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="font-semibold text-ink-900">Order status</h2>
        <p className="mt-1 text-sm text-ink-500">Move this order forward as you fulfill it.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {nextStatus && (
            <Button loading={updating} onClick={() => setStatus(nextStatus)}>
              Mark as {nextStatus}
            </Button>
          )}
          {order.status !== 'cancelled' && order.status !== 'delivered' && (
            <Button variant="danger" loading={updating} onClick={() => setStatus('cancelled')}>
              Cancel order
            </Button>
          )}
        </div>
      </Card>

      {customer?.phone && (
        <a href={`https://wa.me/${customer.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="mt-4 block">
          <Button variant="outline" fullWidth>
            💬 Message customer on WhatsApp
          </Button>
        </a>
      )}

      <Link to="/dashboard/customers" className="mt-3 block text-center text-sm text-ink-500 underline">
        View customer history
      </Link>
    </div>
  )
}
