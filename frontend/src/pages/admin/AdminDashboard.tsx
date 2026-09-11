import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Timestamp, addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/firebase/client'
import { slugify } from '@/firebase/slugify'
import { getFirebaseErrorMessage } from '@/firebase/errors'
import type { BusinessDoc, BusinessStatus, CategoryDoc, UserDoc } from '@/firebase/types'
import { useAuth } from '@/auth/AuthContext'
import { Badge, Banner, Button, Card, Input, Label, StatCard, Textarea } from '@/components/ui'

// Deliberately scoped to account management only — status, trial, subscription. No product,
// order, or sales (GMV) data anywhere in this panel: that's each seller's own business data
// about their own customers, not something a platform superadmin needs to see to run
// account-level operations like suspending a store or setting its price.
type Tab = { key: 'overview' | 'companies' | 'revenue' | 'subscriptions' | 'settings' | 'categories'; label: string }
const TABS: Tab[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'companies', label: 'Companies' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'subscriptions', label: 'Subscriptions' },
  { key: 'settings', label: 'System Settings' },
  { key: 'categories', label: 'Categories' },
]

export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab['key']>('overview')

  return (
    <div className="min-h-screen bg-cream-50">
      <header className="flex items-center justify-between border-b border-black/5 bg-white px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🛡️</span>
          <span className="font-bold text-ink-900">HerCommerce Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink-500">{user?.fullName}</span>
          <button
            onClick={() => {
              logout()
              navigate('/login')
            }}
            className="text-sm font-medium text-brand-600"
          >
            Log out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-6">
        <div className="mb-6 flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${tab === t.key ? 'bg-brand-600 text-white' : 'bg-white text-ink-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && <OverviewTab />}
        {tab === 'companies' && <CompaniesTab />}
        {tab === 'revenue' && <RevenueTab />}
        {tab === 'subscriptions' && <SubscriptionsTab />}
        {tab === 'settings' && <SystemSettingsTab />}
        {tab === 'categories' && <CategoriesTab />}
      </div>
    </div>
  )
}

interface Analytics {
  total: number
  active: number
  suspended: number
  archived: number
}

function OverviewTab() {
  const [data, setData] = useState<Analytics | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDocs(collection(db, 'businesses'))
      .then((snap) => {
        const statuses = snap.docs.map((d) => (d.data() as BusinessDoc).status)
        setData({
          total: statuses.length,
          active: statuses.filter((s) => s === 'active').length,
          suspended: statuses.filter((s) => s === 'suspended').length,
          archived: statuses.filter((s) => s === 'archived').length,
        })
      })
      .catch((err) => setError(getFirebaseErrorMessage(err)))
  }, [])

  if (error) return <Banner tone="danger">{error}</Banner>
  if (!data) return <p className="text-ink-500">Loading…</p>

  return (
    <div>
      <p className="mb-4 text-xs text-ink-500">
        Account status only — no product, order, or sales figures here. See the Revenue tab for subscription
        earnings, or Subscriptions for trial/paying breakdowns.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total businesses" value={data.total} />
        <StatCard label="Active" value={data.active} />
        <StatCard label="Suspended" value={data.suspended} tone={data.suspended > 0 ? 'amber' : 'brand'} />
        <StatCard label="Archived" value={data.archived} />
      </div>
    </div>
  )
}

interface AdminCompany {
  id: string
  name: string
  status: BusinessStatus
  trialEndsAt: Timestamp | null
  createdAt: Timestamp | null
  ownerName: string
}

const STATUS_TONE: Record<BusinessStatus, 'green' | 'red' | 'amber' | 'gray'> = {
  active: 'green',
  suspended: 'red',
  archived: 'gray',
  pending: 'amber',
}

const TRIAL_EXTENSION_DAYS = 14

function formatDate(ts: Timestamp | null): string {
  return ts ? ts.toDate().toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}

/**
 * The superadmin's "Companies" panel — every business/tenant on the platform in one table,
 * with the controls a superadmin actually needs: suspend a store, permanently shelve one,
 * reactivate one, or nudge its trial window. There's no payment gateway wired into this
 * card-free build (see trialEndsAt in firebase/types.ts) — the trial field is informational
 * record-keeping, and status is the one thing that's actually enforced (StorefrontLayout.tsx
 * and checkout.ts both block anything but 'active').
 */
