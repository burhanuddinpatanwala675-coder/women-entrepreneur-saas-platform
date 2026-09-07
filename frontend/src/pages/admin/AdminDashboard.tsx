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
  sum,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/firebase/client'
import { slugify } from '@/firebase/slugify'
import { getFirebaseErrorMessage } from '@/firebase/errors'
import type { BusinessDoc, BusinessPlan, BusinessStatus, CategoryDoc, UserDoc } from '@/firebase/types'
import { useAuth } from '@/auth/AuthContext'
import { Badge, Banner, Button, Card, Input, StatCard } from '@/components/ui'

type Tab = { key: 'overview' | 'companies' | 'categories'; label: string }
const TABS: Tab[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'companies', label: 'Companies' },
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
