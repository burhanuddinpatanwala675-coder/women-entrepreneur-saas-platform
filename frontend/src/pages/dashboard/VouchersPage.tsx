import { useEffect, useState } from 'react'
import { api, ApiError } from '@/api/client'
import type { Voucher } from '@/api/types'
import { PageHeader } from '@/components/SellerLayout'
import { Badge, Banner, Button, Card, EmptyState, Input, Label, Modal, Select } from '@/components/ui'

export default function VouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  function load() {
    setLoading(true)
    api
      .get<Voucher[]>('/vouchers')
      .then(setVouchers)
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function toggleActive(v: Voucher) {
    const updated = await api.patch<Voucher>(`/vouchers/${v.id}`, { is_active: !v.is_active })
    setVouchers((prev) => prev.map((x) => (x.id === v.id ? updated : x)))
  }

  async function remove(v: Voucher) {
    if (!confirm(`Delete voucher "${v.code}"?`)) return
    await api.del(`/vouchers/${v.id}`)
    setVouchers((prev) => prev.filter((x) => x.id !== v.id))
  }

  return (
    <div>
      <PageHeader title="Vouchers" subtitle="Discount codes for your customers" action={<Button onClick={() => setCreating(true)}>+ Create Voucher</Button>} />

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
                    {v.discount_type === 'percentage' ? `${v.discount_value}% off` : `Rs. ${v.discount_value.toLocaleString()} off`}
                    {v.min_purchase_amount ? ` · min Rs. ${v.min_purchase_amount.toLocaleString()}` : ''}
                  </p>
                </div>
                <Badge tone={v.is_active ? 'green' : 'gray'}>{v.is_active ? 'Active' : 'Paused'}</Badge>
              </div>
              <p className="mt-2 text-xs text-ink-500">
                Used {v.times_used}{v.usage_limit ? ` / ${v.usage_limit}` : ''} times
                {v.expires_at ? ` · expires ${new Date(v.expires_at).toLocaleDateString()}` : ''}
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" fullWidth onClick={() => toggleActive(v)}>
                  {v.is_active ? 'Pause' : 'Activate'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(v)}>
                  🗑️
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {creating && (
        <VoucherForm
          onClose={() => setCreating(false)}
          onCreated={(v) => {
            setVouchers((prev) => [v, ...prev])
            setCreating(false)
          }}
        />
      )}
    </div>
  )
}

function VoucherForm({ onClose, onCreated }: { onClose: () => void; onCreated: (v: Voucher) => void }) {
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
      const v = await api.post<Voucher>('/vouchers', {
        code,
        discount_type: type,
        discount_value: Number(value),
        min_purchase_amount: minPurchase ? Number(minPurchase) : null,
        max_discount_amount: maxDiscount ? Number(maxDiscount) : null,
        usage_limit: usageLimit ? Number(usageLimit) : null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      })
      onCreated(v)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create voucher')
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
