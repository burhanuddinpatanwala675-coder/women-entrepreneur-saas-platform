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
  sum,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/firebase/client'
import { slugify } from '@/firebase/slugify'
import { getFirebaseErrorMessage } from '@/firebase/errors'
import type { BusinessDoc, BusinessStatus, CategoryDoc, UserDoc } from '@/firebase/types'
import { useAuth } from '@/auth/AuthContext'
import { Badge, Banner, Button, Card, Input, StatCard } from '@/components/ui'

type Tab = 'overview' | 'sellers' | 'categories'

export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('overview')

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
          {(['overview', 'sellers', 'categories'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-2 text-sm font-medium capitalize ${tab === t ? 'bg-brand-600 text-white' : 'bg-white text-ink-700'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'overview' && <OverviewTab />}
        {tab === 'sellers' && <SellersTab />}
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

interface AdminSeller {
  id: string
  name: string
  status: BusinessStatus
  ownerName: string
  ownerEmail: string | null
  ownerPhone: string | null
  productCount: number
  orderCount: number
}

function SellersTab() {
  const [sellers, setSellers] = useState<AdminSeller[]>([])
  const [loading, setLoading] = useState(true)
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
            ownerName: owner?.fullName ?? '—',
            ownerEmail: owner?.email ?? null,
            ownerPhone: owner?.phone ?? null,
            productCount: productCount.data().count,
            orderCount: orderCount.data().count,
          }
        }),
      )
      setSellers(rows)
    } catch (err) {
      setError(getFirebaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [])

  async function toggleStatus(s: AdminSeller) {
    const newStatus: BusinessStatus = s.status === 'suspended' ? 'active' : 'suspended'
    if (!confirm(`${newStatus === 'suspended' ? 'Suspend' : 'Reactivate'} "${s.name}"?`)) return
    try {
      await updateDoc(doc(db, 'businesses', s.id), { status: newStatus })
      setSellers((prev) => prev.map((x) => (x.id === s.id ? { ...x, status: newStatus } : x)))
    } catch (err) {
      setError(getFirebaseErrorMessage(err))
    }
  }

  if (loading) return <p className="text-ink-500">Loading…</p>

  return (
    <div>
      {error && (
        <div className="mb-4">
          <Banner tone="danger">{error}</Banner>
        </div>
      )}
      <Card className="divide-y divide-black/5">
        {sellers.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
            <div>
              <p className="font-semibold text-ink-900">{s.name}</p>
              <p className="text-xs text-ink-500">
                {s.ownerName} · {s.ownerEmail || s.ownerPhone} · {s.productCount} products · {s.orderCount} orders
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge tone={s.status === 'active' ? 'green' : s.status === 'suspended' ? 'red' : 'amber'}>{s.status}</Badge>
              <Button size="sm" variant={s.status === 'suspended' ? 'primary' : 'danger'} onClick={() => toggleStatus(s)}>
                {s.status === 'suspended' ? 'Reactivate' : 'Suspend'}
              </Button>
            </div>
          </div>
        ))}
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
