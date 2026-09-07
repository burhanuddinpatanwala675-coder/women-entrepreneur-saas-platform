import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getAggregateFromServer,
  getCountFromServer,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  sum,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/firebase/client'
import { slugify } from '@/firebase/slugify'
import { getFirebaseErrorMessage } from '@/firebase/errors'
import type { BusinessDoc, BusinessPlan, BusinessStatus, CategoryDoc, OrderDoc, ProductDoc, UserDoc } from '@/firebase/types'
import { useAuth } from '@/auth/AuthContext'
import { Badge, Banner, Button, Card, Input, StatCard, Textarea } from '@/components/ui'

type Tab = { key: 'overview' | 'companies' | 'revenue' | 'subscriptions' | 'health' | 'settings' | 'categories'; label: string }
const TABS: Tab[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'companies', label: 'Companies' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'subscriptions', label: 'Subscriptions' },
  { key: 'health', label: 'Platform Health' },
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
        {tab === 'health' && <PlatformHealthTab />}
        {tab === 'settings' && <SystemSettingsTab />}
        {tab === 'categories' && <CategoriesTab />}
      </div>
    </div>
  )
}

interface Analytics {
  total_sellers: number
  active_sellers: number
  suspended_sellers: number
  total_products: number
  total_orders: number
  orders_last_30_days: number
  total_customers: number
  gmv_total: number
  gmv_last_30_days: number
}

function OverviewTab() {
  const [data, setData] = useState<Analytics | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const cutoff = Timestamp.fromMillis(Date.now() - 30 * 24 * 60 * 60 * 1000)
    Promise.all([
      getDocs(collection(db, 'businesses')),
      getCountFromServer(collection(db, 'products')),
      getCountFromServer(collection(db, 'orders')),
      getCountFromServer(query(collection(db, 'orders'), where('createdAt', '>=', cutoff))),
      getCountFromServer(collection(db, 'customers')),
      getAggregateFromServer(collection(db, 'orders'), { gmv: sum('total') }),
      getAggregateFromServer(query(collection(db, 'orders'), where('createdAt', '>=', cutoff)), { gmv: sum('total') }),
    ])
      .then(([businesses, products, orders, orders30, customers, gmv, gmv30]) => {
        const statuses = businesses.docs.map((d) => (d.data() as BusinessDoc).status)
        setData({
          total_sellers: statuses.length,
          active_sellers: statuses.filter((s) => s === 'active').length,
          suspended_sellers: statuses.filter((s) => s === 'suspended').length,
          total_products: products.data().count,
          total_orders: orders.data().count,
          orders_last_30_days: orders30.data().count,
          total_customers: customers.data().count,
          gmv_total: gmv.data().gmv ?? 0,
          gmv_last_30_days: gmv30.data().gmv ?? 0,
        })
      })
      .catch((err) => setError(getFirebaseErrorMessage(err)))
  }, [])

  if (error) return <Banner tone="danger">{error}</Banner>
  if (!data) return <p className="text-ink-500">Loading…</p>

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="Active sellers" value={data.active_sellers} hint={`${data.total_sellers} total`} />
      <StatCard label="Suspended sellers" value={data.suspended_sellers} />
      <StatCard label="Total products" value={data.total_products} />
      <StatCard label="Total customers" value={data.total_customers} />
      <StatCard label="Total orders" value={data.total_orders} hint={`${data.orders_last_30_days} in last 30 days`} />
      <StatCard label="GMV (all time)" value={`Rs. ${data.gmv_total.toLocaleString()}`} />
      <StatCard label="GMV (30 days)" value={`Rs. ${data.gmv_last_30_days.toLocaleString()}`} />
    </div>
  )
}

interface AdminCompany {
  id: string
  name: string
  status: BusinessStatus
  plan: BusinessPlan
  trialEndsAt: Timestamp | null
  createdAt: Timestamp | null
  ownerName: string
  ownerEmail: string | null
  ownerPhone: string | null
  productCount: number
  orderCount: number
}

