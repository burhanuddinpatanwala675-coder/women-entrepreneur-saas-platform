import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '@/api/client'
import type { Order, ProductVariant, PublicProductDetail } from '@/api/types'
import { useCart } from '@/cart/CartContext'
import { Badge, Banner, Button, Input, Label, Modal } from '@/components/ui'
import { useStorefront } from './StorefrontContext'

export default function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>()
  const { slug } = useStorefront()
  const { addToCart } = useCart()
  const [product, setProduct] = useState<PublicProductDetail | null>(null)
  const [activeImage, setActiveImage] = useState(0)
  const [variant, setVariant] = useState<ProductVariant | undefined>(undefined)
  const [quantity, setQuantity] = useState(1)
  const [quickBuyOpen, setQuickBuyOpen] = useState(false)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    if (!slug || !productId) return
    api.get<PublicProductDetail>(`/public/stores/${slug}/products/${productId}`, { auth: false }).then((p) => {
      setProduct(p)
      setVariant(p.variants[0])
    })
  }, [slug, productId])

  if (!product) return <p className="py-10 text-center text-ink-500">Loading…</p>

  const price = variant?.price ?? product.sale_price ?? product.price
  const outOfStock = variant ? variant.stock_quantity <= 0 : !product.is_orderable

  function handleAddToCart() {
    if (!product) return
    addToCart(product, variant, quantity)
    setAdded(true)
    setTimeout(() => setAdded(false), 1800)
  }

  return (
    <div>
      <Link to={`/store/${slug}`} className="mb-4 inline-block text-sm font-medium text-ink-500">
        ← Back to store
      </Link>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-cream-100">
            {product.images[activeImage] ? (
              <img src={product.images[activeImage].url} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-6xl">📷</div>
            )}
            {!product.is_orderable && (
              <div className="absolute right-3 top-3">
                <Badge tone="red">SOLD OUT</Badge>
              </div>
            )}
          </div>
          {product.images.length > 1 && (
            <div className="mt-2 flex gap-2">
              {product.images.map((img, i) => (
                <button key={img.id} onClick={() => setActiveImage(i)} className={`h-14 w-14 overflow-hidden rounded-lg border-2 ${i === activeImage ? 'border-brand-600' : 'border-transparent'}`}>
                  <img src={img.url} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="text-2xl font-bold text-ink-900">{product.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-xl font-bold text-brand-700">Rs. {price.toLocaleString()}</p>
            {product.sale_price && <p className="text-sm text-ink-300 line-through">Rs. {product.price.toLocaleString()}</p>}
          </div>

          {!product.is_orderable ? (
            <Badge tone="red" className="mt-2">
              SOLD OUT
            </Badge>
          ) : (
            <Badge tone="green" className="mt-2">
              In stock
            </Badge>
          )}

          {product.description && <p className="mt-4 text-sm leading-relaxed text-ink-700">{product.description}</p>}

          {product.variants.length > 0 && (
            <div className="mt-4">
              <Label>Choose an option</Label>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setVariant(v)}
                    disabled={v.stock_quantity <= 0}
                    className={`rounded-xl border-2 px-3 py-2 text-sm font-medium disabled:opacity-40 ${
                      variant?.id === v.id ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-ink-300 text-ink-700'
                    }`}
                  >
                    {v.name}
                    {v.stock_quantity <= 0 && ' (Sold out)'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <Label className="mb-0">Quantity</Label>
            <div className="flex items-center gap-3 rounded-xl bg-cream-100 px-3 py-1.5">
              <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="tap-target px-1 text-lg">
                −
              </button>
              <span className="w-6 text-center">{quantity}</span>
              <button onClick={() => setQuantity((q) => q + 1)} className="tap-target px-1 text-lg">
                +
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <Button size="lg" variant="outline" disabled={outOfStock} onClick={handleAddToCart}>
              {added ? 'Added ✓' : 'Add to Cart'}
            </Button>
            <Button size="lg" disabled={outOfStock} onClick={() => setQuickBuyOpen(true)}>
              {outOfStock ? 'Sold Out' : 'Buy / Order on WhatsApp'}
            </Button>
          </div>
        </div>
      </div>

      {product.related_products.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">You may also like</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {product.related_products.map((rp) => (
              <Link key={rp.id} to={`/store/${slug}/product/${rp.id}`} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="aspect-square w-full bg-cream-100">
                  {rp.images[0] && <img src={rp.images[0].url} className="h-full w-full object-cover" />}
                </div>
                <div className="p-2">
                  <p className="truncate text-xs font-medium text-ink-900">{rp.name}</p>
                  <p className="text-xs text-ink-700">Rs. {(rp.sale_price ?? rp.price).toLocaleString()}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {quickBuyOpen && (
        <QuickBuyModal
          product={product}
          variant={variant}
          quantity={quantity}
          slug={slug}
          onClose={() => setQuickBuyOpen(false)}
        />
      )}
    </div>
  )
}

function QuickBuyModal({
  product,
  variant,
  quantity,
  slug,
  onClose,
}: {
  product: PublicProductDetail
  variant?: ProductVariant
  quantity: number
  slug: string
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ order: Order; whatsapp_link?: string } | null>(null)

  async function submit() {
    setError(null)
    setLoading(true)
    try {
      const res = await api.post<{ order: Order; whatsapp_link?: string }>(
        `/public/stores/${slug}/orders`,
        {
          customer: { name, phone },
          items: [{ product_id: product.id, product_variant_id: variant?.id, quantity }],
          channel: 'whatsapp',
        },
        { auth: false },
      )
      setResult(res)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not place your order')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={result ? 'Order placed! 🎉' : 'Order on WhatsApp'}>
      {result ? (
        <div className="text-center">
          <p className="text-sm text-ink-700">
            Order <span className="font-semibold">{result.order.order_number}</span> — Rs. {result.order.total.toLocaleString()}
          </p>
          {result.whatsapp_link && (
            <a href={result.whatsapp_link} target="_blank" rel="noreferrer" className="mt-4 block">
              <Button fullWidth>💬 Confirm on WhatsApp</Button>
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-ink-500">
            {product.name} {variant ? `(${variant.name})` : ''} × {quantity}
          </p>
          {error && <Banner tone="danger">{error}</Banner>}
          <div>
            <Label htmlFor="qb-name">Your name</Label>
            <Input id="qb-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="qb-phone">Phone number</Label>
            <Input id="qb-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03xxxxxxxxx" />
          </div>
          <Button fullWidth loading={loading} disabled={!name.trim() || !phone.trim()} onClick={submit}>
            Continue to WhatsApp
          </Button>
        </div>
      )}
    </Modal>
  )
}
