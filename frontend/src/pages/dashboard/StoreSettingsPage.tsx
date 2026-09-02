import { useEffect, useState } from 'react'
import { api, ApiError } from '@/api/client'
import type { Business, BusinessTemplate, StoreSettings } from '@/api/types'
import { PageHeader } from '@/components/SellerLayout'
import { Banner, Button, Card, Input, Label, Textarea } from '@/components/ui'

const TEMPLATES: { key: BusinessTemplate; label: string; emoji: string }[] = [
  { key: 'fashion', label: 'Fashion Store', emoji: '👗' },
  { key: 'beauty', label: 'Beauty Store', emoji: '🧴' },
  { key: 'food', label: 'Food & Bakery', emoji: '🍰' },
  { key: 'handmade', label: 'Handmade Store', emoji: '🕯️' },
  { key: 'minimal', label: 'Minimal General Store', emoji: '🛍️' },
]

export default function StoreSettingsPage() {
  const [business, setBusiness] = useState<Business | null>(null)
  const [settings, setSettings] = useState<StoreSettings | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([api.get<Business>('/businesses/me'), api.get<StoreSettings>('/businesses/me/store-settings')]).then(([b, s]) => {
      setBusiness(b)
      setSettings(s)
    })
  }, [])

  async function uploadTo(field: 'logo_url' | 'cover_image_url', file: File) {
    const { url } = await api.upload<{ url: string }>('/uploads/image', file)
    setBusiness((prev) => (prev ? { ...prev, [field]: url } : prev))
  }

  async function save() {
    if (!business || !settings) return
    setError(null)
    setSaving(true)
    setSaved(false)
    try {
      const updatedBusiness = await api.patch<Business>('/businesses/me', {
        name: business.name,
        short_description: business.short_description,
        logo_url: business.logo_url,
        cover_image_url: business.cover_image_url,
        whatsapp_number: business.whatsapp_number,
        contact_email: business.contact_email,
        contact_phone: business.contact_phone,
        social_links: business.social_links,
        template: business.template,
      })
      const updatedSettings = await api.patch<StoreSettings>('/businesses/me/store-settings', {
        accent_color: settings.accent_color,
        cod_enabled: settings.cod_enabled,
        manual_payment_instructions: settings.manual_payment_instructions,
        announcement_banner: settings.announcement_banner,
      })
      setBusiness(updatedBusiness)
      setSettings(updatedSettings)
      setSaved(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your store settings')
    } finally {
      setSaving(false)
    }
  }

  if (!business || !settings) return <p className="py-10 text-center text-ink-500">Loading…</p>

  const storeUrl = `${window.location.origin}${business.storefront_path}`

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Store" subtitle="Customize how customers see your store" />

      <Card className="mb-4 p-4">
        <p className="text-sm font-medium text-ink-500">Your storefront link</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <a href={storeUrl} target="_blank" rel="noreferrer" className="truncate font-mono text-sm text-brand-700">
            {storeUrl}
          </a>
          <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(storeUrl)}>
            Copy
          </Button>
        </div>
      </Card>

      {saved && (
        <div className="mb-4">
          <Banner tone="success">Your store has been updated!</Banner>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Banner tone="danger">{error}</Banner>
        </div>
      )}

      <Card className="mb-4 p-5">
        <h2 className="mb-3 font-semibold text-ink-900">Look &amp; feel</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { field: 'logo_url' as const, label: 'Logo' },
            { field: 'cover_image_url' as const, label: 'Cover photo' },
          ].map(({ field, label }) => (
            <label key={field} className="col-span-1 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-ink-300 p-3 text-center">
              {business[field] ? (
                <img src={business[field] as string} className="h-16 w-16 rounded-lg object-cover" />
              ) : (
                <span className="text-2xl">🖼️</span>
              )}
              <span className="text-xs font-medium text-ink-700">{label}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadTo(field, e.target.files[0])} />
            </label>
          ))}
        </div>

        <div className="mt-4">
          <Label>Store template</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.key}
                onClick={() => setBusiness((prev) => (prev ? { ...prev, template: t.key } : prev))}
                className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-medium ${
                  business.template === t.key ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-ink-300 text-ink-700'
                }`}
              >
                <span>{t.emoji}</span> {t.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="mb-4 p-5">
        <h2 className="mb-3 font-semibold text-ink-900">Business info</h2>
        <div className="space-y-3">
          <div>
            <Label htmlFor="s-name">Business name</Label>
            <Input id="s-name" value={business.name} onChange={(e) => setBusiness({ ...business, name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="s-desc">Short description</Label>
            <Textarea id="s-desc" rows={3} value={business.short_description ?? ''} onChange={(e) => setBusiness({ ...business, short_description: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="s-announce">Announcement banner (optional)</Label>
            <Input
              id="s-announce"
              value={settings.announcement_banner ?? ''}
              onChange={(e) => setSettings({ ...settings, announcement_banner: e.target.value })}
              placeholder="e.g. Free delivery on orders above Rs. 3,000"
            />
          </div>
        </div>
      </Card>

      <Card className="mb-4 p-5">
        <h2 className="mb-3 font-semibold text-ink-900">Contact &amp; WhatsApp</h2>
        <div className="space-y-3">
          <div>
            <Label htmlFor="s-wa">WhatsApp number (with country code)</Label>
            <Input
              id="s-wa"
              value={business.whatsapp_number ?? ''}
              onChange={(e) => setBusiness({ ...business, whatsapp_number: e.target.value })}
              placeholder="923001234567"
            />
            <p className="mt-1 text-xs text-ink-500">Customers will message this number when they tap "Order on WhatsApp".</p>
          </div>
          <div>
            <Label htmlFor="s-email">Contact email (optional)</Label>
            <Input id="s-email" value={business.contact_email ?? ''} onChange={(e) => setBusiness({ ...business, contact_email: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="s-instagram">Instagram (optional)</Label>
            <Input
              id="s-instagram"
              value={business.social_links?.instagram ?? ''}
              onChange={(e) => setBusiness({ ...business, social_links: { ...business.social_links, instagram: e.target.value } })}
              placeholder="@yourbusiness"
            />
          </div>
        </div>
      </Card>

      <Card className="mb-4 p-5">
        <h2 className="mb-3 font-semibold text-ink-900">Payments</h2>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            className="h-5 w-5 rounded"
            checked={settings.cod_enabled}
            onChange={(e) => setSettings({ ...settings, cod_enabled: e.target.checked })}
          />
          <span className="text-sm text-ink-700">Accept Cash on Delivery</span>
        </label>
        <div className="mt-3">
          <Label htmlFor="s-manual">Manual payment instructions (optional)</Label>
          <Textarea
            id="s-manual"
            rows={2}
            value={settings.manual_payment_instructions ?? ''}
            onChange={(e) => setSettings({ ...settings, manual_payment_instructions: e.target.value })}
            placeholder="e.g. Bank transfer to Meezan Bank, Acc# 0123456789"
          />
        </div>
      </Card>

      <Button fullWidth size="lg" loading={saving} onClick={save}>
        Save changes
      </Button>
    </div>
  )
}
