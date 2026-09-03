import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/firebase/client'
import { createGiftCard } from '@/firebase/giftcards'
import { getFirebaseErrorMessage } from '@/firebase/errors'
import type { GiftCardDoc } from '@/firebase/types'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/SellerLayout'
import { Badge, Banner, Button, Card, EmptyState, Input, Label, Modal, Textarea } from '@/components/ui'

type GiftCard = GiftCardDoc & { id: string }

const PRESETS = [500, 1000, 2000, 5000]

export default function GiftCardsPage() {
  const { user } = useAuth()
  const businessId = user!.businessId!
  const [cards, setCards] = useState<GiftCard[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'giftCards'), where('businessId', '==', businessId))
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as GiftCardDoc) }))
      items.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
      setCards(items)
      setLoading(false)
    })
    return unsub
  }, [businessId])

  return (
    <div>
      <PageHeader title="Gift Cards" subtitle="Issue digital gift cards for your customers" action={<Button onClick={() => setCreating(true)}>+ Create Gift Card</Button>} />

      {loading ? (
        <p className="py-10 text-center text-ink-500">Loading…</p>
      ) : cards.length === 0 ? (
        <EmptyState
          icon="🎁"
          title="No gift cards yet"
          description="Create a digital gift card someone can send to a friend or family member."
          action={<Button onClick={() => setCreating(true)}>+ Create Gift Card</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {cards.map((g) => (
            <Card key={g.id} className="overflow-hidden">
              <div className="bg-gradient-to-br from-brand-500 to-brand-700 p-4 text-white">
                <p className="text-xs uppercase tracking-wide opacity-80">Gift Card</p>
                <p className="mt-1 font-mono text-xl font-bold">{g.code}</p>
                <p className="mt-1 text-2xl font-bold">Rs. {g.currentBalance.toLocaleString()}</p>
              </div>
              <div className="p-4">
                <p className="text-sm text-ink-700">To: {g.recipientName}</p>
                <p className="text-sm text-ink-500">{g.recipientContact}</p>
                {g.message && <p className="mt-1 text-sm italic text-ink-500">"{g.message}"</p>}
                <Badge tone={g.status === 'active' ? 'green' : 'gray'} className="mt-2">
                  {g.status}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      {creating && <GiftCardForm businessId={businessId} onClose={() => setCreating(false)} onCreated={() => setCreating(false)} />}
    </div>
  )
}

function GiftCardForm({ businessId, onClose, onCreated }: { businessId: string; onClose: () => void; onCreated: () => void }) {
  const [amount, setAmount] = useState(PRESETS[0].toString())
  const [customAmount, setCustomAmount] = useState('')
  const [sender, setSender] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientContact, setRecipientContact] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit() {
    setError(null)
    setSaving(true)
    try {
      await createGiftCard({
        businessId,
        initialBalance: Number(customAmount || amount),
        senderName: sender || null,
        recipientName,
        recipientContact,
        message: message || null,
        deliveryDate: null,
        expiresAt: null,
      })
      onCreated()
    } catch (err) {
      setError(getFirebaseErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Create Gift Card">
      <div className="space-y-4">
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
          <Input
            className="mt-2"
            type="number"
            placeholder="Or enter a custom amount"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="g-sender">Sender name (optional)</Label>
          <Input id="g-sender" value={sender} onChange={(e) => setSender(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="g-recipient">Recipient name</Label>
          <Input id="g-recipient" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="g-contact">Recipient phone or email</Label>
          <Input id="g-contact" value={recipientContact} onChange={(e) => setRecipientContact(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="g-message">Gift message (optional)</Label>
          <Textarea id="g-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={2} />
        </div>
        <Button fullWidth loading={saving} disabled={!recipientName.trim() || !recipientContact.trim()} onClick={submit}>
          Create gift card
        </Button>
      </div>
    </Modal>
  )
}
