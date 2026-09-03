# HerCommerce — Architecture & Planning Document (Firebase-native, card-free)

*"If a woman can use WhatsApp, she can use this platform."*

A mobile-first, multi-tenant SaaS platform that lets women entrepreneurs launch and run
an online business — store, products, WhatsApp orders, vouchers, gift cards — without any
technical knowledge, or any server to manage.

> **Migration note**: this platform originally shipped on a FastAPI + PostgreSQL backend
> (still available under `legacy-postgres-backend/` for reference). It has been redesigned
> to run on Firebase's **free Spark plan** — Firestore, Firebase Authentication, and
> Firebase Hosting — plus **Cloudinary's free tier** for image uploads, so there is no
> database or server to provision, patch, or pay for, and **no credit card is ever
> required, anywhere, for anything in this build.** Every feature and rule from the
> original spec is preserved; only *where the logic lives* changed. This document
> describes that architecture as the current source of truth.
>
> **Why there are no Cloud Functions in this build**: Cloud Functions (every generation)
> require upgrading to Firebase's "Blaze" pay-as-you-go plan, which requires a billing card
> on file even when the actual bill stays $0 at low traffic. The owner made an explicit,
> considered call: never enter a card anywhere, even for a feature that would cost nothing
> to run. So this build has **zero Cloud Functions deployed**. Instead it relies on **Cloud
> Firestore's own transaction engine** — which is not a server you run, it's part of
> Firestore itself, and gives identical atomicity guarantees whether the transaction is
> started by a Cloud Function or directly by a browser — plus **strict Security Rules**
> that validate every write, including cross-document consistency via `getAfter()`.
> Section 3 covers exactly how. The one feature this genuinely cannot reach without either
> a server or exposing a secret key in the browser is the **AI Assistant** — it ships as
> real, working architecture (`functions/` — present, buildable, but intentionally
> undeployed) that honestly reports "not configured." It stays that way unless the owner
> decides, some other day, that a $0-bill Blaze plan is acceptable for that one feature.
>
> **Why images live on Cloudinary, not Firebase Storage**: discovered directly against the
> real project console (not assumed) — as of late 2024, Firebase changed policy so that
> **enabling Cloud Storage for Firebase on a new project also requires the Blaze plan**,
> even to stay within its free usage tier. That's the same card-on-file requirement as
> Cloud Functions, so Storage was dropped for the same reason. Product photos, logos, and
> cover images instead upload directly from the browser to **Cloudinary's free tier**
> (confirmed card-free at signup), using an *unsigned upload preset* — Cloudinary's
> purpose-built mechanism for secretless client-side uploads, scoped by folder/size/format
> restrictions configured once in the Cloudinary dashboard rather than in code. See section
> 3.4 and `frontend/src/cloudinary/upload.ts` for the trade-offs this carries.

---

## 1. System Architecture

```
                                   +--------------------------+
                                   |         Customers        |
                                   |  (public storefronts,    |
                                   |   no account needed)     |
                                   +-------------+-------------+
                                                 | HTTPS
                     +------------------------------+---------------------------------+
                     |                                                                |
             +-------v---------+                                          +----------v---------+
             |  Seller / Admin  |                                          |  Public Storefront  |
             |  React SPA       |                                          |  React SPA           |
             |  (dashboard)     |                                          |  (same bundle,        |
             |                  |                                          |  code-split)          |
             +-------+---------+                                          +----------+---------+
                     |                                                                |
                     +------------------------------+---------------------------------+
                                                     |  served by Firebase Hosting (CDN, free)
                                                     |  talks DIRECTLY to Firebase SDKs
                                                     |  (and to Cloudinary for images) —
                                                     |  there is no backend server anywhere
                              +----------------------+-----------------------+
                              |                      |                       |
                    +---------v---------+  +---------v---------+  +----------v----------+
                    |  Firebase Auth     |  |  Cloud Firestore   |  |  Cloudinary (free    |
                    |  (email/password;  |  |  (multi-tenant;    |  |  tier, no card)      |
                    |  Spark/free plan)  |  |  Security Rules    |  |  product/logo/cover  |
                    |                    |  |  scope every doc   |  |  images — unsigned   |
                    |                    |  |  by businessId,    |  |  upload preset scopes|
                    |                    |  |  read live from    |  |  writes; public read |
                    |                    |  |  users/{uid};      |  |  by default          |
                    |                    |  |  Spark/free)       |  |                      |
                    +--------------------+  +--------------------+  +----------------------+
```

Firebase Storage is deliberately **not** in this diagram: as of late 2024, enabling it on a
new project also requires the Blaze plan (confirmed directly against this project's
console), the same card-on-file requirement Cloud Functions carry. Cloudinary's free tier
fills that gap instead — see the migration note above and section 3.4.

