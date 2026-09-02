import { useEffect, useState } from 'react'
import { api, ApiError } from '@/api/client'
import type { Product, ProductStatus, ProductVariant } from '@/api/types'
import { PageHeader } from '@/components/SellerLayout'
import { Badge, Banner, Button, Card, EmptyState, Input, Label, Modal, Textarea } from '@/components/ui'

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

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ProductStatus | 'all'>('all')
  const [editing, setEditing] = useState<Product | 'new' | null>(null)

  function load() {
    setLoading(true)
    api
      .get<Product[]>('/products')
      .then(setProducts)
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const filtered = filter === 'all' ? products : products.filter((p) => p.status === filter)

  async function markSold(p: Product) {
    const updated = await api.post<Product>(`/products/${p.id}/mark-sold`)
    setProducts((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
  }
  async function reactivate(p: Product) {
    const updated = await api.post<Product>(`/products/${p.id}/reactivate`)
    setProducts((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
  }
  async function remove(p: Product) {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return
    await api.del(`/products/${p.id}`)
    setProducts((prev) => prev.filter((x) => x.id !== p.id))
  }

  return (
    <div>
      <PageHeader
        title="My Products"
        subtitle={`${products.length} product${products.length === 1 ? '' : 's'}`}
        action={<Button onClick={() => setEditing('new')}>+ Add Product</Button>}
      />

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
                    Rs. {(p.sale_price ?? p.price).toLocaleString()}
                    {p.sale_price && <span className="ml-1.5 text-xs text-ink-300 line-through">Rs. {p.price.toLocaleString()}</span>}
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
          product={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setProducts((prev) => (editing === 'new' ? [saved, ...prev] : prev.map((p) => (p.id === saved.id ? saved : p))))
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function ProductEditor({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: (p: Product) => void }) {
  const [name, setName] = useState(product?.name ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [price, setPrice] = useState(product?.price?.toString() ?? '')
  const [salePrice, setSalePrice] = useState(product?.sale_price?.toString() ?? '')
  const [sku, setSku] = useState(product?.sku ?? '')
  const [stock, setStock] = useState(product?.stock_quantity?.toString() ?? '0')
  const [tags, setTags] = useState(product?.tags?.join(', ') ?? '')
  const [images, setImages] = useState(product?.images ?? [])
  const [variants, setVariants] = useState<ProductVariant[]>(product?.variants ?? [])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onUploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const { url } = await api.upload<{ url: string }>('/uploads/image', file)
      if (product) {
        const updated = await api.post<Product>(`/products/${product.id}/images?url=${encodeURIComponent(url)}&is_primary=${images.length === 0}`)
        setImages(updated.images)
      } else {
        setImages((prev) => [...prev, { id: `local-${Date.now()}`, url, sort_order: prev.length, is_primary: prev.length === 0 }])
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload image')
    } finally {
      setUploading(false)
    }
  }

  function addVariantRow() {
    setVariants((prev) => [...prev, { id: `local-${Date.now()}`, name: '', option_values: {}, stock_quantity: 0 }])
  }

  async function save() {
    setError(null)
    setSaving(true)
    try {
      const payload = {
        name,
        description: description || null,
        price: Number(price),
        sale_price: salePrice ? Number(salePrice) : null,
        sku: sku || null,
        stock_quantity: Number(stock) || 0,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      }
      let saved: Product
      if (product) {
        saved = await api.patch<Product>(`/products/${product.id}`, payload)
      } else {
        saved = await api.post<Product>('/products', { ...payload, images: images.map((i) => ({ url: i.url, is_primary: i.is_primary })) })
      }

      // Sync variants for existing products (create new ones added in this session)
      if (product) {
        for (const v of variants) {
          if (v.id.startsWith('local-')) {
            await api.post(`/products/${product.id}/variants`, {
              name: v.name,
              option_values: v.option_values,
              price: v.price || null,
              stock_quantity: v.stock_quantity,
              sku: v.sku || null,
            })
          }
        }
        saved = await api.get<Product>(`/products/${product.id}`)
      }

      onSaved(saved)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save product')
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
            {images.map((img) => (
              <img key={img.id} src={img.url} className="h-16 w-16 rounded-lg object-cover" />
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

        {product && (
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
                    value={v.stock_quantity}
                    onChange={(e) =>
                      setVariants((prev) => prev.map((x, idx) => (idx === i ? { ...x, stock_quantity: Number(e.target.value) } : x)))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <Button fullWidth loading={saving} disabled={!name.trim() || !price} onClick={save}>
          {product ? 'Save changes' : 'Add product'}
        </Button>
      </div>
    </Modal>
  )
}

