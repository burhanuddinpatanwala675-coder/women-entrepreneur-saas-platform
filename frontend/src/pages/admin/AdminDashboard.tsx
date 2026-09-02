import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import type { AdminAnalytics, AdminSeller, CategoryTree } from '@/api/types'
import { useAuth } from '@/auth/AuthContext'
import { Badge, Button, Card, Input, StatCard } from '@/components/ui'

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
          <span className="text-sm text-ink-500">{user?.full_name}</span>
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

function OverviewTab() {
  const [data, setData] = useState<AdminAnalytics | null>(null)

  useEffect(() => {
    api.get<AdminAnalytics>('/admin/analytics').then(setData)
  }, [])

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

function SellersTab() {
  const [sellers, setSellers] = useState<AdminSeller[]>([])
  const [loading, setLoading] = useState(true)

  function load() {
    setLoading(true)
    api
      .get<AdminSeller[]>('/admin/sellers')
      .then(setSellers)
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function toggleStatus(s: AdminSeller) {
    const newStatus = s.status === 'suspended' ? 'active' : 'suspended'
    if (!confirm(`${newStatus === 'suspended' ? 'Suspend' : 'Reactivate'} "${s.name}"?`)) return
    const updated = await api.patch<AdminSeller>(`/admin/sellers/${s.id}/status`, { status: newStatus })
    setSellers((prev) => prev.map((x) => (x.id === s.id ? updated : x)))
  }

  if (loading) return <p className="text-ink-500">Loading…</p>

  return (
    <Card className="divide-y divide-black/5">
      {sellers.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <div>
            <p className="font-semibold text-ink-900">{s.name}</p>
            <p className="text-xs text-ink-500">
              {s.owner_name} · {s.owner_email || s.owner_phone} · {s.product_count} products · {s.order_count} orders
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
  )
}

function CategoriesTab() {
  const [categories, setCategories] = useState<CategoryTree[]>([])
  const [newName, setNewName] = useState('')

  function load() {
    api.get<CategoryTree[]>('/admin/categories').then((all) => {
      const topLevel = all.filter((c) => !c.parent_id)
      setCategories(topLevel.map((c) => ({ ...c, children: all.filter((x) => x.parent_id === c.id) })))
    })
  }
  useEffect(load, [])

  async function addCategory() {
    if (!newName.trim()) return
    await api.post('/admin/categories', { name: newName })
    setNewName('')
    load()
  }

  async function removeCategory(id: string) {
    if (!confirm('Delete this category?')) return
    await api.del(`/admin/categories/${id}`)
    load()
  }

  return (
    <div>
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