All writes — **including public-storefront order creation by a signed-out customer** — go
directly from the browser to Firestore, inside a client-initiated `runTransaction()` call.
Firestore's transaction engine (not a server) gives atomicity. Security Rules — evaluated
by Firestore on every single request, using `getAfter()`/`existsAfter()` to check the
*whole transaction's* resulting state — are what stop a malicious client from writing
something invalid. Section 3 covers this in full.

External integrations (pluggable, not hard-wired):
- **AI provider** (OpenAI/Anthropic) — real `AIProvider` interface exists under
  `functions/`, but is **not deployed**, because deploying any Cloud Function requires the
  Blaze plan (a card on file, even at $0 actual cost) — a hard constraint for this build.
  The AI Assistant page ships real and honestly reports "not configured" until revisited.
- **WhatsApp** — MVP uses `wa.me` deep links, built client-side the moment an order is
  created. Architecture allows swapping in the WhatsApp Business Cloud API later (which
  does need a server) without touching the Firestore data model.
- **Payment gateway** — a `payments` collection exists now; no gateway wired in MVP
  (Cash on Delivery / manual payment instructions only).

### Key architectural decisions

1. **Firestore, not a relational database** — there is no server to run migrations on and
   no connection pool to size. Every tenant-owned document carries a `businessId` field
   (the Firestore analogue of the old `business_id` foreign key), and **every** read/write
   path re-derives the caller's `businessId` from their own `users/{uid}` Firestore
   document — never from client-supplied input. This is the same guarantee the old
   `get_current_business()` FastAPI dependency gave, enforced declaratively by Security
   Rules instead of in application code.
