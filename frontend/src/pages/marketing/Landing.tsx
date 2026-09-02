import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'

const FEATURES = [
  { icon: '📸', title: 'Add products in seconds', desc: 'Snap a photo, add a price — your store updates instantly.' },
  { icon: '📲', title: 'Sell on WhatsApp', desc: 'Customers order with one tap. No apps, no confusion.' },
  { icon: '🏷️', title: 'Vouchers & gift cards', desc: 'Run promotions and let customers gift your products.' },
  { icon: '💗', title: 'Made for every business', desc: 'Fashion, food, beauty, handmade, services — any category.' },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-cream-50">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="text-2xl">💗</span>
          <span className="text-lg font-bold text-ink-900">HerCommerce</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm font-semibold text-ink-700">
            Log in
          </Link>
          <Link to="/signup">
            <Button size="sm">Start free</Button>
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-5 pb-12 pt-10 text-center sm:pt-16">
        <span className="inline-block rounded-full bg-brand-100 px-4 py-1.5 text-sm font-semibold text-brand-700">
          Built for women entrepreneurs
        </span>
        <h1 className="mt-5 text-4xl font-bold leading-tight text-ink-900 sm:text-5xl">
          If you can use WhatsApp, <span className="text-brand-600">you can run your business here.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-ink-500">
          Create your online store, add products, and start selling in under 5 minutes.
          No coding, no design skills, no technical headaches.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/signup" className="w-full sm:w-auto">
            <Button size="lg" fullWidth>
              Create my free store
            </Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-10">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="text-3xl">{f.icon}</div>
              <h3 className="mt-3 font-semibold text-ink-900">{f.title}</h3>
              <p className="mt-1 text-sm text-ink-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-black/5 py-8 text-center text-sm text-ink-500">
        © {new Date().getFullYear()} HerCommerce. Built for women-owned businesses everywhere.
      </footer>
    </div>
  )
}
