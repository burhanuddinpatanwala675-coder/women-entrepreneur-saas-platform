import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '@/api/client'
import type { Business, CategoryTree, Product } from '@/api/types'
import { useAuth } from '@/auth/AuthContext'
import { Banner, Button, Input, Label, Spinner, Textarea } from '@/components/ui'

const STEPS = ['Category', 'Business', 'Product', 'Done']

export default function OnboardingWizard() {
  const [step, setStep] = useState(0)
  const [categories, setCategories] = useState<CategoryTree[]>([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [business, setBusiness] = useState<Business | null>(null)
  const [product, setProduct] = useState<Product | null>(null)

  useEffect(() => {
    api
      .get<CategoryTree[]>('/categories')
      .then(setCategories)
      .finally(() => setLoadingCategories(false))
  }, [])

  return (
    <div className="min-h-screen bg-cream-50 px-5 py-6 sm:py-10">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="text-2xl">💗</span>
          <span className="text-lg font-bold text-ink-900">HerCommerce</span>
        </div>

        {/* Progress */}
        <div className="mb-8 flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 flex-col items-center gap-1.5">
              <div className={`h-1.5 w-full rounded-full ${i <= step ? 'bg-brand-600' : 'bg-ink-300/40'}`} />
              <span className={`text-xs ${i === step ? 'font-semibold text-brand-700' : 'text-ink-500'}`}>{label}</span>
            </div>
          ))}
        </div>

        {step === 0 && (
          <CategoryStep
            categories={categories}
            loading={loadingCategories}
            selected={categoryId}
            onSelect={setCategoryId}
            onNext={() => setStep(1)}
          />
        )}
        {step === 1 && categoryId && (
          <BusinessStep categoryId={categoryId} onBack={() => setStep(0)} onNext={(b) => { setBusiness(b); setStep(2) }} />
        )}
        {step === 2 && business && (
          <FirstProductStep
            business={business}
            onBack={() => setStep(1)}
            onNext={(p) => { setProduct(p); setStep(3) }}
            onSkip={() => setStep(3)}
          />
        )}
        {step === 3 && business && <DoneStep business={business} hasProduct={!!product} />}
      </div>
    </div>
  )
}

/* ---------------- Screen 1: What do you sell? ---------------- */
function CategoryStep({
  categories,
  loading,
  selected,
  onSelect,
  onNext,
}: {
  categories: CategoryTree[]
  loading: boolean
  selected: string | null
  onSelect: (id: string) => void
  onNext: () => void
}) {
  return (
    <div>
      <h1 className="text-center text-2xl font-bold text-ink-900">What do you sell?</h1>
      <p className="mt-1.5 text-center text-sm text-ink-500">Pick the category that best describes your business.</p>

      {loading ? (
        <div className="mt-10 flex justify-center">
          <Spinner className="text-brand-600" />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              className={`flex flex-col items-center gap-2 rounded-2xl border-2 bg-white p-4 text-center transition-colors ${
                selected === cat.id ? 'border-brand-600 bg-brand-50' : 'border-transparent hover:border-brand-200'
              }`}
            >
              <span className="text-3xl">{cat.icon}</span>
              <span className="text-sm font-semibold text-ink-900">{cat.name}</span>
            </button>
          ))}
        </div>
      )}

      <Button fullWidth size="lg" className="mt-8" disabled={!selected} onClick={onNext}>
        Continue
      </Button>
    </div>
  )
}