2. **No Cloud Functions, no custom claims — a deliberate choice, not an oversight.** An
   earlier draft of this build used Cloud Functions for trusted server logic and Firebase
   Auth custom claims for the tenant boundary. Both were dropped because Cloud Functions
   require the Blaze plan. Instead, **`role` and `businessId` live as plain fields on the
   `users/{uid}` Firestore document**, and Security Rules read them with
   `get(/databases/$(database)/documents/users/$(request.auth.uid)).data`. That costs one
   extra document read per rule evaluation (trivially inside the free daily quota at this
   platform's scale) instead of a free token-claim lookup — the entire price paid for
   staying card-free.
3. **Top-level collections with a `businessId` field, not deep subcollections.** Firestore
   subcollections would force every tenant's products into `businesses/{id}/products/*`,
   which makes platform-admin cross-tenant queries (analytics, moderation) awkward or
   impossible without extra collection-group indexes. Instead `products`, `orders`,
   `customers`, `vouchers`, and `giftCards` are top-level collections filtered by
   `businessId`, indexed as `(businessId, status)`, `(businessId, createdAt)`, etc. — this
   mirrors the old SQL indexing strategy almost exactly, and lets the admin dashboard run
   Firestore **aggregation queries** (`count()`, `sum()`) across all tenants directly,
   still gated by Security Rules on the admin's role.
4. **Deterministic document IDs replace "a server checks uniqueness" logic.** With no
   Cloud Function to run a check-then-write on the server's own terms, uniqueness has to
   be a Firestore-native guarantee instead: a business's document ID *is* its slug
   (`businesses/{slug}`), a voucher's ID *is* `{businessId}_{code}`, a gift card's ID *is*
   its code. Firestore itself distinguishes a **create** (the path doesn't exist yet) from
   an **update** (it does) as the operation type Security Rules see — so "only the
   original creator can ever write here, and only once" falls out of the rules for free,
   with no query needed. A same-slug or same-code collision is simply rejected by Rules as
   an unauthorized "update," and the client shows a friendly retry (adjust the store name,
   or regenerate a gift-card code and try again).
5. **Client writes directly to Firestore (and uploads directly to Cloudinary) everywhere —
   including the one transactional operation that used to be a Cloud Function: placing an
   order.** A
   *stranger on a public storefront* runs `runTransaction()` from their own browser to
   decrement stock, apply a voucher/gift card, upsert their own customer record, and create
   the order — all atomically. What stops them from cheating isn't trusted server code
   (there isn't any) — it's Security Rules using `getAfter()` to check the *entire
   transaction's* resulting state is internally consistent: a product's new
   `stockQuantity` must equal its old value minus exactly the ordered quantity; each order
   item's `unitPrice` must match the real product's own price fields, not whatever number
   the client sent; a voucher's discount must match what the discount formula produces
   from its own stored `discountValue`; a gift card's balance can only decrease by the
   amount actually applied to that order. This is more rules code than the old
   application-layer check, but the guarantee has the same shape: nothing trusted is taken
   from client input.
6. **AI and Payments remain interfaces, not features bolted onto the app.** The
   `AIProvider` abstraction lives in `functions/src/services/aiProvider.ts` — present,
   real, and *not deployed*. A `NullAIProvider` is what the UI actually talks to today (via
   a static `config/ai` Firestore doc, see section 6), and it reports "not configured"
   honestly rather than faking a generated result.
7. **WhatsApp-first commerce, unchanged** — order creation doesn't assume a payment
   gateway. An order can be created purely from a WhatsApp click (`status: "new"`), and the
   seller manages fulfillment by hand via direct Firestore status updates, same as before.

---

## 2. Data Model (Cloud Firestore)

No foreign keys, no joins — every relationship is either a `businessId`/`productId`-style
reference field (resolved with an extra read where needed) or a small denormalized
snapshot embedded at write time (e.g. an order item's product name, so it survives the
product being edited or deleted later — the same "snapshot" pattern the old
`order_items.product_name_snapshot` column used). Several collections use a **deterministic
document ID** instead of an auto-ID specifically so Security Rules can enforce uniqueness
via Firestore's own create-vs-update distinction (see decision 4 above) — flagged below.

```
users/{uid}                              — doc ID = Firebase Auth uid; created by the
                                            CLIENT itself, directly, the moment
                                            createUserWithEmailAndPassword resolves (no
                                            trigger — there are no Cloud Functions)
  fullName, email, phone
  role                    "seller" | "platform_admin"      -- see rules: a client may only
                                                            -- ever create this doc for
                                                            -- itself with role:"seller";
                                                            -- "platform_admin" is granted
                                                            -- only by hand-editing the doc
                                                            -- in the Firebase console
  businessId               nullable — set once onboarding finishes; a client may only ever
                            move this from null to a business it just created (see rules)
  isActive                 bool
  createdAt, updatedAt

businesses/{slug}                        — doc ID = the business's own slug (deterministic
                                            — see decision 4). Storefront URL: /store/:slug
  ownerUserId               (uid) — Rules require this to equal request.auth.uid on create,
                                     and forbid ever changing it after
  name, slug (mirrors the doc ID, kept as a field too for easy display)
  shortDescription
  categoryId
  logoUrl, coverImageUrl
  whatsappNumber, contactEmail, contactPhone
  socialLinks               map {instagram, facebook, tiktok, ...}
  template                  "fashion" | "beauty" | "food" | "handmade" | "minimal"
  status                    "active" | "suspended" | "pending"
  onboardingStep            number — resumable onboarding wizard
  storeSettings             map { accentColor, showSearch, showFilters, codEnabled,
                                  manualPaymentInstructions, announcementBanner }
                            (folded into the business doc — 1:1 data, no reason to split)
  createdAt, updatedAt

categories/{categoryId}                  — public read, platform-admin write
  name, slug, parentId (nullable), icon, isActive, sortOrder

products/{productId}                     — auto-ID (no uniqueness constraint needed)
  businessId, categoryId
  name, slug, description
  price, salePrice (nullable)
  sku, stockQuantity
  status                    "available" | "low_stock" | "out_of_stock" | "sold" | "hidden"
  lowStockThreshold          default 3
  tags                       array<string>
  images                     array<{ url, cloudinaryPublicId, sortOrder, isPrimary }>
  variants                   array<{ id, name, optionValues: map, price (nullable),
                                     stockQuantity, sku }>
                            (embedded, not a subcollection — a product's own variants are
                            never queried independently of the product, and embedding lets
                            the storefront product page render from a single document read;
                            stock decrements still run inside a client-side Firestore
                            transaction that rewrites the specific array entry, verified by
                            Rules — see section 3)
  createdAt, updatedAt

orders/{orderId}                         — auto-ID; created directly by the customer's
                                            browser inside a runTransaction() call, with NO
                                            Firebase Auth session required (Rules allow an
                                            unauthenticated create when the write is fully
                                            internally consistent — see section 3)
  businessId, customerId
  orderNumber                human-friendly, generated client-side from a timestamp +
                              random suffix (e.g. "ORD-M4F2K-QX") — not a strictly
                              sequential counter, since a shared counter document writable
                              by anonymous clients would itself be a race/abuse surface;
                              this is unique enough in practice and still sorts by time
  status                     "new" | "confirmed" | "preparing" | "ready" | "dispatched" |
                              "delivered" | "cancelled"
  channel                    "whatsapp" | "storefront_cart"
  items                      array<{ productId, productVariantId (nullable),
                                     productNameSnapshot, variantNameSnapshot,
                                     unitPrice, quantity, lineTotal }>
  subtotal, discountTotal, total
  voucherId (nullable), giftCardId (nullable)
  paymentMethod              "cod" | "manual" | "unpaid"
  whatsappMessageSent        bool
  notes
  createdAt, updatedAt
  -- Security Rules require every numeric field above to be independently re-derivable
  -- from the referenced product/voucher/gift-card documents as they'll exist AFTER the
  -- transaction (getAfter()) — see section 3. The owning seller may directly update
  -- `status` and `notes` only after creation (Rules whitelist exactly those two fields).

customers/{customerId}                   — auto-ID
  businessId                 — a shopper is a distinct CRM row per seller, matched by
                                phone within a business, same as before
  name, phone, email, notes
  orderCount, totalSpent, lastOrderAt   — updated by the same client transaction that
                                           creates an order (increment / merge), verified
                                           by Rules to only ever move in the correct
                                           direction by the correct amount
  createdAt, updatedAt

vouchers/{businessId}_{code}             — doc ID is a composite key (deterministic — see
                                            decision 4), so "one code per business" is a
                                            free Firestore guarantee, no query needed
  businessId
  code
  discountType               "percentage" | "fixed"
  discountValue, minPurchaseAmount, maxDiscountAmount
  usageLimit (nullable), usageLimitPerCustomer (default 1)
  applicableProductIds, applicableCategoryIds     (nullable arrays)
  startsAt, expiresAt, isActive
  timesUsed                  incremented by the same order-creating transaction, Rules
                              require exactly +1 and require a matching usage doc
  createdAt

  vouchers/{id}/usage/{customerId}_{orderId}     — subcollection, doc ID composite so a
                                                    customer can't record double usage on
                                                    the same order; written only as part of
                                                    the order-creating transaction
    orderId, customerId, discountApplied, usedAt

giftCards/{code}                         — doc ID is the code itself (deterministic — see
                                            decision 4); client generates a random code and
                                            Rules reject the create if that code is already
                                            taken (a natural "update", denied)
  businessId
  code (mirrors the doc ID)
  initialBalance, currentBalance
  senderName, recipientName, recipientContact, message, deliveryDate (nullable)
  status                     "active" | "redeemed" | "expired" | "cancelled"
  expiresAt, createdAt

  giftCards/{code}/transactions/{transactionId}   — subcollection
    orderId (nullable), type: "issue" | "redeem" | "refund", amount, balanceAfter, createdAt

subscriptions/{businessId}                — doc id == businessId, 1:1
  plan                       "free" | "starter" | "growth"    (MVP: always "free")
  status                     "active" | "past_due" | "cancelled"
  currentPeriodEnd, createdAt

payments/{paymentId}
  businessId, subscriptionId (nullable), orderId (nullable)
  provider                   "manual" in MVP
  amount, status              "pending" | "succeeded" | "failed" | "refunded"
  createdAt

notifications/{notificationId}
  userId, businessId (nullable)
  type                        "new_order" | "low_stock" | "voucher_expiring" | ...
  title, body, isRead, createdAt

config/ai                                — single public doc, deploy-time managed
  configured (bool), provider (string)   -- lets the frontend show the AI Assistant's
                                            real state with one free document read,
                                            instead of needing a function call
```

Note what's gone since the Cloud-Functions draft of this document: no `counters/*`
collection (order numbers are no longer a server-arbitrated sequence — see `orders` above)
and no Cloud-Function-only write paths — every collection above is written directly by
whichever client (seller or anonymous customer) Security Rules judge is allowed to.

**Indexes** (`firestore.indexes.json`): composite indexes on `(businessId, status)` and
`(businessId, createdAt DESC)` for `products`, `orders`, `customers`, `vouchers`,
`giftCards`.

---

## 3. Multi-Tenancy & Security Rules Strategy

This is the section that replaces both `get_current_business()` *and* the Cloud Functions
this build no longer has. With no server anywhere, **Firestore Security Rules are the
entire trust boundary** — every guarantee this app makes about data integrity has to be
expressible as a Rule, because there is nothing else standing between a browser's request
and the database.

### 3.1 Where role/businessId come from (no custom claims)

Custom claims can only be set by a server (the Admin SDK) — with zero Cloud Functions,
they're unavailable. Instead, a signed-in user's `role` and `businessId` are read live from
their own `users/{uid}` document with a helper used throughout `firestore.rules`:

```
function me() {
  return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
}
function myBusinessId() { return isSignedIn() ? me().businessId : null; }
function myRole()       { return isSignedIn() ? me().role : null; }
function isAdmin()      { return myRole() == "platform_admin"; }
function ownsBusiness(businessId) { return isSignedIn() && myBusinessId() == businessId; }
```

The `users/{uid}` document itself is the one piece of the trust chain a client creates
directly: Rules allow a **create** (never an update after) only when `request.auth.uid`
matches the document ID, `role` is exactly `"seller"` (never `"platform_admin"` — there is
still no public path to that role; it's granted by hand-editing the document in the
Firebase console, same as the old "no signup path to admin" rule), and `businessId` is
`null`. Moving `businessId` from `null` to a real value later (during onboarding) is a
single allowed **update**, constrained to that one field, and only when the referenced
`businesses/{businessId}` document (created in the *same* transaction) has
`ownerUserId == request.auth.uid` — checked with `getAfter()` so it sees the transaction's
end state, not a stale read.

### 3.2 Firestore Security Rules, collection by collection

- **`businesses/{slug}`**: public **read** (the storefront is public). **create**: only if
  `request.resource.data.ownerUserId == request.auth.uid` and the caller doesn't already
  own a business (`myBusinessId() == null`) — the slug-as-ID scheme means a second seller
  attempting the same slug hits Firestore's own **update** path instead of **create**,
  which is denied to a non-owner. **update**: owner or admin only, and `ownerUserId` may
  never change.
- **`products/{id}`**: public **read**. **create/update/delete**: only the owning seller
  (`businessId` on the incoming/existing doc matches `myBusinessId()`) or an admin.
- **`orders/{id}`**: **read**: owning seller or admin. **create**: allowed even when
  `request.auth == null` (a guest customer), but only when the whole transaction is
  internally consistent — see 3.3. **update**: owning seller only, and only the `status`
  and `notes` fields may change. **delete**: never.
- **`customers/{id}`, `vouchers/{id}`, `giftCards/{id}`**: owner-or-admin CRUD for
  seller-initiated changes (creating a voucher, editing a customer note); the specific
  writes that happen *as part of placing an order* (customer upsert, voucher `timesUsed`,
  gift-card balance) are covered by the order-transaction rules in 3.3, which also apply
  here since they're the same transaction. One exception worth calling out:
  `customers/{id}` splits `read` into `get` (public) and `list` (owner/admin-only) — the
  anonymous checkout transaction has to look up "does a customer with this phone already
  exist" *before* deciding whether to create or update, and Firestore Security Rules
  evaluate every read inside a transaction immediately (not deferred to commit the way
  `getAfter()` writes are), so there's no way to make that one lookup conditional on the
  order it's part of. A public `get` only lets you fetch a customer doc by its *exact*
  `businessId_phone` ID — it doesn't let anyone enumerate a seller's customer list, since
  `list` (which is what a `where('businessId','==',...)` query needs) stays locked down.
- **`categories/{id}`**: public read, admin-only write.
- **`notifications/{id}`**: read/update (mark-read only) restricted to
  `request.auth.uid == resource.data.userId`.
- **`config/{id}`**: public read, no client write (kept in sync manually / by a future
  deploy step, not by app code).

### 3.3 The hard part: validating order creation with no server

Placing an order is a `runTransaction()` call from the customer's own browser that touches
up to five documents at once: one or more `products/{id}` (stock decrement), the
`customers/{id}` doc (upsert), optionally `vouchers/{id}` (usage +1) and `giftCards/{id}`
(balance decrement), and the new `orders/{id}` itself. Security Rules validate each
document write *in the context of the whole transaction* using `getAfter()`
(read-as-it-will-be) and `existsAfter()`:

- **Stock integrity**: a product write is only allowed if
  `getAfter(product).stockQuantity == resource.data.stockQuantity - <ordered quantity for
  that product in the new order doc>` — the ordered quantity is read out of
  `getAfter(orders/$(orderId)).items`, so the rule is literally checking the order and the
  stock decrement agree with each other, not trusting either side alone. A negative result
  or a mismatch is rejected outright.
- **Price integrity**: the rule recomputes each order item's expected `unitPrice` from the
  *product document itself* (`salePrice ?? price`, or the matching variant's price) and
  requires the order's stored `unitPrice`/`lineTotal` to match — a client cannot submit an
  order with a self-chosen price.
- **Voucher integrity**: if `voucherId` is set, the rule re-derives the expected discount
  from the voucher document's own `discountType`/`discountValue`/`maxDiscountAmount` and
  requires `discountTotal` to match, requires `getAfter(voucher).timesUsed ==
  resource.data.timesUsed + 1`, and requires a corresponding
  `vouchers/{id}/usage/{customerId}_{orderId}` document to exist post-transaction (which
  also makes re-using the same voucher on the same order impossible, since that path would
  already exist).
- **Gift-card integrity**: similarly, `getAfter(giftCard).currentBalance` must equal the
  old balance minus exactly the amount applied to *this* order, and never go negative.
- **Customer upsert integrity**: `orderCount`/`totalSpent` may only move by the values this
  transaction's own order justifies.

This is meaningfully more rules code than the old application-layer check would have been,
and it is a real trade-off: a determined attacker with deep knowledge of Firestore Rules
has more surface to probe than they would against server-side code, because the *rules
themselves* are downloadable and readable by anyone. For a small business storefront this
is an accepted, well-established pattern for card-free Firebase apps — not a shortcut taken
without understanding the cost.

### 3.4 Image uploads (Cloudinary, not Firestore Rules)

Product photos, logos, and cover images bypass Firestore/Firebase entirely — they upload
straight from the browser to Cloudinary's REST API using an **unsigned upload preset**
(`frontend/src/cloudinary/upload.ts`), Cloudinary's purpose-built mechanism for secretless
client-side uploads. No API secret ever touches the browser; instead the preset itself
(configured once in the Cloudinary dashboard, not in code) restricts what an upload is
allowed to be — folder, file size, allowed formats. The resulting public URL is then
written into the relevant Firestore document (`products/{id}.images`,
`businesses/{slug}.logoUrl`/`coverImageUrl`) as a normal Rules-gated Firestore write, same
as any other seller-owned field.

**Trade-off, stated plainly**: the preset name isn't a true secret — it's visible in this
app's network requests, so in principle anyone could discover it and upload their own files
against the same Cloudinary account, consuming its free quota. The preset's own
format/size restrictions are what bound that risk, not access control, because Cloudinary's
unsigned-upload model has no concept of "only this app's users." This is an accepted,
documented trade-off for a small, low-traffic storefront staying entirely card-free — the
same spirit as the Firestore Rules trade-off in section 3.3. Deleting an image only removes
it from the owning document's `images` array / `logoUrl` field — the underlying Cloudinary
asset isn't deleted (Cloudinary's delete API requires a signed, secret-holding request,
which this build has no server to make), a known limitation worth revisiting if it ever
matters at scale.

---

## 4. User Flows

*(Unchanged from the original spec in shape — the mechanics behind each step now run as
direct Firestore transactions from the browser instead of FastAPI/Postgres or Cloud
Functions; the flows themselves are identical to what a seller or customer experiences.)*

### 4.1 Seller sign-up → first sale (critical path, target < 5 minutes)
1. Sign up with email + password (Firebase Auth) → the client immediately creates its own
   `users/{uid}` doc with `role: "seller"`, `businessId: null` (Rules-gated, see 3.1).
2. Onboarding Screen 1 — "What do you sell?" → pick a category card (read from `categories`).
3. Onboarding Screen 2 — business name + short description → the client runs a
   `runTransaction()` that creates `businesses/{slug}`, sets `users/{uid}.businessId`, and
   creates a free-plan `subscriptions/{slug}` doc, all validated by Rules in one shot.
4. Onboarding Screen 3 — add first product → direct Firestore write to `products` (now
   allowed, since `users/{uid}.businessId` is set).
5. Onboarding Screen 4 — "Your store is ready!" → storefront URL shown + share buttons.
6. Seller lands on Dashboard Home with a "what's next" checklist.
7. Customer opens the storefront link (no login) → browses (public Firestore reads) →
   taps **Order on WhatsApp** → their browser runs the order-creation transaction described
   in 3.3 (stock check + decrement, customer upsert, order creation) *before* building the
   WhatsApp deep link and redirecting.
8. Seller sees the order appear in **Orders** in real time (a live `onSnapshot` listener,
   not a polling REST call) and moves it through Confirmed → Preparing → Ready →
   Dispatched → Delivered via direct status-only Firestore updates.

### 4.2 Mark as Sold
Direct Firestore update: seller taps **Mark as Sold** → `products/{id}.status = "sold"`
(Rules-gated, same-document write) → the storefront's live listener reflects "SOLD OUT"
immediately, Add-to-Cart/Order buttons disable → **Reactivate** restores the prior status.

### 4.3 Voucher redemption
Seller creates `WELCOME10` (direct Firestore write to `vouchers/{businessId}_WELCOME10`,
composite ID enforcing one code per business) → customer enters the code in the cart → the
frontend reads the voucher doc directly and runs the same eligibility/discount logic
client-side for instant feedback → on checkout, the order-creation transaction re-derives
and re-validates the same numbers via Security Rules (3.3) — the earlier client-side
preview is never trusted on its own.

### 4.4 Gift card
Customer (or seller) generates a random code client-side and writes `giftCards/{code}`
directly (Rules reject the write if that code already exists, so the client just retries
with a new random code on the rare collision) → recipient redeems the code at checkout →
the order-creation transaction's gift-card branch validates balance and writes a `redeem`
`giftCards/{code}/transactions/{id}` entry inside the same transaction that decrements
`currentBalance` (3.3).

### 4.5 Admin moderation
Admin logs into `/admin` (their `users/{uid}.role == "platform_admin"`, granted by hand in
the Firebase console — no self-serve path) → sees seller list (`businesses` collection,
readable cross-tenant by Rules for admins) → directly updates `businesses/{slug}.status` to
suspend a seller (their storefront's public read of `status` immediately shows "temporarily
unavailable") → manages the global `categories` collection directly → views platform-wide
analytics computed with Firestore aggregation queries (`count()`/`sum()` across all
tenants, cheap because aggregation queries don't bill or transfer per-document).

---

## 5. Page-by-Page Structure

*(Unchanged — routes are identical; only the data layer behind each page changed.)*

**Public / Marketing**
- `/` — landing page, `/login`, `/signup`

**Seller Onboarding** (`/onboarding/*`, guarded: authenticated, `businessId` not yet set)
- `/onboarding/category`, `/onboarding/business`, `/onboarding/first-product`, `/onboarding/done`

**Seller Dashboard** (`/dashboard/*`, guarded: authenticated + `businessId` set)
- `/dashboard`, `/dashboard/products` (+ `/new`, `/:id/edit`), `/dashboard/orders`
  (+ `/:id`), `/dashboard/customers` (+ `/:id`), `/dashboard/vouchers`,
  `/dashboard/gift-cards`, `/dashboard/store`, `/dashboard/ai-assistant`,
  `/dashboard/settings`

**Public Storefront** (`/store/:slug/*`, no auth)
- `/store/:slug`, `/store/:slug/product/:productId`, `/store/:slug/cart`,
  `/store/:slug/gift-card`

**Platform Admin** (`/admin/*`, guarded: `users/{uid}.role == "platform_admin"`)
- `/admin`, `/admin/sellers` (+ `/:id`), `/admin/categories`, `/admin/orders`,
  `/admin/vouchers`, `/admin/gift-cards`

---

## 6. Client Data-Access Architecture

Replaces the REST API reference. Every operation is a direct Firestore SDK call from the
client, Security-Rules-enforced (images go to Cloudinary instead, see 3.4) — there is no
callable API layer for app logic.

```
Read categories                            getDocs(collection(db, "categories"))
Read AI Assistant status                    getDoc(doc(db, "config", "ai")) -> { configured, provider }
Create own user profile (post-signup)       setDoc(doc(db, "users", uid), {...}) — create-only, Rules-gated
Create business + claim businessId          runTransaction(): set businesses/{slug},
  (onboarding step 2)                       set subscriptions/{slug}, update users/{uid}.businessId
Read/write own business + store settings    getDoc/updateDoc(doc(db, "businesses", slug))
CRUD own products (incl. images/variants)   getDocs/addDoc/updateDoc/deleteDoc on "products"
  where businessId == <own businessId>
Mark product sold / reactivate              updateDoc(products/{id}, { status })
Read own orders (live)                      onSnapshot(query(orders, where businessId==...))
Update order status/notes                   updateDoc(orders/{id}, { status | notes })
Place an order (public storefront)          runTransaction(): decrement stock, upsert
                                             customer, apply voucher/gift-card, create the
                                             order — validated end-to-end by Security Rules
                                             (section 3.3); works with no Firebase Auth
                                             session at all
Validate a voucher / check a gift card      plain getDoc reads + the same eligibility logic
  (cart preview, before checkout)           run client-side in frontend/src/firebase/*
                                             (re-validated authoritatively by Rules at the
                                             actual order-creation transaction)
Purchase a gift card                        client generates a random code, setDoc(doc(db,
                                             "giftCards", code), {...}) — create-only,
                                             retried client-side on the rare collision
CRUD own vouchers                           addDoc/updateDoc/deleteDoc on "vouchers"
  (doc ID = `${businessId}_${code}`)
CRUD own customers (notes only — records    updateDoc/getDocs on "customers"
  are otherwise order-transaction-managed)
Upload product/logo/cover images            uploadImage() (frontend/src/cloudinary/
                                             upload.ts) — POSTs directly to Cloudinary's
                                             REST API with an unsigned upload preset, then
                                             the returned URL is written into the owning
                                             Firestore doc as a normal field update
Read public storefront (business+products)  getDocs on "businesses"/"products"
  where slug==... / businessId==... (public Rules)
Admin: read all sellers/products/orders     getDocs (role==platform_admin bypasses
  for moderation + analytics aggregation)   businessId scoping in Rules)
Admin: set seller status / manage           updateDoc on "businesses"; CRUD on "categories"
  categories
```

`functions/` still exists in the repo — it holds only the AI Assistant's `AIProvider`
interface (`functions/src/services/aiProvider.ts`) and is deliberately **excluded from
`firebase.json`'s deploy target**, so a plain `firebase deploy` never tries to deploy it
(and never prompts for Blaze). See the migration note at the top of this document.

---

## 7. Folder Structure

```
hercommerce/
├── ARCHITECTURE.md
├── firebase.json                 # hosting + firestore + emulators config
│                                  # (NO "functions" or "storage" target — neither is used;
│                                  # both would require the Blaze plan)
├── .firebaserc                   # project alias -> real Firebase project ID
├── firestore.rules               # the entire trust boundary — see section 3
├── firestore.indexes.json
├── legacy-postgres-backend/       # the original FastAPI backend — kept for reference,
│                                   # no longer deployed (see README for why)
├── functions/                     # AI Assistant only — present, builds, NOT deployed by
│   │                               # default (would require the Blaze plan). Revisit only
│   │                               # if that trade-off is ever acceptable.
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── config.ts
│       └── services/
│           └── aiProvider.ts       # AIProvider interface + Null/OpenAI impl
├── scripts/
│   └── seed.ts                    # one-off category-tree + config/ai seeder, run locally
│                                   # with the Admin SDK — this is a plain Node script, NOT
│                                   # a Cloud Function, so it needs no Blaze plan either
└── frontend/
    ├── index.html
    ├── vite.config.ts
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── firebase/
    │   │   ├── client.ts            # initializeApp + getAuth/getFirestore, connects to
    │   │   │                        # emulators in dev (no getStorage — see 3.4)
    │   │   ├── types.ts             # Firestore doc types (source of truth: section 2)
    │   │   ├── errors.ts            # friendly messages for Firebase SDK errors
    │   │   ├── slugify.ts           # business slug / voucher / gift-card code generation
    │   │   ├── vouchers.ts          # discount calculation + eligibility (client preview)
    │   │   └── whatsapp.ts          # wa.me deep link / message builder
    │   ├── cloudinary/
    │   │   └── upload.ts            # direct-to-Cloudinary image upload (unsigned preset)
    │   ├── auth/                    # AuthContext (onAuthStateChanged + users/{uid} doc), guards
    │   ├── components/               # unchanged — Button, Card, StatCard, EmptyState...
    │   ├── pages/
    │   │   ├── marketing/, onboarding/, dashboard/, storefront/, admin/   # unchanged tree
    │   └── styles/
    └── package.json
```

---

## 8. Phase-by-Phase Implementation Plan

| Phase | Scope | Status |
|---|---|---|
| 1 — Foundation | Original FastAPI/Postgres build (auth, multi-tenancy, onboarding) | ✅ Built (now legacy) |
| 2 — Store Builder | Business profile, storefront, products, categories, variants | ✅ Built (now legacy) |
| 3 — Selling | Cart, WhatsApp ordering, order management, Mark as Sold | ✅ Built (now legacy) |
| 4 — Customer Tools | Customer CRM, vouchers, gift cards | ✅ Built (now legacy) |
| 5 — Intelligence | AI assistant architecture + content generation endpoint | ✅ Built (now legacy) |
| 6 — Platform Admin | Admin dashboard, seller mgmt, categories, analytics | ✅ Built (now legacy) |
| **7 — Firebase Foundation** | Firestore data model + Security Rules, Firebase project scaffold | ✅ This document + `firebase.json`/rules |
| **8 — Card-free pivot** | Drop Cloud Functions/Blaze; rules-only multi-tenancy + order transactions; AI Assistant parked as honest "not configured" | ✅ Done — this is the current architecture |
| **9 — Frontend Firebase Rewrite** | Firebase Auth (users/{uid}-doc based), Firestore data layer (replacing REST client) across every page, Cloudinary uploads | ✅ Done — every page reads/writes Firestore directly; `tsc -b`, `vite build`, and lint all pass clean |
| **10 — Cutover & Verification** | Retire FastAPI backend to `legacy-postgres-backend/`, emulator/live end-to-end test, deploy | ⏳ Pending — needs to happen on your own machine or the real Firebase project (this sandbox can't reach the emulator download) |

This document is the source of truth; the implementation follows it exactly and does not
remove or contradict anything specified here as it's extended in future sessions.
