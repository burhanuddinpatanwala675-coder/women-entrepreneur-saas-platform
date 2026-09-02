# HerCommerce — Architecture & Planning Document

*"If a woman can use WhatsApp, she can use this platform."*

A mobile-first, multi-tenant SaaS platform that lets women entrepreneurs launch and run
an online business — store, products, WhatsApp orders, vouchers, gift cards — without any
technical knowledge.

---

## 1. System Architecture

```
                                   ┌─────────────────────────┐
                                   │        Customers        │
                                   │  (public storefronts)   │
                                   └────────────┬─────────────┘
                                                │ HTTPS
                     ┌──────────────────────────┴───────────────────────────┐
                     │                                                      │
             ┌───────▼────────┐                                   ┌────────▼────────┐
             │  Seller / Admin │                                   │  Public Storefront│
             │  React SPA      │                                   │  React SPA (SSR-  │
             │  (dashboard)    │                                   │  friendly routes)  │
             └───────┬────────┘                                   └────────┬────────┘
                     │            REST / JSON over HTTPS (JWT)              │
                     └──────────────────────────┬───────────────────────────┘
                                                 │
                                        ┌────────▼─────────┐
                                        │   FastAPI Backend  │
                                        │  (stateless, horiz.│
                                        │   scalable pods)   │
                                        │                    │
                                        │  - Auth / JWT      │
                                        │  - Tenant scoping  │
                                        │  - Business logic  │
                                        │  - AI provider     │
                                        │    interface       │
                                        │  - WhatsApp link    │
                                        │    generator        │
                                        └────┬─────────┬─────┘
                                             │         │
                              ┌──────────────▼──┐   ┌──▼─────────────────┐
                              │   PostgreSQL     │   │  Object Storage     │
                              │  (multi-tenant,  │   │  (product images —  │
                              │   row-level      │   │  local disk in dev, │
                              │   tenant scoping │   │  S3-compatible in   │
                              │   via business_id│   │  prod)              │
                              │   on every table)│   └─────────────────────┘
                              └──────────────────┘

                              External integrations (pluggable, not hard-wired):
                              - AI provider (OpenAI/Anthropic) — behind a ProviderInterface
                              - WhatsApp — MVP uses wa.me deep links; architecture allows
                                swapping in WhatsApp Business Cloud API later without
                                touching the domain model (Order/OrderItem already carry
                                everything a Business API send would need).
                              - Payment gateway — Payments table + PaymentProvider
                                interface exist now, no gateway wired in MVP (COD /
                                manual payment only).
```

### Key architectural decisions

1. **Single database, shared schema, `business_id` tenant column** — every tenant-owned
   table carries a `business_id` foreign key. All queries are scoped through a
   `get_current_business()` dependency that is *impossible to bypass* from the seller-side
   API (every router uses it; there is no "list all products" endpoint without a tenant
   filter). This is simpler to operate than schema-per-tenant or DB-per-tenant while still
   giving 100% logical data isolation, and it scales comfortably to tens of thousands of
   tenants on a single well-indexed Postgres instance. It can migrate to schema-per-tenant
   later for very large customers without changing the application layer, because all
   access already goes through the tenant-scoped repository layer.
2. **Stateless backend, JWT auth** — any number of API instances can run behind a load
   balancer; sessions are not stored server-side (short-lived access token + refresh
   token).
3. **Public storefront is a separate route tree, not a separate app** — same React
   codebase, code-split, so a Business's storefront (`/store/:slug`) never loads seller
   dashboard code, and the dashboard never loads storefront code.
4. **AI and Payments are interfaces, not features bolted onto controllers** — `AIProvider`
   and `PaymentProvider` are abstract classes. The MVP ships a `NullAIProvider` /
   `ManualPaymentProvider` that clearly report "not configured" instead of faking output.
   Swapping in `OpenAIProvider` or a real payment gateway is a config change, not a rewrite.