const PLAN_LABELS: Record<BusinessPlan, string> = {
  free_trial: 'Free Trial',
  starter: 'Starter',
  business: 'Business',
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
 * reactivate one, or nudge its trial window. There's no payment gateway or WhatsApp
 * Business API behind any of this (see BusinessPlan/trialEndsAt in firebase/types.ts) — the
 * plan/trial fields are manual record-keeping, and status is the one thing that's actually
 * enforced (StorefrontLayout.tsx and checkout.ts both block anything but 'active').
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
          const [ownerSnap, productCount, orderCount] = await Promise.all([
            getDoc(doc(db, 'users', b.ownerUserId)),
            getCountFromServer(query(collection(db, 'products'), where('businessId', '==', d.id))),
            getCountFromServer(query(collection(db, 'orders'), where('businessId', '==', d.id))),
          ])
          const owner = ownerSnap.exists() ? (ownerSnap.data() as UserDoc) : null
          return {
            id: d.id,
            name: b.name,
            status: b.status,
            plan: b.plan ?? 'free_trial', // older business docs predate this field
            trialEndsAt: b.trialEndsAt ?? null,
            createdAt: b.createdAt ?? null,
            ownerName: owner?.fullName ?? '—',
            ownerEmail: owner?.email ?? null,
            ownerPhone: owner?.phone ?? null,
            productCount: productCount.data().count,
            orderCount: orderCount.data().count,
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

  function setPlan(company: AdminCompany, plan: BusinessPlan) {
    runAction(company, async () => {
      await updateDoc(doc(db, 'businesses', company.id), { plan, updatedAt: serverTimestamp() })
      setCompanies((prev) => prev.map((x) => (x.id === company.id ? { ...x, plan } : x)))
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
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/5 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Plan</th>
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
                    <p className="text-xs text-ink-500">
                      {c.ownerName} · {c.ownerEmail || c.ownerPhone || '—'} · {c.productCount} products · {c.orderCount} orders
                    </p>
                  </td>
                  <td className="px-4 py-3.5 align-top">
                    <select
                      value={c.plan}
                      disabled={busy}
                      onChange={(e) => setPlan(c, e.target.value as BusinessPlan)}
                      className="rounded-lg border border-ink-300 bg-white px-2 py-1.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400"
                    >
                      {(Object.keys(PLAN_LABELS) as BusinessPlan[]).map((p) => (
                        <option key={p} value={p}>
                          {PLAN_LABELS[p]}
                        </option>
                      ))}
                    </select>
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

type Range = 'today' | 'week' | 'month' | 'year' | 'all'
const RANGES: { key: Range; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
  { key: 'all', label: 'All time' },
]

/** Start of the selected window, or null for "all time" (no lower bound). Same logic as
 *  DashboardHome.tsx's seller-facing range picker, kept as its own small copy here rather
 *  than a shared import so this admin page doesn't reach into a seller-dashboard file. */
function rangeStart(range: Range): Date | null {
  const now = new Date()
  switch (range) {
    case 'today': {
      const d = new Date(now)
      d.setHours(0, 0, 0, 0)
      return d
    }
    case 'week': {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      return d
    }
    case 'month': {
      const d = new Date(now)
      d.setMonth(d.getMonth() - 1)
      return d
    }
    case 'year': {
      const d = new Date(now)
      d.setFullYear(d.getFullYear() - 1)
      return d
    }
    case 'all':
      return null
  }
}

interface RevenueRow {
  businessId: string
  businessName: string
  orderCount: number
  gmv: number
}

/**
 * "Revenue" here means gross merchandise value (the sum of every store's order totals) —
 * HerCommerce doesn't take a cut of sales, so there's no separate platform take-rate to
 * show. This is the one real, spendable-feeling number a superadmin can watch: how much is
 * actually moving through the platform, and which stores are driving it.
 */
function RevenueTab() {
  const [range, setRange] = useState<Range>('month')
  const [rows, setRows] = useState<RevenueRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setRows(null)
    setError(null)
    async function load() {
      try {
        const start = rangeStart(range)
        const ordersQuery = start
          ? query(collection(db, 'orders'), where('createdAt', '>=', Timestamp.fromDate(start)))
          : collection(db, 'orders')
        const [ordersSnap, businessesSnap] = await Promise.all([getDocs(ordersQuery), getDocs(collection(db, 'businesses'))])
        if (cancelled) return
        const nameById = new Map(businessesSnap.docs.map((d) => [d.id, (d.data() as BusinessDoc).name]))
        const byBusiness = new Map<string, { orderCount: number; gmv: number }>()
        ordersSnap.docs.forEach((d) => {
          const o = d.data() as OrderDoc
          if (o.status === 'cancelled') return // not a real sale — same reasoning as DashboardHome's sales total
          const entry = byBusiness.get(o.businessId) ?? { orderCount: 0, gmv: 0 }
          entry.orderCount += 1
          entry.gmv += o.total
          byBusiness.set(o.businessId, entry)
        })
        const nextRows: RevenueRow[] = Array.from(byBusiness.entries())
          .map(([businessId, v]) => ({ businessId, businessName: nameById.get(businessId) ?? '(deleted business)', ...v }))
          .sort((a, b) => b.gmv - a.gmv)
        setRows(nextRows)
      } catch (err) {
        if (!cancelled) setError(getFirebaseErrorMessage(err))
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [range])

  const totalGmv = rows?.reduce((sum, r) => sum + r.gmv, 0) ?? 0
  const totalOrders = rows?.reduce((sum, r) => sum + r.orderCount, 0) ?? 0
  const aov = totalOrders > 0 ? totalGmv / totalOrders : 0

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Gross merchandise value</h2>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                range === r.key ? 'bg-brand-600 text-white' : 'bg-white text-ink-700'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-4 text-xs text-ink-500">
        HerCommerce doesn't take a cut of sales, so this is gross merchandise value across every store's orders,
        not platform revenue in the "money HerCommerce earns" sense.
      </p>

      {error && (
        <div className="mb-4">
          <Banner tone="danger">{error}</Banner>
        </div>
      )}

      {rows === null ? (
        <p className="text-ink-500">Loading…</p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="GMV" value={`Rs. ${totalGmv.toLocaleString()}`} />
            <StatCard label="Orders" value={totalOrders} />
            <StatCard label="Avg. order value" value={`Rs. ${Math.round(aov).toLocaleString()}`} />
          </div>

          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-black/5 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Orders</th>
                  <th className="px-4 py-3">GMV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-ink-500">
                      No orders in this range.
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.businessId}>
                    <td className="px-4 py-3 font-medium text-ink-900">{r.businessName}</td>
                    <td className="px-4 py-3 text-ink-700">{r.orderCount}</td>
                    <td className="px-4 py-3 font-semibold text-ink-900">Rs. {r.gmv.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  )
}

interface SubscriptionRow {
  id: string
  name: string
  plan: BusinessPlan
  trialEndsAt: Timestamp | null
  status: BusinessStatus
}

/**
 * Groups every business by its (manually assigned — see BusinessPlan) plan, and surfaces
 * trial end dates soonest-first so a superadmin knows who to follow up with. This is
 * deliberately just a different view of the same businesses/plan/trialEndsAt data the
 * Companies tab edits — there's no separate "subscriptions" system to manage here (see
 * firestore.rules' subscriptions/{businessId} comment: that collection is a write-once,
 * untouched-since-signup stub from before plans existed on the business doc itself).
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
            return { id: d.id, name: b.name, plan: b.plan ?? 'free_trial', trialEndsAt: b.trialEndsAt ?? null, status: b.status }
          }),
        )
      })
      .catch((err) => setError(getFirebaseErrorMessage(err)))
  }, [])

  if (error) return <Banner tone="danger">{error}</Banner>
  if (!rows) return <p className="text-ink-500">Loading…</p>

  const counts: Record<BusinessPlan, number> = { free_trial: 0, starter: 0, business: 0 }
  rows.forEach((r) => {
    counts[r.plan] += 1
  })

  const withTrialDate = rows.filter((r) => r.trialEndsAt).sort((a, b) => a.trialEndsAt!.toMillis() - b.trialEndsAt!.toMillis())

  return (
    <div>
      <p className="mb-4 text-xs text-ink-500">
        No payment gateway is wired into HerCommerce — these plans are manual labels set from the Companies tab
        for sellers who pay outside the app. This is just a grouped view of that same data.
      </p>
      <div className="mb-6 grid grid-cols-3 gap-3">
        {(Object.keys(PLAN_LABELS) as BusinessPlan[]).map((p) => (
          <StatCard key={p} label={PLAN_LABELS[p]} value={counts[p]} />
        ))}
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
                <p className="text-xs text-ink-500">{PLAN_LABELS[r.plan]}</p>
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

interface HealthIssue {
  key: string
  label: string
  count: number
  items: string[]
}

/**
 * Operational checks computed from live Firestore data — there's no error/log monitoring in
 * this card-free build (no server to monitor), so "platform health" here means "what needs a
 * human's attention" rather than uptime/latency. Every number is a real query result, not a
 * placeholder.
 */
function PlatformHealthTab() {
  const [issues, setIssues] = useState<HealthIssue[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [businessesSnap, productsSnap, ordersSnap] = await Promise.all([
          getDocs(collection(db, 'businesses')),
          getDocs(collection(db, 'products')),
          getDocs(collection(db, 'orders')),
        ])
        const businesses = businessesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as BusinessDoc) }))
        const activeBusinesses = businesses.filter((b) => b.status === 'active')
        const products = productsSnap.docs.map((d) => d.data() as ProductDoc)
        const orders = ordersSnap.docs.map((d) => d.data() as OrderDoc)

        const productCountByBusiness = new Map<string, number>()
        products.forEach((p) => productCountByBusiness.set(p.businessId, (productCountByBusiness.get(p.businessId) ?? 0) + 1))

        const emptyStores = activeBusinesses.filter((b) => !productCountByBusiness.get(b.id))
        const noWhatsapp = activeBusinesses.filter((b) => !b.whatsappNumber)
        const outOfStockCount = products.filter((p) => p.status === 'out_of_stock').length

        const staleCutoff = Date.now() - 48 * 60 * 60 * 1000
        const nameById = new Map(businesses.map((b) => [b.id, b.name]))
        const staleOrders = orders.filter(
          (o) => (o.status === 'new' || o.status === 'confirmed') && (o.createdAt?.toMillis() ?? 0) < staleCutoff,
        )

        setIssues([
          {
            key: 'empty',
            label: 'Active stores with zero products',
            count: emptyStores.length,
            items: emptyStores.map((b) => b.name),
          },
          {
            key: 'whatsapp',
            label: 'Active stores with no WhatsApp number set',
            count: noWhatsapp.length,
            items: noWhatsapp.map((b) => b.name),
          },
          { key: 'stock', label: 'Products out of stock, platform-wide', count: outOfStockCount, items: [] },
          {
            key: 'stale',
            label: 'Orders unactioned for 48+ hours (still New/Confirmed)',
            count: staleOrders.length,
            items: staleOrders.slice(0, 10).map((o) => `${o.orderNumber} · ${nameById.get(o.businessId) ?? '—'}`),
          },
        ])
      } catch (err) {
        setError(getFirebaseErrorMessage(err))
      }
    }
    load()
  }, [])

  if (error) return <Banner tone="danger">{error}</Banner>
  if (!issues) return <p className="text-ink-500">Loading…</p>

  return (
    <div>
      <p className="mb-4 text-xs text-ink-500">
        There's no error or uptime monitoring wired into this card-free build — these are data-quality checks
        run against live Firestore data, surfacing what needs a human to step in.
      </p>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {issues.map((i) => (
          <StatCard key={i.key} label={i.label} value={i.count} tone={i.count > 0 ? 'amber' : 'brand'} />
        ))}
      </div>
      {issues
        .filter((i) => i.items.length > 0)
        .map((i) => (
          <div key={i.key} className="mb-6">
            <h3 className="mb-2 text-sm font-semibold text-ink-900">{i.label}</h3>
            <Card className="divide-y divide-black/5">
              {i.items.map((name, idx) => (
                <p key={idx} className="px-4 py-2.5 text-sm text-ink-700">
                  {name}
                </p>
              ))}
            </Card>
          </div>
        ))}
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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDoc(doc(db, 'config', 'platform'))
      .then((snap) => setBanner(snap.exists() ? ((snap.data().announcementBanner as string | null) ?? '') : ''))
      .catch((err) => setError(getFirebaseErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await setDoc(doc(db, 'config', 'platform'), { announcementBanner: banner.trim() || null, updatedAt: serverTimestamp() }, { merge: true })
      setSaved(true)
    } catch (err) {
      setError(getFirebaseErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-ink-500">Loading…</p>

  return (
    <div className="max-w-xl">
      {error && (
        <div className="mb-4">
          <Banner tone="danger">{error}</Banner>
        </div>
      )}
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
            setSaved(false)
          }}
          placeholder="e.g. We're aware of WhatsApp delivery delays today and are looking into it."
        />
        <div className="mt-4 flex items-center gap-3">
          <Button loading={saving} onClick={save}>
            Save
          </Button>
          {saved && <span className="text-sm text-green-600">Saved ✓</span>}
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
