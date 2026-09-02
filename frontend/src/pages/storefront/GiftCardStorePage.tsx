import { useState } from 'react'
import { api, ApiError } from '@/api/client'
import type { GiftCard } from '@/api/types'
import { Banner, Button, Card, Input, Label, Textarea } from '@/components/ui'
import { useStorefront } from './StorefrontContext'

const PRESETS = [500, 1000, 2000, 5000]

export default function GiftCardStorePage() {
  const { business, slug } = useStorefront()
  const [amount, setAmount] = useState(PRESETS[0].toString())
  const [customAmount, setCustomAmount] = useState('')
  const [senderName, setSenderName] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientContact, setRecipientContact] = useState('')
  const [message, setMessage] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<GiftCard | null>(null)

  async function submit() {
    setError(null)
    setSaving(true)
    try {
      const g = await api.post<GiftCard>(
        `/public/stores/${slug}/gift-cards/purchase`,
        {
          initial_balance: Number(customAmount || amount),
          sender_name: senderName || null,
          recipient_name: recipientName,
          recipient_contact: recipientContact,
          message: message || null,
          delivery_date: deliveryDate ? new Date(deliveryDate).toISOString() : null,
        },
        { auth: false },
      )
      setResult(g)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create this gift card')
    } finally {
      setSaving(false)
    }
  }

  if (result) {
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="text-5xl">🎁</p>
        <h1 className="mt-3 text-xl font-bold text-ink-900">Gift card created!</h1>
        <Card className="mt-5 overflow-hidden">
          <div className="bg-gradient-to-br from-brand-500 to-brand-700 p-5 text-white">
            <p className="text-xs uppercase tracking-wide opacity-80">{business.name} Gift Card</p>
            <p className="mt-2 font-mono text-2xl font-bold">{result.code}</p>
            <p className="mt-1 text-3xl font-bold">Rs. {result.initial_balance.toLocaleString()}</p>
          </div>
          <div className="p-4 text-left">
            <p className="text-sm text-ink-700">To: {result.recipient_name}</p>
            {result.message && <p className="mt-1 text-sm italic text-ink-500">"{result.message}"</p>}
          </div>
        </Card>
        <p className="mt-4 text-sm text-ink-500">Share this code with {result.recipient_name} — they can use it at checkout.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-center text-2xl font-bold text-ink-900">Send a Gift Card</h1>
      <p className="mt-1.5 text-center text-sm text-ink-500">Give the gift of {business.name}</p>

      <div className="mt-6 space-y-4">
        {error && <Banner tone="danger">{error}</Banner>}
        <div>
          <Label>Amount</Label>
          <div className="grid grid-cols-4 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => {
                  setAmount(p.toString())
                  setCustomAmount('')
                }}
                className={`rounded-xl border-2 py-2 text-sm font-semibold ${
                  amount === p.toString() && !customAmount ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-ink-300 text-ink-700'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <Input className="mt-2" type="number" placeholder="Custom amount" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="gs-sender">Your name</Label>
          <Input id="gs-sender" value={senderName} onChange={(e) => setSenderName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="gs-recipient">Recipient name</Label>
          <Input id="gs-recipient" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="gs-contact">Recipient phone or email</Label>
          <Input id="gs-contact" value={recipientContact} onChange={(e) => setRecipientContact(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="gs-message">Gift message (optional)</Label>
          <Textarea id="gs-message" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="gs-date">Delivery date (optional)</Label>
          <Input id="gs-date" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
        </div>
        <Button fullWidth size="lg" loading={saving} disabled={!recipientName.trim() || !recipientContact.trim()} onClick={submit}>
          Send this gift
        </Button>
      </div>
    </div>
  )
}
