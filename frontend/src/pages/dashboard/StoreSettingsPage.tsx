import { useEffect, useState } from 'react'
import { doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/firebase/client'
import { uploadImage } from '@/cloudinary/upload'
import { getFirebaseErrorMessage } from '@/firebase/errors'
import type { BusinessDoc, BusinessTemplate } from '@/firebase/types'
import { useAuth } from '@/auth/AuthContext'
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
  const { user } = useAuth()
  const businessId = user!.businessId!
  const [business, setBusiness] = useState<(BusinessDoc & { id: string }) | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'businesses', businessId), (snap) => {
      if (!snap.exists()) return
      const data = snap.data() as BusinessDoc
      // Business docs created before delivery charges existed won't have this field —
      // default it here so the input has a real number and `save()` never writes
      // `undefined` (which the Firestore SDK rejects outright).
      setBusiness({ id: snap.id, ...data, storeSettings: { ...data.storeSettings, deliveryFee: data.storeSettings?.deliveryFee ?? 0 } })
    })
    return unsub
  }, [businessId])

  async function uploadTo(field: 'logoUrl' | 'coverImageUrl', file: File) {
    const setUploading = field === 'logoUrl' ? setUploadingLogo : setUploadingCover
    setUploading(true)
    setError(null)
    try {
      const uploaded = await uploadImage(file, `businesses/${businessId}`)
      setBusiness((prev) => (prev ? { ...prev, [field]: uploaded.url } : prev))
    } catch (err) {
      setError(getFirebaseErrorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    if (!business) return
    setError(null)
    setSaving(true)
    setSaved(false)
    try {
      await updateDoc(doc(db, 'businesses', businessId), {
        name: business.name,
        shortDescription: business.shortDescription,
        logoUrl: business.logoUrl,
        coverImageUrl: business.coverImageUrl,
        whatsappNumber: business.whatsappNumber,
        contactEmail: business.contactEmail,
        contactPhone: business.contactPhone,
        socialLinks: business.socialLinks,
        template: business.template,
        storeSettings: business.storeSettings,
        updatedAt: serverTimestamp(),
      })
      setSaved(true)
    } catch (err) {
      setError(getFirebaseErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (!business) return <p className="py-10 text-center text-ink-500">Loading…</p>

  const storeUrl = `${window.location.origin}/store/${business.id}`

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
          {(
            [
              { field: 'logoUrl' as const, label: 'Logo', uploading: uploadingLogo },
              { field: 'coverImageUrl' as const, label: 'Cover photo', uploading: uploadingCover },
            ]
          ).map(({ field, label, uploading }) => (
            <label key={field} className="col-span-1 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-ink-300 p-3 text-center">
              {business[field] ? (
                <img src={business[field] as string} className="h-16 w-16 rounded-lg object-cover" />
              ) : (
                <span className="text-2xl">{uploading ? '…' : '🖼️'}</span>
              )}
              <span className="text-xs font-medium text-ink-700">{label}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => e.target.files?.[0] && uploadTo(field, e.target.files[0])}
              />
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
            <Textarea
              id="s-desc"
              rows={3}
              value={business.shortDescription ?? ''}
              onChange={(e) => setBusiness({ ...business, shortDescription: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="s-announce">Announcement banner (optional)</Label>
            <Input
              id="s-announce"
              value={business.storeSettings.announcementBanner ?? ''}
              onChange={(e) =>
                setBusiness({ ...business, storeSettings: { ...business.storeSettings, announcementBanner: e.target.value } })
              }
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
              value={business.whatsappNumber ?? ''}
              onChange={(e) => setBusiness({ ...business, whatsappNumber: e.target.value })}
              placeholder="923001234567"
            />
            <p className="mt-1 text-xs text-ink-500">Customers will message this number when they tap "Order on WhatsApp".</p>
          </div>
          <div>
            <Label htmlFor="s-email">Contact email (optional)</Label>
            <Input id="s-email" value={business.contactEmail ?? ''} onChange={(e) => setBusiness({ ...business, contactEmail: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="s-instagram">Instagram (optional)</Label>
            <Input
              id="s-instagram"
              value={business.socialLinks?.instagram ?? ''}
              onChange={(e) => setBusiness({ ...business, socialLinks: { ...business.socialLinks, instagram: e.target.value } })}
              placeholder="@yourbusiness"
            />
          </div>
        </div>
      </Card>

      <Card className="mb-4 p-5">
        <h2 className="mb-3 font-semibold text-ink-900">Delivery</h2>
        <div>
          <Label htmlFor="s-delivery">Delivery charges (Rs.)</Label>
          <Input
            id="s-delivery"
            type="number"
            min={0}
            value={business.storeSettings.deliveryFee ?? 0}
            onChange={(e) =>
              setBusiness({
                ...business,
                storeSettings: { ...business.storeSettings, deliveryFee: Math.max(0, Number(e.target.value) || 0) },
              })
            }
            placeholder="0"
          />
          <p className="mt-1 text-xs text-ink-500">
            Added automatically to every customer's total at checkout. Leave at 0 for free delivery.
          </p>
        </div>
      </Card>

      <Card className="mb-4 p-5">
        <h2 className="mb-3 font-semibold text-ink-900">Payments</h2>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            className="h-5 w-5 rounded"
            checked={business.storeSettings.codEnabled}
            onChange={(e) => setBusiness({ ...business, storeSettings: { ...business.storeSettings, codEnabled: e.target.checked } })}
          />
          <span className="text-sm text-ink-700">Accept Cash on Delivery</span>
        </label>
        <div className="mt-3">
          <Label htmlFor="s-manual">Manual payment instructions (optional)</Label>
          <Textarea
            id="s-manual"
            rows={2}
            value={business.storeSettings.manualPaymentInstructions ?? ''}
            onChange={(e) =>
              setBusiness({ ...business, storeSettings: { ...business.storeSettings, manualPaymentInstructions: e.target.value } })
            }
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
