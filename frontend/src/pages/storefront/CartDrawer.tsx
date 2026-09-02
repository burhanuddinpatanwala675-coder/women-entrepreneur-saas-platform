import { useState } from 'react'
import { useCart, lineKey } from '@/cart/CartContext'
import { api, ApiError } from '@/api/client'
import type { Order } from '@/api/types'
import { Banner, Button, Input, Label, Modal } from '@/components/ui'
import { useStorefront } from './StorefrontContext'

export function CartFab({ onClick }: { onClick: () => void }) {
  const { count } = useCart()
  if (count === 0) return null
  return (
    <button
      onClick={onClick}
      className="fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full bg-brand-600 px-5 py-3.5 font-semibold text-white shadow-lg"
    >
      🛒 <span>{count}</span>
    </button>
  )
}

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lines, subtotal, updateQuantity, removeLine, clear } = useCart()
  const { slug } = useStorefront()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [voucherCode, setVoucherCode] = useState('')
  const [giftCardCode, setGiftCardCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [placing, setPlacing] = useState(false)
  const [result, setResult] = useState<{ order: Order; whatsapp_link?: string } | null>(null)

  async function placeOrder() {
    setError(null)
    setPlacing(true)
    try {
      const res = await api.post<{ order: Order; whatsapp_link?: string }>(
        `/public/stores/${slug}/orders`,
        {
          customer: { name, phone },
          items: lines.map((l) => ({ product_id: l.product.id, product_variant_id: l.variant?.id, quantity: l.quantity })),
          channel: 'whatsapp',
          voucher_code: voucherCode || undefined,
          gift_card_code: giftCardCode || undefined,
        },
        { auth: false },
      )
      setResult(res)
      clear()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not place your order. Please try again.')
    } finally {
      setPlacing(false)
    }
  }

  function closeAndReset() {
    setResult(null)
    onClose()
  }

  if (!open) return null

  if (result) {
    return (
      <Modal open onClose={closeAndReset} title="Order placed! 🎉">
        <div className="text-center">
          <p className="text-sm text-ink-700">
            Your order <span className="font-semibold">{result.order.order_number}</span> has been sent to the seller.
          </p>
          <p className="mt-1 text-lg font-bold text-ink-900">Total: Rs. {result.order.total.toLocaleString()}</p>
          {result.whatsapp_link && (
            <a href={result.whatsapp_link} target="_blank" rel="noreferrer" className="mt-4 block">
              <Button fullWidth>💬 Confirm on WhatsApp</Button>
            </a>
          )}
          <Button variant="outline" fullWidth className="mt-2" onClick={closeAndReset}>
            Continue shopping
          </Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open onClose={onClose} title="Your cart">
      {lines.length === 0 ? (
        <p className="py-8 text-center text-ink-500">Your cart is empty.</p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            {lines.map((l) => {
              const key = lineKey(l.product.id, l.variant?.id)
              const price = l.variant?.price ?? l.product.sale_price ?? l.product.price
              return (
                <div key={key} className="flex items-center gap-3">
                  {l.product.images[0] && <img src={l.product.images[0].url} className="h-14 w-14 rounded-lg object-cover" />}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink-900">{l.product.name}</p>
                    {l.variant && <p className="text-xs text-ink-500">{l.variant.name}</p>}
                    <p className="text-xs text-ink-500">Rs. {price.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQuantity(key, l.quantity - 1)} className="tap-target rounded-full bg-cream-100 px-2.5">
                      −
                    </button>
                    <span className="w-5 text-center text-sm">{l.quantity}</span>
                    <button onClick={() => updateQuantity(key, l.quantity + 1)} className="tap-target rounded-full bg-cream-100 px-2.5">
                      +
                    </button>
                  </div>
                  <button onClick={() => removeLine(key)} className="text-ink-300">
                    ✕
                  </button>
                </div>
              )
            })}
          </div>

          <div className="flex justify-between border-t border-black/5 pt-3 text-base font-bold text-ink-900">
            <span>Subtotal</span>
            <span>Rs. {subtotal.toLocaleString()}</span>
          </div>

          {error && <Banner tone="danger">{error}</Banner>}

          <div className="space-y-3 border-t border-black/5 pt-3">
            <div>
              <Label htmlFor="c-name">Your name</Label>
              <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="c-phone">Phone number</Label>
              <Input id="c-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03xxxxxxxxx" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Voucher code" value={voucherCode} onChange={(e) => setVoucherCode(e.target.value.toUpperCase())} />
              <Input placeholder="Gift card code" value={giftCardCode} onChange={(e) => setGiftCardCode(e.target.value.toUpperCase())} />
            </div>
          </div>

          <Button fullWidth size="lg" loading={placing} disabled={!name.trim() || !phone.trim()} onClick={placeOrder}>
            Order on WhatsApp
          </Button>
        </div>
      )}
    </Modal>
  )
}