function CompaniesTab() {
  const [companies, setCompanies] = useState<AdminCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'businesses'))
      const rows = await Promise.all(
        snap.docs.map(async (d) => {
          const b = d.data() as BusinessDoc
          const ownerSnap = await getDoc(doc(db, 'users', b.ownerUserId))
          const owner = ownerSnap.exists() ? (ownerSnap.data() as UserDoc) : null
          return {
            id: d.id,
            name: b.name,
            status: b.status,
            trialEndsAt: b.trialEndsAt ?? null,
            createdAt: b.createdAt ?? null,
            ownerName: owner?.fullName ?? '—',
          }
        }),
      )
      setCompanies(rows)
    } catch (err) {
      setError(getFirebaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [])

  async function runAction(company: AdminCompany, action: () => Promise<void>) {
    setBusyId(company.id)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(getFirebaseErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  function setStatus(company: AdminCompany, status: BusinessStatus, confirmMessage: string) {
    if (!confirm(confirmMessage)) return
    runAction(company, async () => {
      await updateDoc(doc(db, 'businesses', company.id), { status, updatedAt: serverTimestamp() })
      setCompanies((prev) => prev.map((x) => (x.id === company.id ? { ...x, status } : x)))
    })
  }

  function extendTrial(company: AdminCompany) {
    runAction(company, async () => {
      // Extend from whichever is later — the current trial end date (if it's still ahead of
      // us) or right now. That way "+14 days" always adds 14 real days of runway instead of
      // resetting an already-future date back closer to today.
      const base = company.trialEndsAt && company.trialEndsAt.toMillis() > Date.now() ? company.trialEndsAt.toMillis() : Date.now()
      const trialEndsAt = Timestamp.fromMillis(base + TRIAL_EXTENSION_DAYS * 24 * 60 * 60 * 1000)
      await updateDoc(doc(db, 'businesses', company.id), { trialEndsAt, updatedAt: serverTimestamp() })
      setCompanies((prev) => prev.map((x) => (x.id === company.id ? { ...x, trialEndsAt } : x)))
    })
  }

  if (loading) return <p className="text-ink-500">Loading…</p>

  return (
    <div>
      {error && (
        <div className="mb-4">
          <Banner tone="danger">{error}</Banner>
        </div>
      )}
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/5 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Trial ends</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {companies.map((c) => {
              const busy = busyId === c.id
              return (
                <tr key={c.id}>
                  <td className="px-4 py-3.5 align-top">
                    <p className="font-semibold text-ink-900">{c.name}</p>
                    <p className="text-xs text-ink-500">{c.ownerName}</p>
                  </td>
                  <td className="px-4 py-3.5 align-top">
                    <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
                  </td>
                  <td className="px-4 py-3.5 align-top text-ink-700">{formatDate(c.trialEndsAt)}</td>
                  <td className="px-4 py-3.5 align-top text-ink-700">{formatDate(c.createdAt)}</td>
                  <td className="px-4 py-3.5 align-top">
                    <div className="flex flex-wrap gap-2">
                      {c.status !== 'active' && (
                        <Button
                          size="sm"
                          loading={busy}
                          onClick={() => setStatus(c, 'active', `Activate "${c.name}"? Its storefront will accept orders again.`)}
                        >
                          Activate
                        </Button>
                      )}
                      {c.status !== 'suspended' && (
                        <Button
                          size="sm"
                          variant="danger"
                          loading={busy}
                          onClick={() => setStatus(c, 'suspended', `Suspend "${c.name}"? Its storefront will stop accepting orders until reactivated.`)}
                        >
                          Suspend
                        </Button>
                      )}
                      {c.status !== 'archived' && (
                        <Button
                          size="sm"
                          variant="outline"
                          loading={busy}
                          onClick={() => setStatus(c, 'archived', `Archive "${c.name}"? This is meant for closed/churned sellers — reversible with Activate, but treat it as permanent.`)}
                        >
                          Archive
                        </Button>
                      )}
                      <Button size="sm" variant="outline" loading={busy} onClick={() => extendTrial(c)}>
                        +{TRIAL_EXTENSION_DAYS}d Trial
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

/** Flat Rs./month HerCommerce charges every active business — set from the System Settings
 *  tab (config/platform.monthlyPrice). Defaults to 0 until an admin fills it in, so MRR
 *  starts at Rs. 0 rather than guessing a number nobody entered. There's no per-tier pricing
 *  here: every active account is charged the same amount (see BusinessStatus in
 *  firebase/types.ts — there's no plan/tier field on a business at all). */
async function loadMonthlyPrice(): Promise<number> {
  const snap = await getDoc(doc(db, 'config', 'platform'))
  if (!snap.exists()) return 0
  return (snap.data().monthlyPrice as number | undefined) ?? 0
}

interface MrrData {
  monthlyPrice: number
  // "Paying" = active AND its free trial has already ended — a business still inside its
  // 14-day trial window isn't being charged yet, even though its status is already 'active'.
  payingAccounts: number
  trialingAccounts: number
  mrr: number
}

/**
 * What HerCommerce itself earns — subscription revenue only. There's no visibility here into
 * store sales/GMV (that's business data about each seller's own customers, deliberately kept
 * out of the superadmin) — just account-level subscription math.
 */
function RevenueTab() {
  const [mrrData, setMrrData] = useState<MrrData | null>(null)
  const [mrrError, setMrrError] = useState<string | null>(null)

  useEffect(() => {
    const now = Date.now()
    Promise.all([loadMonthlyPrice(), getDocs(collection(db, 'businesses'))])
      .then(([monthlyPrice, businessesSnap]) => {
        // Only 'active' businesses count at all — a suspended/archived one isn't billed,
        // same logic the Companies tab uses to decide who's actually live. Of those, split
        // into paying (trial already over, or no trial ever tracked) vs. still trialing.
        let payingAccounts = 0
        let trialingAccounts = 0
        businessesSnap.docs.forEach((d) => {
          const b = d.data() as BusinessDoc
          if (b.status !== 'active') return
          if (b.trialEndsAt && b.trialEndsAt.toMillis() > now) trialingAccounts += 1
          else payingAccounts += 1
        })
        setMrrData({ monthlyPrice, payingAccounts, trialingAccounts, mrr: payingAccounts * monthlyPrice })
      })
      .catch((err) => setMrrError(getFirebaseErrorMessage(err)))
  }, [])

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">
        Subscription revenue — what HerCommerce earns
      </h2>
      <p className="mb-4 text-xs text-ink-500">
        No payment gateway is wired into this app, so nothing here confirms a payment was actually received — this
        multiplies the number of active, past-trial accounts by the flat monthly price you set in System Settings.
        Store sales (GMV) aren't shown here — that's each seller's own business data, not HerCommerce's.
      </p>
      {mrrError && (
        <div className="mb-4">
          <Banner tone="danger">{mrrError}</Banner>
        </div>
      )}
      {mrrData === null ? (
        <p className="text-ink-500">Loading…</p>
      ) : (
        <div>
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="MRR" value={`Rs. ${mrrData.mrr.toLocaleString()}`} />
            <StatCard label="ARR (MRR × 12)" value={`Rs. ${(mrrData.mrr * 12).toLocaleString()}`} />
            <StatCard label="Paying accounts" value={mrrData.payingAccounts} />
            <StatCard label="Still on free trial" value={mrrData.trialingAccounts} />
          </div>
          {mrrData.monthlyPrice === 0 && (
            <p className="text-xs text-ink-500">
              Your monthly price is set to Rs. 0 right now — set it in the System Settings tab and this will start
              reflecting actual MRR.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

interface SubscriptionRow {
  id: string
  name: string
  trialEndsAt: Timestamp | null
  status: BusinessStatus
}

/**
 * There's no plan/tier on a business (see BusinessStatus in firebase/types.ts — every active
 * account is charged the same flat price, set in System Settings). What this tab shows
 * instead: who's still inside their free trial vs. already past it and presumably paying,
 * with trial end dates soonest-first so a superadmin knows who to follow up with. Same
 * underlying data the Companies tab edits — just a different view of it.
 */
function SubscriptionsTab() {
  const [rows, setRows] = useState<SubscriptionRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Captured once rather than read fresh on every render (Date.now() during render is an
  // impure read) — "days left" staying fixed for as long as this tab is open is an
  // acceptable trade-off for a superadmin glancing at trial windows, not a live countdown.
  const [now] = useState(() => Date.now())

  useEffect(() => {
    getDocs(collection(db, 'businesses'))
      .then((snap) => {
        setRows(
          snap.docs.map((d) => {
            const b = d.data() as BusinessDoc
            return { id: d.id, name: b.name, trialEndsAt: b.trialEndsAt ?? null, status: b.status }
          }),
        )
      })
      .catch((err) => setError(getFirebaseErrorMessage(err)))
  }, [])

  if (error) return <Banner tone="danger">{error}</Banner>
  if (!rows) return <p className="text-ink-500">Loading…</p>

  const active = rows.filter((r) => r.status === 'active')
  const trialing = active.filter((r) => r.trialEndsAt && r.trialEndsAt.toMillis() > now)
  const paying = active.length - trialing.length

  const withTrialDate = rows.filter((r) => r.trialEndsAt).sort((a, b) => a.trialEndsAt!.toMillis() - b.trialEndsAt!.toMillis())

  return (
    <div>
      <p className="mb-4 text-xs text-ink-500">
        No payment gateway is wired into HerCommerce, and there's no plan/tier on a business — every active account
        is charged the same flat monthly price (set in System Settings). "Paying" below just means their free trial
        has ended while they're still active.
      </p>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Paying (trial ended)" value={paying} />
        <StatCard label="On free trial" value={trialing.length} />
        <StatCard label="Total active" value={active.length} />
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">Trial windows, soonest first</h2>
      <Card className="divide-y divide-black/5">
        {withTrialDate.length === 0 && <p className="p-4 text-sm text-ink-500">No businesses have a trial date set.</p>}
        {withTrialDate.map((r) => {
          const daysLeft = Math.ceil((r.trialEndsAt!.toMillis() - now) / (24 * 60 * 60 * 1000))
          return (
            <div key={r.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium text-ink-900">{r.name}</p>
                <p className="text-xs text-ink-500">{r.status}</p>
              </div>
              <Badge tone={daysLeft < 0 ? 'red' : daysLeft <= 3 ? 'amber' : 'gray'}>
                {daysLeft < 0 ? `Expired ${Math.abs(daysLeft)}d ago` : daysLeft === 0 ? 'Ends today' : `${daysLeft}d left`}
              </Badge>
            </div>
          )
        })}
      </Card>
    </div>
  )
}

/**
 * The one real, wired-up platform-wide setting: an announcement banner shown on every
 * storefront (StorefrontLayout.tsx), above each seller's own store-level banner. Stored in
 * config/platform — the only config/* doc a superadmin can write to (see firestore.rules;
 * every other config doc stays deploy-time managed).
 */
function SystemSettingsTab() {
  const [banner, setBanner] = useState('')
  const [monthlyPrice, setMonthlyPrice] = useState('0')
  const [loading, setLoading] = useState(true)
  const [savingBanner, setSavingBanner] = useState(false)
  const [savingPricing, setSavingPricing] = useState(false)
  const [bannerSaved, setBannerSaved] = useState(false)
  const [pricingSaved, setPricingSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDoc(doc(db, 'config', 'platform'))
      .then((snap) => {
        if (!snap.exists()) return
        const data = snap.data()
        setBanner((data.announcementBanner as string | null) ?? '')
        setMonthlyPrice(String((data.monthlyPrice as number | undefined) ?? 0))
      })
      .catch((err) => setError(getFirebaseErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  async function saveBanner() {
    setSavingBanner(true)
    setError(null)
    setBannerSaved(false)
    try {
      await setDoc(doc(db, 'config', 'platform'), { announcementBanner: banner.trim() || null, updatedAt: serverTimestamp() }, { merge: true })
      setBannerSaved(true)
    } catch (err) {
      setError(getFirebaseErrorMessage(err))
    } finally {
      setSavingBanner(false)
    }
  }

  async function savePricing() {
    setSavingPricing(true)
    setError(null)
    setPricingSaved(false)
    try {
      await setDoc(
        doc(db, 'config', 'platform'),
        { monthlyPrice: Math.max(0, Number(monthlyPrice) || 0), updatedAt: serverTimestamp() },
        { merge: true },
      )
      setPricingSaved(true)
    } catch (err) {
      setError(getFirebaseErrorMessage(err))
    } finally {
      setSavingPricing(false)
    }
  }

  if (loading) return <p className="text-ink-500">Loading…</p>

  return (
    <div className="max-w-xl space-y-4">
      {error && (
        <div>
          <Banner tone="danger">{error}</Banner>
        </div>
      )}
      <Card className="p-5">
        <h2 className="font-semibold text-ink-900">Subscription pricing</h2>
        <p className="mt-1 text-sm text-ink-500">
          The flat Rs./month HerCommerce charges every active business — one price for everyone, no plan tiers.
          Drives the "Subscription revenue" figures on the Revenue tab (active, past-trial accounts × this price)
          — there's no payment gateway behind it, so this is what should be collected, not a confirmation it was.
        </p>
        <div className="mt-4 max-w-[200px]">
          <Label>Rs./month</Label>
          <Input
            type="number"
            min={0}
            value={monthlyPrice}
            onChange={(e) => {
              setMonthlyPrice(e.target.value)
              setPricingSaved(false)
            }}
          />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button loading={savingPricing} onClick={savePricing}>
            Save pricing
          </Button>
          {pricingSaved && <span className="text-sm text-green-600">Saved ✓</span>}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold text-ink-900">Platform-wide announcement</h2>
        <p className="mt-1 text-sm text-ink-500">
          Shown at the top of every storefront on the platform, above each seller's own banner (their Store
          settings › Announcement). Good for something affecting everyone at once — leave blank to hide it.
        </p>
        <Textarea
          className="mt-4"
          rows={3}
          value={banner}
          onChange={(e) => {
            setBanner(e.target.value)
            setBannerSaved(false)
          }}
          placeholder="e.g. We're aware of WhatsApp delivery delays today and are looking into it."
        />
        <div className="mt-4 flex items-center gap-3">
          <Button loading={savingBanner} onClick={saveBanner}>
            Save announcement
          </Button>
          {bannerSaved && <span className="text-sm text-green-600">Saved ✓</span>}
        </div>
      </Card>
    </div>
  )
}

type Category = CategoryDoc & { id: string }
type CategoryTree = Category & { children: Category[] }

function CategoriesTab() {
  const [categories, setCategories] = useState<CategoryTree[]>([])
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const snap = await getDocs(collection(db, 'categories'))
    const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as CategoryDoc) }))
    const topLevel = all.filter((c) => !c.parentId)
    setCategories(topLevel.map((c) => ({ ...c, children: all.filter((x) => x.parentId === c.id) })))
  }
  useEffect(() => {
    load()
  }, [])

  async function addCategory() {
    if (!newName.trim()) return
    try {
      await addDoc(collection(db, 'categories'), {
        name: newName,
        slug: slugify(newName),
        parentId: null,
        icon: '🏷️',
        isActive: true,
        sortOrder: categories.length,
      })
      setNewName('')
      load()
    } catch (err) {
      setError(getFirebaseErrorMessage(err))
    }
  }

  async function removeCategory(id: string) {
    if (!confirm('Delete this category?')) return
    try {
      await deleteDoc(doc(db, 'categories', id))
      load()
    } catch (err) {
      setError(getFirebaseErrorMessage(err))
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4">
          <Banner tone="danger">{error}</Banner>
        </div>
      )}
      <div className="mb-4 flex gap-2">
        <Input placeholder="New top-level category name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <Button onClick={addCategory}>Add</Button>
      </div>
      <div className="space-y-3">
        {categories.map((c) => (
          <Card key={c.id} className="p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-ink-900">
                {c.icon} {c.name}
              </p>
              <button onClick={() => removeCategory(c.id)} className="text-sm text-danger-500">
                Delete
              </button>
            </div>
            {c.children.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {c.children.map((child) => (
                  <span key={child.id} className="rounded-full bg-cream-100 px-3 py-1 text-xs text-ink-700">
                    {child.name}
                  </span>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
