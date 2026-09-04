import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore'
import { db } from '@/firebase/client'
import { placeOrder, CheckoutError } from '@/firebase/checkout'
import { getFirebaseErrorMessage } from '@/firebase/errors'
import { buildWhatsappOrderLink } from '@/firebase/whatsapp'
import type { OrderItem, ProductDoc, ProductVariant } from '@/firebase/types'
import { useCart, type StoreProduct } from '@/cart/CartContext'
import { Badge, Banner, Button, Input, Label, Modal } from '@/components/ui'
import { useStorefront } from './StorefrontContext'

type Product = ProductDoc & { id: string }

export default function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>()
  const { slug } = useStorefront()
  const { addToCart } = useCart()
  const [product, setProduct] = useState<Product | null>(null)
  const [related, setRelated] = useState<Product[]>([])
  const [activeImage, setActiveImage] = useState(0)
  const [variant, setVariant] = useState<ProductVariant | undefined>(undefined)
  const [quantity, setQuantity] = useState(1)
  const [quickBuyOpen, setQuickBuyOpen] = useState(false)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    if (!slug || !productId) return
    getDoc(doc(db, 'products', productId)).then(async (snap) => {
      if (!snap.exists()) return
      const p = { id: snap.id, ...(snap.data() as ProductDoc) }
      setProduct(p)
      setVariant(p.variants[0])

      if (p.categoryId) {
        const relSnap = await getDocs(
          query(collection(db, 'products'), where('businessId', '==', slug), where('categoryId', '==', p.categoryId), limit(5)),
        )
        setRelated(
          relSnap.docs
            .map((d) => ({ id: d.id, ...(d.data() as ProductDoc) }))
            .filter((rp) => rp.id !== p.id && rp.status !== 'hidden')
            .slice(0, 4),
        )
      }
    })
  }, [slug, productId])

  if (!product) return <p className="py-10 text-center text-ink-500">Loading…</p>

  const price = variant?.price ?? product.salePrice ?? product.price
  const isOrderable = product.status !== 'sold' && product.status !== 'out_of_stock' && product.status !== 'hidden'
  const outOfStock = variant ? variant.stockQuantity <= 0 : !isOrderable

  function handleAddToCart() {
    if (!product) return
    addToCart(product as StoreProduct, variant, quantity)
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
            {!isOrderable && (
              <div className="absolute right-3 top-3">
                <Badge tone="red">SOLD OUT</Badge>
              </div>
            )}
          </div>
          {product.images.length > 1 && (
            <div className="mt-2 flex gap-2">
              {product.images.map((img, i) => (
                <button
                  key={img.cloudinaryPublicId || i}
                  onClick={() => setActiveImage(i)}
                  className={`h-14 w-14 overflow-hidden rounded-lg border-2 ${i === activeImage ? 'border-brand-600' : 'border-transparent'}`}
                >
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
            {product.salePrice && <p className="text-sm text-ink-300 line-through">Rs. {product.price.toLocaleString()}</p>}
          </div>

          {!isOrderable ? (
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
                    disabled={v.stockQuantity <= 0}
                    className={`rounded-xl border-2 px-3 py-2 text-sm font-medium disabled:opacity-40 ${
                      variant?.id === v.id ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-ink-300 text-ink-700'
                    }`}
                  >
                    {v.name}
                    {v.stockQuantity <= 0 && ' (Sold out)'}
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

      {related.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">You may also like</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {related.map((rp) => (
              <Link key={rp.id} to={`/store/${slug}/product/${rp.id}`} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="aspect-square w-full bg-cream-100">
                  {rp.images[0] && <img src={rp.images[0].url} className="h-full w-full object-cover" />}
                </div>
                <div className="p-2">
                  <p className="truncate text-xs font-medium text-ink-900">{rp.name}</p>
                  <p className="text-xs text-ink-700">Rs. {(rp.salePrice ?? rp.price).toLocaleString()}</p>
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
          businessId={slug}
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
  businessId,
  onClose,
}: {
  product: Product
  variant?: ProductVariant
  quantity: number
  businessId: string
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const { business } = useStorefront()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    orderNumber: string
    subtotal: number
    deliveryFee: number
    total: number
    items: OrderItem[]
  } | null>(null)

  const unitPrice = variant?.price ?? product.salePrice ?? product.price
  const subtotal = unitPrice * quantity
  const deliveryFee = business.storeSettings.deliveryFee ?? 0

  async function submit() {
    setError(null)
    setLoading(true)
    try {
      const res = await placeOrder({
        businessId,
        items: [{ productId: product.id, variantId: variant?.id, quantity }],
        customerName: name,
        customerPhone: phone,
        channel: 'whatsapp',
      })
      setResult({ orderNumber: res.orderNumber, subtotal: res.subtotal, deliveryFee: res.deliveryFee, total: res.total, items: res.items })
    } catch (err) {
      setError(err instanceof CheckoutError ? err.message : getFirebaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const whatsappLink = result
    ? buildWhatsappOrderLink(
        business.whatsappNumber,
        { orderNumber: result.orderNumber, items: result.items, subtotal: result.subtotal, deliveryFee: result.deliveryFee, total: result.total },
        name,
      )
    : null

  return (
    <Modal open onClose={onClose} title={result ? 'Order placed! 🎉' : 'Order on WhatsApp'}>
      {result ? (
        <div className="text-center">
          <p className="text-sm text-ink-700">
            Order <span className="font-semibold">{result.orderNumber}</span> — Rs. {result.total.toLocaleString()}
          </p>
          {result.deliveryFee > 0 && (
            <p className="mt-1 text-xs text-ink-500">
              Subtotal: Rs. {result.subtotal.toLocaleString()} + Delivery: Rs. {result.deliveryFee.toLocaleString()}
            </p>
          )}
          {whatsappLink && (
            <a href={whatsappLink} target="_blank" rel="noreferrer" className="mt-4 block">
              <Button fullWidth>💬 Confirm on WhatsApp</Button>
            </a>
          )}
          <Button variant={whatsappLink ? 'outline' : 'primary'} fullWidth className="mt-2" onClick={onClose}>
            Done
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-ink-500">
            <p>
              {product.name} {variant ? `(${variant.name})` : ''} × {quantity}
            </p>
            {deliveryFee > 0 && (
              <p className="mt-1">
                Rs. {subtotal.toLocaleString()} + Rs. {deliveryFee.toLocaleString()} delivery = Rs. {(subtotal + deliveryFee).toLocaleString()}
              </p>
            )}
          </div>
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
            Place order
          </Button>
        </div>
      )}
    </Modal>
  )
}
