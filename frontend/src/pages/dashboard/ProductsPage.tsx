import { useEffect, useState } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/firebase/client'
import { uploadImage } from '@/cloudinary/upload'
import { slugify } from '@/firebase/slugify'
import { getFirebaseErrorMessage } from '@/firebase/errors'
import type { ProductDoc, ProductImage, ProductStatus, ProductVariant } from '@/firebase/types'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/SellerLayout'
import { Badge, Banner, Button, Card, EmptyState, Input, Label, Modal, Textarea } from '@/components/ui'

type Product = ProductDoc & { id: string }

const STATUS_TONE: Record<ProductStatus, 'green' | 'amber' | 'red' | 'gray'> = {
  available: 'green',
  low_stock: 'amber',
  out_of_stock: 'red',
  sold: 'gray',
  hidden: 'gray',
}
const STATUS_LABEL: Record<ProductStatus, string> = {
  available: 'Available',
  low_stock: 'Low Stock',
  out_of_stock: 'Out of Stock',
  sold: 'Sold',
  hidden: 'Hidden',
}

function computeStockStatus(stock: number, lowStockThreshold: number): ProductStatus {
  if (stock <= 0) return 'out_of_stock'
  if (stock <= lowStockThreshold) return 'low_stock'
  return 'available'
}

