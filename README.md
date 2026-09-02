# HerCommerce

*"If a woman can use WhatsApp, she can use this platform."*

A mobile-first, multi-tenant SaaS platform that helps women entrepreneurs create and run
an online business: store, products, WhatsApp ordering, vouchers, and gift cards — no
technical knowledge required.

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for the full system design: database schema,
user flows, page-by-page structure, API reference, folder structure, and the phase-by-phase
build plan. This README is only about running the project.

## What's built

| Phase | Scope | Status |
|---|---|---|
| 1 — Foundation | Auth, multi-tenancy, DB schema, seller onboarding | ✅ |
| 2 — Store Builder | Business profile, storefront, products, categories, variants | ✅ |
| 3 — Selling | Cart, WhatsApp ordering, order management, Mark as Sold | ✅ |
| 4 — Customer Tools | Customer CRM, vouchers, gift cards | ✅ |
| 5 — Intelligence | AI assistant architecture + endpoint | ✅ (needs an API key — see below) |
| 6 — Platform Admin | Admin dashboard, seller management, categories, analytics | ✅ |

Every button in the product either works end-to-end against the real database, or —
in the one case where it depends on a credential you haven't added yet (the AI
Assistant) — clearly says so instead of faking a result.

## Stack

- **Backend**: FastAPI (Python), SQLAlchemy 2.0, Alembic migrations, PostgreSQL, JWT auth
- **Frontend**: React 19 + TypeScript, Vite, Tailwind CSS v4, React Router
- **Storage**: local disk in dev, behind a `StorageProvider` interface so S3 drops in later
- **AI**: behind an `AIProvider` interface — ships as "not configured" until you add a key

## Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 14+ running locally (or point `DATABASE_URL` at any Postgres instance)

## 1. Database

```bash
sudo -u postgres psql -c "CREATE USER hercommerce WITH PASSWORD 'hercommerce_dev_pw';"
sudo -u postgres psql -c "CREATE DATABASE hercommerce OWNER hercommerce;"
```

## 2. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp ../.env.example ../.env   # edit as needed — defaults work for local Postgres above

alembic upgrade head              # creates all tables
python -m app.seed.seed_categories  # seeds the starter category tree

uvicorn app.main:app --reload --port 8000
```

API docs (auto-generated): http://localhost:8000/docs

### Environment variables (`.env` at the repo root)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET_KEY` | Change this in production |
| `UPLOAD_DIR` / `UPLOAD_BASE_URL` | Local image storage (dev). Switch `STORAGE_PROVIDER=s3` + fill `S3_*` to move to object storage later — no endpoint code changes needed. |
| `AI_PROVIDER` / `AI_API_KEY` | Leave `AI_PROVIDER=none` to keep the AI Assistant honestly showing "not configured". Set to `openai` + a key once you've implemented `OpenAIProvider.generate_product_content` in `app/services/ai_provider.py`. |
| `CORS_ORIGINS` | Comma-separated list of allowed frontend origins |

## 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs at http://localhost:5173. `frontend/.env` points it at the backend
(`VITE_API_BASE_URL`) — update this for a non-local backend.

## 4. Try it out

1. Go to http://localhost:5173, click **Create my free store**, sign up.
2. Complete the 4-step onboarding wizard (pick a category, name your business, add a
   product, done).
3. From the dashboard, set your WhatsApp number under **Store**.
4. Open your storefront link (shown on the "Your store is ready!" screen and in
   **Store** settings) in a new tab.
5. Add the product to cart or tap **Buy / Order on WhatsApp** — this creates a real
   order and generates a `wa.me` deep link pre-filled with the order details.
6. Back in the dashboard, the order appears under **Orders**; move it through the
   fulfillment stages.
7. Try **Mark as Sold** on a product — the storefront immediately shows "SOLD OUT" and
   disables ordering; **Reactivate** brings it back.
8. Create a voucher under **Vouchers** and apply its code at checkout.
9. Create a gift card under **Gift Cards**, or visit `/store/<slug>/gift-card` as a
   customer to send one.

### Becoming a platform admin

There's no public sign-up path to the admin role (by design). Promote an existing
account directly in the database:

```sql
UPDATE users SET role = 'platform_admin' WHERE email = 'you@example.com';
```

Then visit http://localhost:5173/admin.

## Project layout

```
hercommerce/
├── ARCHITECTURE.md       # full system design — read this first
├── backend/               # FastAPI app (see backend/app/)
└── frontend/              # React + TypeScript app (see frontend/src/)
```

See `ARCHITECTURE.md` → **Folder Structure** for the full breakdown of both apps.

## Notes on what's intentionally simplified for the MVP

- **Payments**: Cash on Delivery and seller-configured manual payment instructions only.
  A `Payment` model and `payments` table already exist for when a real payment gateway is
  added — no schema change needed, just a `PaymentProvider` implementation.
- **WhatsApp**: uses standard `wa.me` deep links (no API keys or business account
  approval required). The order message format already carries every field a WhatsApp
  Business Cloud API template message would need, so upgrading later changes *how* the
  message is sent, not the data model.
- **AI Assistant**: architecture is real (provider interface, status endpoint, generation
  endpoint, frontend UI with a proper "needs configuration" state) but no AI provider is
  wired up, per the platform's "never fake functionality" rule. Implement
  `OpenAIProvider` (or another provider) in `backend/app/services/ai_provider.py` to turn
  it on.
- **Product editor**: add/edit is a modal rather than a separate page, and variants are
  added inline — this keeps the "add a product" flow to a handful of taps, in line with
  the platform's core simplicity requirement, while still supporting everything the spec
  asks for (multiple images, variants with their own stock, SKU, tags, sale price).
