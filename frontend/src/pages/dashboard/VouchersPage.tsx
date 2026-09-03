import { useEffect, useState } from 'react'
import { collection, deleteDoc, doc, onSnapshot, query, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore'
import { db } from '@/firebase/client'
import { getFirebaseErrorMessage } from '@/firebase/errors'
import type { VoucherDoc } from '@/firebase/types'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/SellerLayout'
import { Badge, Banner, Button, Card, EmptyState, Input, Label, Modal, Select } from '@/components/ui'

type Voucher = VoucherDoc & { id: string }

export default function VouchersPage() {
  const { user } = useAuth()
  const businessId = user!.businessId!
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'vouchers'), where('businessId', '==', businessId))
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as VoucherDoc) }))
      items.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
      setVouchers(items)
      setLoading(false)
    })
    return unsub
  }, [businessId])

  async function toggleActive(v: Voucher) {
    try {
      await updateDoc(doc(db, 'vouchers', v.id), { isActive: !v.isActive })
    } catch (err) {
      setError(getFirebaseErrorMessage(err))
    }
  }

  async function remove(v: Voucher) {
    if (!confirm(`Delete voucher "${v.code}"?`)) return
    await deleteDoc(doc(db, 'vouchers', v.id))
  }

  return (
    <div>
      <PageHeader title="Vouchers" subtitle="Discount codes for your customers" action={<Button onClick={() => setCreating(true)}>+ Create Voucher</Button>} />

      {error && (
        <div className="mb-4">
          <Banner tone="danger">{error}</Banner>
        </div>
      )}

      {loading ? (
        <p className="py-10 text-center text-ink-500">Loading…</p>
      ) : vouchers.length === 0 ? (
        <EmptyState
          icon="🏷️"
          title="No vouchers yet"
          description="Create a discount code like WELCOME10 to encourage first orders."
          action={<Button onClick={() => setCreating(true)}>+ Create Voucher</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {vouchers.map((v) => (
            <Card key={v.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-lg font-bold text-brand-700">{v.code}</p>
                  <p className="text-sm text-ink-500">
                    {v.discountType === 'percentage' ? `${v.discountValue}% off` : `Rs. ${v.discountValue.toLocaleString()} off`}
                    {v.minPurchaseAmount ? ` · min Rs. ${v.minPurchaseAmount.toLocaleString()}` : ''}
                  </p>
                </div>
                <Badge tone={v.isActive ? 'green' : 'gray'}>{v.isActive ? 'Active' : 'Paused'}</Badge>
              </div>
              <p className="mt-2 text-xs text-ink-500">
                Used {v.timesUsed}{v.usageLimit ? ` / ${v.usageLimit}` : ''} times
                {v.expiresAt ? ` · expires ${v.expiresAt.toDate().toLocaleDateString()}` : ''}
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" fullWidth onClick={() => toggleActive(v)}>
                  {v.isActive ? 'Pause' : 'Activate'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(v)}>
                  🗑️
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {creating && <VoucherForm businessId={businessId} onClose={() => setCreating(false)} onCreated={() => setCreating(false)} />}
    </div>
  )
}

function VoucherForm({ businessId, onClose, onCreated }: { businessId: string; onClose: () => void; onCreated: () => void }) {
  const [code, setCode] = useState('')
  const [type, setType] = useState<'percentage' | 'fixed'>('percentage')
  const [value, setValue] = useState('')
  const [minPurchase, setMinPurchase] = useState('')
  const [maxDiscount, setMaxDiscount] = useState('')
  const [usageLimit, setUsageLimit] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit() {
    setError(null)
    setSaving(true)
    try {
      const normalizedCode = code.trim().toUpperCase()
      const voucherId = `${businessId}_${normalizedCode}`
      await setDoc(doc(db, 'vouchers', voucherId), {
        businessId,
        code: normalizedCode,
        discountType: type,
        discountValue: Number(value),
        minPurchaseAmount: minPurchase ? Number(minPurchase) : null,
        maxDiscountAmount: maxDiscount ? Number(maxDiscount) : null,
        usageLimit: usageLimit ? Number(usageLimit) : null,
        usageLimitPerCustomer: 1,
        applicableProductIds: null,
        applicableCategoryIds: null,
        startsAt: null,
        expiresAt: expiresAt ? Timestamp.fromDate(new Date(expiresAt)) : null,
        isActive: true,
        timesUsed: 0,
        createdAt: Timestamp.now(),
      })
      onCreated()
    } catch (err) {
      setError(getFirebaseErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Create Voucher">
      <div className="space-y-4">
        {error && <Banner tone="danger">{error}</Banner>}
        <div>
          <Label htmlFor="v-code">Voucher code</Label>
          <Input id="v-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="WELCOME10" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="v-type">Discount type</Label>
            <Select id="v-type" value={type} onChange={(e) => setType(e.target.value as 'percentage' | 'fixed')}>
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed amount (Rs.)</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="v-value">{type === 'percentage' ? 'Percentage' : 'Amount (Rs.)'}</Label>
            <Input id="v-value" type="number" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="v-min">Min. purchase (optional)</Label>
            <Input id="v-min" type="number" value={minPurchase} onChange={(e) => setMinPurchase(e.target.value)} />
          </div>
          {type === 'percentage' && (
            <div>
              <Label htmlFor="v-max">Max discount (optional)</Label>
              <Input id="v-max" type="number" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} />
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="v-limit">Usage limit (optional)</Label>
            <Input id="v-limit" type="number" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="v-expiry">Expiry date (optional)</Label>
            <Input id="v-expiry" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
        </div>
        <Button fullWidth loading={saving} disabled={!code.trim() || !value} onClick={submit}>
          Create voucher
        </Button>
      </div>
    </Modal>
  )
}
