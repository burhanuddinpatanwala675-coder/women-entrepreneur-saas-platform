import { useEffect, useState } from 'react'
import { api, ApiError } from '@/api/client'
import type { AIStatus } from '@/api/types'
import { PageHeader } from '@/components/SellerLayout'
import { Banner, Button, Card, Input, Label } from '@/components/ui'

interface ProductContent {
  title: string
  description: string
  tags: string[]
  social_caption: string
}

export default function AIAssistantPage() {
  const [status, setStatus] = useState<AIStatus | null>(null)
  const [productName, setProductName] = useState('')
  const [keywords, setKeywords] = useState('')
  const [result, setResult] = useState<ProductContent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get<AIStatus>('/ai/status').then(setStatus)
  }, [])

  async function generate() {
    setError(null)
    setLoading(true)
    try {
      const content = await api.post<ProductContent>('/ai/generate-product-content', { product_name: productName, keywords })
      setResult(content)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="AI Assistant" subtitle="Let AI help write your product listings and captions" />

      {status && !status.configured && (
        <Card className="mb-5 border-brand-200 bg-brand-50 p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">✨</span>
            <div>
              <h2 className="font-semibold text-brand-700">AI Assistant needs to be connected</h2>
              <p className="mt-1 text-sm text-ink-700">{status.message}</p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="font-semibold text-ink-900">Generate product content</h2>
        <p className="mt-1 text-sm text-ink-500">
          Describe your product and get a ready-to-use title, description, tags, and a social media caption.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="ai-name">Product name or idea</Label>
            <Input id="ai-name" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="e.g. Black embroidered lawn suit" />
          </div>
          <div>
            <Label htmlFor="ai-keywords">Keywords (optional)</Label>
            <Input id="ai-keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="festive, cotton, handmade" />
          </div>
          {error && <Banner tone="danger">{error}</Banner>}
          <Button fullWidth loading={loading} disabled={!productName.trim() || !status?.configured} onClick={generate}>
            {status?.configured ? 'Generate content' : 'AI not connected yet'}
          </Button>
        </div>
      </Card>

      {result && (
        <Card className="mt-4 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Title</h3>
          <p className="mt-1 font-medium text-ink-900">{result.title}</p>
          <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide text-ink-500">Description</h3>
          <p className="mt-1 text-sm text-ink-700">{result.description}</p>
          <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide text-ink-500">Tags</h3>
          <p className="mt-1 text-sm text-ink-700">{result.tags.join(', ')}</p>
          <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide text-ink-500">Social caption</h3>
          <p className="mt-1 text-sm text-ink-700">{result.social_caption}</p>
        </Card>
      )}

      <div className="mt-6 grid grid-cols-1 gap-3 opacity-60 sm:grid-cols-2">
        {['Marketing captions', 'Instagram post ideas', 'WhatsApp marketing messages', 'Pricing suggestions'].map((f) => (
          <Card key={f} className="p-4">
            <p className="text-sm font-medium text-ink-700">{f}</p>
            <p className="text-xs text-ink-500">Coming soon</p>
          </Card>
        ))}
      </div>
    </div>
  )
}
