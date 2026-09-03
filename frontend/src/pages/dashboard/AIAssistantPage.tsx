import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase/client'
import { PageHeader } from '@/components/SellerLayout'
import { Banner, Button, Card, Input, Label } from '@/components/ui'

interface AIConfigDoc {
  configured: boolean
  provider: string
}

export default function AIAssistantPage() {
  const [status, setStatus] = useState<AIConfigDoc | null>(null)
  const [productName, setProductName] = useState('')
  const [keywords, setKeywords] = useState('')

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'ai'), (snap) => {
      setStatus(snap.exists() ? (snap.data() as AIConfigDoc) : { configured: false, provider: 'none' })
    })
    return unsub
  }, [])

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="AI Assistant" subtitle="Let AI help write your product listings and captions" />

      {status && !status.configured && (
        <Card className="mb-5 border-brand-200 bg-brand-50 p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">✨</span>
            <div>
              <h2 className="font-semibold text-brand-700">AI Assistant isn't connected yet</h2>
              <p className="mt-1 text-sm text-ink-700">
                This feature needs a small piece of paid infrastructure (Firebase Cloud Functions) that this build
                deliberately doesn't use, to keep the whole platform completely free to run. The rest of the app
                doesn't need it — everything else works fully without a bill. This can be revisited later; see{' '}
                <code className="rounded bg-white px-1 py-0.5 text-xs">functions/README.md</code> for exactly what
                turning it on would involve.
              </p>
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
            <Input
              id="ai-name"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g. Black embroidered lawn suit"
              disabled
            />
          </div>
          <div>
            <Label htmlFor="ai-keywords">Keywords (optional)</Label>
            <Input
              id="ai-keywords"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="festive, cotton, handmade"
              disabled
            />
          </div>
          {status?.configured === false && <Banner tone="brand">Not connected yet — see the note above.</Banner>}
          <Button fullWidth disabled>
            AI not connected yet
          </Button>
        </div>
      </Card>

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