5. **WhatsApp-first commerce** — the `Order` domain model does not assume a payment
   gateway. An order can be created purely from a WhatsApp click (status `new`), and the
   seller manages fulfillment by hand. This matches how these businesses actually operate
   today and keeps the MVP honest (no fake checkout).

---

## 2. Database Schema

PostgreSQL, SQLAlchemy ORM, Alembic migrations. All monetary values stored as integers in
minor currency units are avoided in favor of `NUMERIC(12,2)` for simplicity of MVP (PKR has
no minor unit in everyday use). All tenant tables have `business_id` + created/updated
timestamps + soft-delete where relevant.

```
users
  id (PK, uuid)
  email (unique, nullable if phone-only)
  phone (unique, nullable)
  password_hash
  full_name
  role                enum: seller | customer | platform_admin
  is_active            bool
  created_at, updated_at

businesses
  id (PK, uuid)
  owner_user_id (FK -> users.id)
  name
  slug (unique)                    -- storefront URL: /store/:slug
  short_description
  category_id (FK -> categories.id)
  logo_url
  cover_image_url
  whatsapp_number
  contact_email
  contact_phone
  social_links (jsonb)              -- {instagram, facebook, tiktok...}
  template                          -- fashion | beauty | food | handmade | minimal
  status               enum: active | suspended | pending
  onboarding_step                   -- resumable onboarding wizard
  created_at, updated_at

business_members
  id (PK)
  business_id (FK)
  user_id (FK)
  role                 enum: owner | staff
  created_at
  -- lets a business have >1 login later (staff accounts) without schema change

categories
  id (PK)
  name
  slug (unique)
  parent_id (FK -> categories.id, nullable)   -- supports subcategories
  icon                                         -- emoji / icon key for onboarding cards
  is_active
  sort_order

products
  id (PK, uuid)
  business_id (FK)
  category_id (FK -> categories.id)
  name
  slug
  description
  price                NUMERIC(12,2)
  sale_price           NUMERIC(12,2) nullable
  sku
  stock_quantity       int
  status               enum: available | low_stock | out_of_stock | sold | hidden
  low_stock_threshold  int default 3
  tags                 text[] / jsonb array
  created_at, updated_at

product_images
  id (PK)
  product_id (FK)
  url
  sort_order
  is_primary

product_variants
  id (PK)
  product_id (FK)
  name                 -- e.g. "Medium / Black"
  option_values         jsonb   -- {"size": "M", "color": "Black"}
  price                NUMERIC(12,2) nullable   -- overrides product price if set
  stock_quantity       int
  sku

customers
  id (PK)
  business_id (FK)      -- customers are scoped per-business (a shopper is a distinct
                          -- CRM row per seller, matched by phone within a business)
  name
  phone
  email nullable
  notes
  created_at, updated_at
  -- total_spent / order_count / last_order_at are computed, not stored (avoids drift)

orders
  id (PK, uuid)
  business_id (FK)
  customer_id (FK -> customers.id)
  order_number          -- human friendly, per-business sequential
  status                enum: new | confirmed | preparing | ready | dispatched |
                              delivered | cancelled
  channel                enum: whatsapp | storefront_cart
  subtotal, discount_total, total   NUMERIC(12,2)
  voucher_id (FK nullable)
  gift_card_id (FK nullable)
  payment_method         enum: cod | manual | unpaid
  whatsapp_message_sent  bool
  notes
  created_at, updated_at

order_items
  id (PK)
  order_id (FK)
  product_id (FK)
  product_variant_id (FK nullable)
  product_name_snapshot     -- preserved even if product later edited/deleted
  variant_name_snapshot
  unit_price
  quantity
  line_total

vouchers
  id (PK)
  business_id (FK)
  code (unique per business)
  discount_type          enum: percentage | fixed
  discount_value          NUMERIC
  min_purchase_amount
  max_discount_amount
  usage_limit             int nullable      -- total redemptions allowed
  usage_limit_per_customer int default 1
  applicable_product_ids   jsonb nullable
  applicable_category_ids  jsonb nullable
  starts_at, expires_at
  is_active
  created_at

voucher_usage
  id (PK)
  voucher_id (FK)
  order_id (FK)
  customer_id (FK)
  discount_applied
  used_at

gift_cards
  id (PK)
  business_id (FK)
  code (unique)
  initial_balance
  current_balance
  sender_name
  recipient_name
  recipient_contact        -- phone or email
  message
  delivery_date nullable
  status                    enum: active | redeemed | expired | cancelled
  expires_at
  created_at

gift_card_transactions
  id (PK)
  gift_card_id (FK)
  order_id (FK nullable)
  type                       enum: issue | redeem | refund
  amount
  balance_after
  created_at

store_settings
  id (PK)
  business_id (FK, unique)
  template
  accent_color
  show_search
  show_filters
  cod_enabled
  manual_payment_instructions text nullable
  announcement_banner text nullable

subscriptions
  id (PK)
  business_id (FK)
  plan                        enum: free | starter | growth   (MVP: all on `free`)
  status                       enum: active | past_due | cancelled
  current_period_end
  created_at

payments
  id (PK)
  business_id (FK)
  subscription_id (FK nullable)
  order_id (FK nullable)         -- reserved for future gateway checkout
  provider                        -- "manual" in MVP
  amount
  status                          enum: pending | succeeded | failed | refunded
  created_at

notifications
  id (PK)
  user_id (FK)
  business_id (FK nullable)
  type                             -- new_order, low_stock, voucher_expiring, etc.
  title
  body
  is_read
  created_at
```