export default function ProductsPage() {
  const { user } = useAuth()
  const businessId = user!.businessId!
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ProductStatus | 'all'>('all')
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'products'), where('businessId', '==', businessId))
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProductDoc) }))
        items.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
        setProducts(items)
        setLoading(false)
      },
      (err) => {
        setError(getFirebaseErrorMessage(err))
        setLoading(false)
      },
    )
    return unsub
  }, [businessId])

  const filtered = filter === 'all' ? products : products.filter((p) => p.status === filter)

  async function markSold(p: Product) {
    await updateDoc(doc(db, 'products', p.id), { status: 'sold', updatedAt: serverTimestamp() })
  }
  async function reactivate(p: Product) {
    await updateDoc(doc(db, 'products', p.id), {
      status: computeStockStatus(p.stockQuantity, p.lowStockThreshold),
      updatedAt: serverTimestamp(),
    })
  }
  async function remove(p: Product) {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return
    await deleteDoc(doc(db, 'products', p.id))
  }

  return (
    <div>
      <PageHeader
        title="My Products"
        subtitle={`${products.length} product${products.length === 1 ? '' : 's'}`}
        action={<Button onClick={() => setEditing('new')}>+ Add Product</Button>}
      />

      {error && (
        <div className="mb-4">
          <Banner tone="danger">{error}</Banner>
        </div>
      )}

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {(['all', 'available', 'low_stock', 'out_of_stock', 'sold', 'hidden'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${
              filter === s ? 'bg-brand-600 text-white' : 'bg-white text-ink-700'
            }`}
          >
            {s === 'all' ? 'All' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-10 text-center text-ink-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="📦"
          title="No products yet"
          description="Add your first product — a photo, a name, a price. That's all it takes."
          action={<Button onClick={() => setEditing('new')}>+ Add Product</Button>}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <button onClick={() => setEditing(p)} className="block w-full text-left">
                <div className="aspect-square w-full bg-cream-100">
                  {p.images[0] ? (
                    <img src={p.images[0].url} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-4xl">📷</div>
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-semibold text-ink-900">{p.name}</p>
                  <p className="mt-0.5 text-sm text-ink-700">
                    Rs. {(p.salePrice ?? p.price).toLocaleString()}
                    {p.salePrice && <span className="ml-1.5 text-xs text-ink-300 line-through">Rs. {p.price.toLocaleString()}</span>}
                  </p>
                  <Badge tone={STATUS_TONE[p.status]} className="mt-2">
                    {STATUS_LABEL[p.status]}
                  </Badge>
                </div>
              </button>
              <div className="flex gap-1 border-t border-black/5 p-2">
                {p.status === 'sold' ? (
                  <Button size="sm" variant="outline" fullWidth onClick={() => reactivate(p)}>
                    Reactivate
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" fullWidth onClick={() => markSold(p)}>
                    Mark as Sold
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => remove(p)}>
                  🗑️
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <ProductEditor
          businessId={businessId}
          product={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function ProductEditor({
  businessId,
  product,
  onClose,
  onSaved,
}: {
  businessId: string
  product: Product | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(product?.name ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [price, setPrice] = useState(product?.price?.toString() ?? '')
  const [salePrice, setSalePrice] = useState(product?.salePrice?.toString() ?? '')
  const [sku, setSku] = useState(product?.sku ?? '')
  const [stock, setStock] = useState(product?.stockQuantity?.toString() ?? '0')
  const [tags, setTags] = useState(product?.tags?.join(', ') ?? '')
  const [images, setImages] = useState<ProductImage[]>(product?.images ?? [])
  const [variants, setVariants] = useState<ProductVariant[]>(product?.variants ?? [])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onUploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const folder = `products/${businessId}/${product?.id ?? 'new-' + Date.now()}`
      const uploaded = await uploadImage(file, folder)
      setImages((prev) => [
        ...prev,
        { url: uploaded.url, cloudinaryPublicId: uploaded.publicId, sortOrder: prev.length, isPrimary: prev.length === 0 },
      ])
    } catch (err) {
      setError(getFirebaseErrorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx).map((img, i) => ({ ...img, sortOrder: i, isPrimary: i === 0 })))
  }

  function addVariantRow() {
    setVariants((prev) => [
      ...prev,
      { id: `v-${Date.now()}-${prev.length}`, name: '', optionValues: {}, price: null, stockQuantity: 0, sku: null },
    ])
  }

  async function save() {
    setError(null)
    setSaving(true)
    try {
      const stockNum = Number(stock) || 0
      const priceNum = Number(price)
      const preserveManualStatus = product && (product.status === 'sold' || product.status === 'hidden')
      const status: ProductStatus = preserveManualStatus ? product!.status : computeStockStatus(stockNum, product?.lowStockThreshold ?? 3)

      const payload = {
        businessId,
        categoryId: product?.categoryId ?? null,
        name,
        slug: product?.slug ?? slugify(name),
        description: description || null,
        price: priceNum,
        salePrice: salePrice ? Number(salePrice) : null,
        sku: sku || null,
        stockQuantity: stockNum,
        status,
        lowStockThreshold: product?.lowStockThreshold ?? 3,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        images,
        variants,
        updatedAt: serverTimestamp(),
      }

      if (product) {
        await updateDoc(doc(db, 'products', product.id), payload)
      } else {
        await setDoc(doc(collection(db, 'products')), { ...payload, createdAt: serverTimestamp() })
      }
      onSaved()
    } catch (err) {
      setError(getFirebaseErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={product ? 'Edit Product' : 'Add Product'} wide>
      <div className="space-y-4">
        {error && <Banner tone="danger">{error}</Banner>}

        <div>
          <Label>Photos</Label>
          <div className="flex flex-wrap gap-2">
            {images.map((img, i) => (
              <div key={img.cloudinaryPublicId || i} className="relative">
                <img src={img.url} className="h-16 w-16 rounded-lg object-cover" />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink-900 text-xs text-white"
                >
                  ✕
                </button>
              </div>
            ))}
            <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-ink-300 text-xl">
              {uploading ? '…' : '+'}
              <input type="file" accept="image/*" className="hidden" onChange={onUploadImage} disabled={uploading} />
            </label>
          </div>
        </div>

        <div>
          <Label htmlFor="e-name">Product name</Label>
          <Input id="e-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="e-desc">Description</Label>
          <Textarea id="e-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="e-price">Regular price (Rs.)</Label>
            <Input id="e-price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="e-sale">Sale price (optional)</Label>
            <Input id="e-sale" type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="e-stock">Stock quantity</Label>
            <Input id="e-stock" type="number" value={stock} onChange={(e) => setStock(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="e-sku">SKU (optional)</Label>
            <Input id="e-sku" value={sku} onChange={(e) => setSku(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="e-tags">Tags (comma separated)</Label>
          <Input id="e-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="lawn, black, festive" />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label className="mb-0">Variants (size, color, etc.)</Label>
            <button onClick={addVariantRow} className="text-sm font-semibold text-brand-600">
              + Add variant
            </button>
          </div>
          <div className="space-y-2">
            {variants.map((v, i) => (
              <div key={v.id} className="flex gap-2">
                <Input
                  placeholder="e.g. Medium / Black"
                  value={v.name}
                  onChange={(e) => setVariants((prev) => prev.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)))}
                />
                <Input
                  type="number"
                  placeholder="Stock"
                  className="w-24"
                  value={v.stockQuantity}
                  onChange={(e) =>
                    setVariants((prev) => prev.map((x, idx) => (idx === i ? { ...x, stockQuantity: Number(e.target.value) } : x)))
                  }
                />
                <Button size="sm" variant="ghost" onClick={() => setVariants((prev) => prev.filter((_, idx) => idx !== i))}>
                  ✕
                </Button>
              </div>
            ))}
          </div>
        </div>

        <Button fullWidth loading={saving} disabled={!name.trim() || !price} onClick={save}>
          {product ? 'Save changes' : 'Add product'}
        </Button>
      </div>
    </Modal>
  )
}