/* ---------------- Screen 2: Business info ---------------- */
function BusinessStep({ categoryId, onBack, onNext }: { categoryId: string; onBack: () => void; onNext: (b: Business) => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit() {
    setError(null)
    setLoading(true)
    try {
      const business = await api.post<Business>('/businesses', { name, short_description: description, category_id: categoryId })
      onNext(business)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create your business. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-center text-2xl font-bold text-ink-900">What is your business name?</h1>
      <p className="mt-1.5 text-center text-sm text-ink-500">This is what customers will see on your storefront.</p>

      <div className="mt-6 space-y-4">
        {error && <Banner tone="danger">{error}</Banner>}
        <div>
          <Label htmlFor="bizname">Business name</Label>
          <Input id="bizname" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ayesha's Lawn House" autoFocus />
        </div>
        <div>
          <Label htmlFor="bizdesc">Short description</Label>
          <Textarea
            id="bizdesc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Tell customers what makes your business special"
          />
        </div>
      </div>

      <div className="mt-8 flex gap-3">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button fullWidth disabled={!name.trim()} loading={loading} onClick={submit}>
          Continue
        </Button>
      </div>
    </div>
  )
}

/* ---------------- Screen 3: First product ---------------- */
function FirstProductStep({
  business,
  onBack,
  onNext,
  onSkip,
}: {
  business: Business
  onBack: () => void
  onNext: (p: Product) => void
  onSkip: () => void
}) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('1')
  const [description, setDescription] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function submit() {
    setError(null)
    setLoading(true)
    try {
      let images: { url: string; is_primary: boolean }[] = []
      if (imageFile) {
        const uploaded = await api.upload<{ url: string }>('/uploads/image', imageFile)
        images = [{ url: uploaded.url, is_primary: true }]
      }
      const product = await api.post<Product>('/products', {
        name,
        description,
        price: Number(price),
        stock_quantity: Number(stock) || 0,
        images,
      })
      onNext(product)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add your product. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-center text-2xl font-bold text-ink-900">Add your first product</h1>
      <p className="mt-1.5 text-center text-sm text-ink-500">You can add more products anytime from your dashboard.</p>

      <div className="mt-6 space-y-4">
        {error && <Banner tone="danger">{error}</Banner>}

        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ink-300 bg-white py-8">
          {imagePreview ? (
            <img src={imagePreview} alt="Preview" className="h-32 w-32 rounded-xl object-cover" />
          ) : (
            <>
              <span className="text-3xl">📸</span>
              <span className="mt-2 text-sm font-medium text-ink-700">Upload a photo</span>
            </>
          )}
          <input type="file" accept="image/*" className="hidden" onChange={onFileChange} />
        </label>

        <div>
          <Label htmlFor="pname">Product name</Label>
          <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Black Lawn Suit" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="pprice">Price (Rs.)</Label>
            <Input id="pprice" type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="4500" />
          </div>
          <div>
            <Label htmlFor="pstock">Stock quantity</Label>
            <Input id="pstock" type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="pdesc">Description (optional)</Label>
          <Textarea id="pdesc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
      </div>

      <div className="mt-8 flex gap-3">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button fullWidth disabled={!name.trim() || !price} loading={loading} onClick={submit}>
          Add product
        </Button>
      </div>
      <button onClick={onSkip} className="mt-4 w-full text-center text-sm text-ink-500 underline">
        Skip for now — I'll add products later
      </button>
      <p className="mt-1 text-center text-xs text-ink-300">{business.name}</p>
    </div>
  )
}

/* ---------------- Screen 4: Done ---------------- */
function DoneStep({ business, hasProduct }: { business: Business; hasProduct: boolean }) {
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const [finishing, setFinishing] = useState(false)
  const storeUrl = `${window.location.origin}${business.storefront_path}`

  async function goToDashboard() {
    setFinishing(true)
    try {
      await api.post('/businesses/me/complete-onboarding')
      await refreshUser()
      navigate('/dashboard', { replace: true })
    } finally {
      setFinishing(false)
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(storeUrl)
  }

  function shareOnWhatsApp() {
    const message = `Check out my store "${business.name}"! ${storeUrl}`
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
  }

  return (
    <div className="text-center">
      <div className="text-6xl">🎉</div>
      <h1 className="mt-4 text-2xl font-bold text-ink-900">Your store is ready!</h1>
      <p className="mt-1.5 text-sm text-ink-500">
        {hasProduct ? 'Your first product is live.' : 'You can add products anytime.'} Share your link and start selling.
      </p>

      <div className="mt-6 rounded-2xl bg-white p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Your storefront link</p>
        <p className="mt-1 break-all font-mono text-sm text-brand-700">{storeUrl}</p>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" fullWidth onClick={copyLink}>
            Copy link
          </Button>
          <Button fullWidth onClick={shareOnWhatsApp}>
            Share on WhatsApp
          </Button>
        </div>
      </div>

      <Button fullWidth size="lg" className="mt-8" loading={finishing} onClick={goToDashboard}>
        Go to my dashboard
      </Button>
    </div>
  )
}