**Indexes**: `business_id` on every tenant table; unique `(business_id, code)` on
vouchers/gift_cards; unique `slug` on businesses/products (per-business); `(business_id,
status)` on orders and products for dashboard queries.

**Relationships**: standard FKs with `ON DELETE CASCADE` from `business_id` down to
products/orders/etc. so deleting a business (admin action) cleanly removes tenant data;
`ON DELETE RESTRICT` on order → product to preserve order history even if a product is
deleted (mitigated by snapshot columns on `order_items`).

---

## 3. User Flows

### 3.1 Seller sign-up → first sale (critical path, target < 5 minutes)
1. Sign up (phone or email + password, or "continue" as a lightweight account).
2. Onboarding Screen 1 — "What do you sell?" → pick a category card.
3. Onboarding Screen 2 — business name + short description (category pre-filled).
4. Onboarding Screen 3 — add first product (photo, name, price, stock).
5. Onboarding Screen 4 — "Your store is ready!" → storefront URL shown + share buttons
   (WhatsApp share, copy link).
6. Seller lands on Dashboard Home with a "what's next" checklist (set WhatsApp number, add
   more products, customize store).
7. Customer opens storefront link → browses → taps **Order on WhatsApp** → WhatsApp opens
   with a pre-filled message → sends to seller's WhatsApp.
8. Seller receives the order in **Orders** (status `New`) automatically (order was created
   server-side the moment the customer tapped the button, before the WhatsApp redirect) and
   moves it through Confirmed → Preparing → Ready → Dispatched → Delivered.

### 3.2 Mark as Sold
Seller taps **Mark as Sold** on a product → status becomes `Sold` → storefront immediately
shows "SOLD OUT", Add-to-Cart/Order buttons disable → seller can tap **Reactivate** later to
restore the previous status.

### 3.3 Voucher redemption
Seller creates `WELCOME10` (10% off, min purchase Rs. 1,000, single-use per customer) →
customer enters code in cart → backend validates (active, not expired, usage limits, min
purchase, applicable products) → discount applied to order total → `voucher_usage` row
recorded on order confirmation.

