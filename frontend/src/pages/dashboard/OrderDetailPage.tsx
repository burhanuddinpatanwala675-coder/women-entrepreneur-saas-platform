import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '@/api/client'
import type { Order, OrderStatus } from '@/api/types'
import { Badge, Banner, Button, Card } from '@/components/ui'

const FLOW: OrderStatus[] = ['new', 'confirmed', 'preparing', 'ready', 'dispatched', 'delivered']

export default function OrderDetailPage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState<Order | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (orderId) api.get<Order>(`/orders/${orderId}`).then(setOrder)
  }, [orderId])

  async function setStatus(status: OrderStatus) {
    if (!order) return
    setUpdating(true)
    setError(null)
    try {
      const updated = await api.patch<Order>(`/orders/${order.id}/status`, { status })
      setOrder(updated)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update order status')
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
            <h1 className="text-xl font-bold text-ink-900">{order.order_number}</h1>
            <p className="text-sm text-ink-500">{new Date(order.created_at).toLocaleString()}</p>
          </div>
          <Badge tone={order.status === 'cancelled' ? 'red' : order.status === 'delivered' ? 'green' : 'amber'}>{order.status}</Badge>
        </div>

        <div className="mt-4 rounded-xl bg-cream-100 p-3">
          <p className="text-sm font-semibold text-ink-900">{order.customer_name}</p>
          <p className="text-sm text-ink-500">{order.customer_phone}</p>
        </div>

        <div className="mt-4 divide-y divide-black/5">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between py-2 text-sm">
              <div>
                <p className="font-medium text-ink-900">{item.product_name_snapshot}</p>
                {item.variant_name_snapshot && <p className="text-ink-500">{item.variant_name_snapshot}</p>}
                <p className="text-ink-500">Qty {item.quantity}</p>
              </div>
              <p className="font-medium text-ink-900">Rs. {item.line_total.toLocaleString()}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 space-y-1 border-t border-black/5 pt-3 text-sm">
          <div className="flex justify-between text-ink-500">
            <span>Subtotal</span>
            <span>Rs. {order.subtotal.toLocaleString()}</span>
          </div>
          {order.discount_total > 0 && (
            <div className="flex justify-between text-ink-500">
              <span>Discount</span>
              <span>- Rs. {order.discount_total.toLocaleString()}</span>
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

      {order.customer_phone && (
        <a
          href={`https://wa.me/${order.customer_phone.replace(/\D/g, '')}`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 block"
        >
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