### 3.4 Gift card
Customer (or seller, on a customer's behalf) buys a gift card → chooses amount → enters
recipient name/contact/message/optional delivery date → gift card issued with a unique code
→ recipient redeems the code at checkout on any product from that store → balance decrements
via a `gift_card_transactions` row.

### 3.5 Admin moderation
Admin logs into `/admin` → sees seller list → can deactivate a seller (their storefront
immediately shows "temporarily unavailable") → manages the global category tree → views
platform-wide analytics (active sellers, GMV proxy from order totals, orders/day).

---

## 4. Page-by-Page Structure

**Public / Marketing**
- `/` — landing page (what the platform is, sign up / log in)
- `/login`, `/signup`

**Seller Onboarding** (`/onboarding/*`, guarded: authenticated, no business yet)
- `/onboarding/category`
- `/onboarding/business`
- `/onboarding/first-product`
- `/onboarding/done`

**Seller Dashboard** (`/dashboard/*`, guarded: authenticated + has business)
- `/dashboard` — Home: today's overview + quick actions + "what's next" checklist
- `/dashboard/products` — list, filters by status
- `/dashboard/products/new`, `/dashboard/products/:id/edit`
- `/dashboard/orders` — list w/ status tabs
- `/dashboard/orders/:id` — detail + status workflow + WhatsApp message preview
- `/dashboard/customers` — CRM list
- `/dashboard/customers/:id` — profile + order history
- `/dashboard/vouchers` — list + create
- `/dashboard/gift-cards` — list + create/send
- `/dashboard/store` — storefront customization (logo, cover, template, contact,
  WhatsApp number, socials)
- `/dashboard/ai-assistant` — content generation tools (shows "connect an AI provider"
  state if unconfigured)
- `/dashboard/settings` — account, business profile, danger zone

**Public Storefront** (`/store/:slug/*`, no auth)
- `/store/:slug` — store home (cover, logo, categories, product grid, search)
- `/store/:slug/product/:productId` — product detail
- `/store/:slug/cart` — cart drawer/page
- `/store/:slug/gift-card` — buy/send a gift card

**Platform Admin** (`/admin/*`, guarded: role=platform_admin)
- `/admin` — analytics overview
- `/admin/sellers` — list + activate/deactivate
- `/admin/sellers/:id` — detail
- `/admin/categories` — manage category tree
- `/admin/orders`, `/admin/vouchers`, `/admin/gift-cards` — read-only platform-wide views

---

## 5. API Architecture

REST, JSON, versioned under `/api/v1`. OpenAPI docs auto-generated by FastAPI at `/docs`.

```
Auth
  POST   /api/v1/auth/signup
  POST   /api/v1/auth/login
  POST   /api/v1/auth/refresh
  GET    /api/v1/auth/me

Categories (public read)
  GET    /api/v1/categories

Onboarding / Business (seller-scoped)
  POST   /api/v1/businesses                further to onboarding
  GET    /api/v1/businesses/me
  PATCH  /api/v1/businesses/me
  GET    /api/v1/businesses/me/store-settings
  PATCH  /api/v1/businesses/me/store-settings
  POST   /api/v1/uploads/image              -> returns URL (local disk MVP)

Products (seller-scoped, JWT required)
  GET    /api/v1/products
  POST   /api/v1/products
  GET    /api/v1/products/:id
  PATCH  /api/v1/products/:id
  DELETE /api/v1/products/:id
  POST   /api/v1/products/:id/mark-sold
  POST   /api/v1/products/:id/reactivate
  POST   /api/v1/products/:id/images
  POST   /api/v1/products/:id/variants
  PATCH  /api/v1/products/:id/variants/:variantId
  DELETE /api/v1/products/:id/variants/:variantId

Public Storefront (no auth)
  GET    /api/v1/public/stores/:slug
  GET    /api/v1/public/stores/:slug/products
  GET    /api/v1/public/stores/:slug/products/:productId
  POST   /api/v1/public/stores/:slug/orders        (cart checkout / WhatsApp order create)
  POST   /api/v1/public/stores/:slug/vouchers/validate
  POST   /api/v1/public/stores/:slug/gift-cards/purchase
  POST   /api/v1/public/stores/:slug/gift-cards/redeem-check

Orders (seller-scoped)
  GET    /api/v1/orders
  GET    /api/v1/orders/:id
  PATCH  /api/v1/orders/:id/status

Customers (seller-scoped)
  GET    /api/v1/customers
  GET    /api/v1/customers/:id

Vouchers (seller-scoped)
  GET/POST /api/v1/vouchers
  GET/PATCH/DELETE /api/v1/vouchers/:id

Gift Cards (seller-scoped)
  GET/POST /api/v1/gift-cards
  GET /api/v1/gift-cards/:id

AI Assistant (seller-scoped)
  GET  /api/v1/ai/status                 -> {configured: bool}
  POST /api/v1/ai/generate-product-content

Admin (role=platform_admin)
  GET   /api/v1/admin/analytics
  GET   /api/v1/admin/sellers
  PATCH /api/v1/admin/sellers/:businessId/status
  GET/POST/PATCH/DELETE /api/v1/admin/categories
```

Every seller-scoped router depends on `get_current_business()`, which resolves the JWT →
user → their business, and every query filters `WHERE business_id = :current_business_id`.
There is no code path where a business ID is taken from client input for these routes.

---

## 6. Folder Structure

```
hercommerce/
├── ARCHITECTURE.md
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── alembic/
│   │   ├── versions/
│   │   └── env.py
│   ├── alembic.ini
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   │   ├── config.py          # env-driven settings
│   │   │   ├── security.py        # hashing, JWT
│   │   │   └── rate_limit.py
│   │   ├── db/
│   │   │   ├── base.py
│   │   │   └── session.py
│   │   ├── models/                # one file per entity
│   │   ├── schemas/                # Pydantic request/response models
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── router.py
│   │   │       ├── deps.py         # get_current_user/business/admin
│   │   │       └── endpoints/
│   │   │           ├── auth.py
│   │   │           ├── categories.py
│   │   │           ├── businesses.py
│   │   │           ├── uploads.py
│   │   │           ├── products.py
│   │   │           ├── public_storefront.py
│   │   │           ├── orders.py
│   │   │           ├── customers.py
│   │   │           ├── vouchers.py
│   │   │           ├── gift_cards.py
│   │   │           ├── ai_assistant.py
│   │   │           └── admin.py
│   │   ├── services/
│   │   │   ├── whatsapp.py         # deep link / message builder
│   │   │   ├── storage.py          # StorageProvider interface + LocalStorage impl
│   │   │   ├── ai_provider.py      # AIProvider interface + Null/OpenAI impl
│   │   │   ├── vouchers.py         # discount calculation
│   │   │   └── slugify.py
│   │   └── seed/
│   │       └── seed_categories.py
│   ├── uploads/                     # local image storage (dev)
│   ├── requirements.txt
│   └── tests/
└── frontend/
    ├── index.html
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── api/                     # typed API client
    │   ├── auth/                    # AuthContext, ProtectedRoute
    │   ├── components/              # Button, Card, StatCard, EmptyState, Nav...
    │   ├── pages/
    │   │   ├── marketing/
    │   │   ├── onboarding/
    │   │   ├── dashboard/
    │   │   ├── storefront/
    │   │   └── admin/
    │   ├── types/
    │   └── styles/
    └── package.json
```

---

## 7. Phase-by-Phase Implementation Plan

| Phase | Scope | Status in this build |
|---|---|---|
| 1 — Foundation | Project scaffolding, DB, auth, multi-tenancy, onboarding | ✅ Built |
| 2 — Store Builder | Business profile, storefront, products, categories, variants | ✅ Built |
| 3 — Selling | Cart, WhatsApp ordering, order management, Mark as Sold | ✅ Built |
| 4 — Customer Tools | Customer CRM, vouchers, gift cards | ✅ Built |
| 5 — Intelligence | AI assistant architecture + content generation endpoint | ✅ Architected, provider not configured (no API key) |
| 6 — Platform Admin | Admin dashboard, seller mgmt, categories, analytics | ✅ Built |

This document is the source of truth; the implementation below follows it exactly and does
not remove or contradict anything specified here as it's extended in future sessions.
