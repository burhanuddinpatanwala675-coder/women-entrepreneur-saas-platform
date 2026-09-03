# HerCommerce

*"If a woman can use WhatsApp, she can use this platform."*

A mobile-first, multi-tenant SaaS platform that helps women entrepreneurs create and run
an online business: store, products, WhatsApp ordering, vouchers, and gift cards — no
technical knowledge required, and no bill to pay to run it.

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for the full system design: data model,
Security Rules strategy, user flows, page-by-page structure, folder structure, and the
phase-by-phase build plan. This README is only about running the project.

## What's built

| Phase | Scope | Status |
|---|---|---|
| 1 — Foundation | Auth, multi-tenancy, seller onboarding | ✅ |
| 2 — Store Builder | Business profile, storefront, products, categories, variants | ✅ |
| 3 — Selling | Cart, WhatsApp ordering, order management, Mark as Sold | ✅ |
| 4 — Customer Tools | Customer CRM, vouchers, gift cards | ✅ |
| 5 — Intelligence | AI assistant architecture | ✅ (parked — see below) |
| 6 — Platform Admin | Admin dashboard, seller management, categories, analytics | ✅ |

Every button in the product either works end-to-end against real Firestore data, or — in
the one case where it depends on infrastructure this build deliberately doesn't have (the
AI Assistant) — clearly says so instead of faking a result. See ARCHITECTURE.md's
migration note for exactly why.

## Stack — and why there's nothing to pay for

- **Data & multi-tenancy**: Cloud Firestore, on Firebase's free **Spark** plan. No
  database to provision, back up, or pay for.
- **Auth**: Firebase Authentication (email/password), Spark/free.
- **Hosting**: Firebase Hosting, Spark/free.
- **Images**: **Cloudinary**'s free tier (product photos, logo, cover image) — confirmed
  no credit card required at signup, uploaded directly from the browser.
- **No backend server, no Cloud Functions.** Every write — including a customer placing an
  order on a public storefront with no account — goes straight from the browser to
  Firestore inside a transaction, validated entirely by `firestore.rules`. See
  ARCHITECTURE.md section 3 for exactly how that's made safe with no trusted server code.
- **No credit card is required anywhere in this setup.** That was a deliberate,
  non-negotiable requirement for this build — not an oversight. Two things that would
  normally seem free-tier-friendly are explicitly avoided because Google/Firebase require
  a billing card on file to enable them at all (even at $0 actual usage): **Cloud
  Functions** and, as of a late-2024 policy change, **Firebase Storage**. Both are worked
  around — see ARCHITECTURE.md's migration note.

## 1. Create your Firebase project (free, no card)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add
   project** → name it → you can decline Google Analytics, it isn't used.
2. **Build → Authentication → Get started → Email/Password → enable.**
3. **Build → Firestore Database → Create database → Production mode** → pick a region
   close to your users (e.g. `asia-south1`) — this can't be changed later.
4. **Project settings** (gear icon) **→ General → Your apps → add a Web app** (`</>`) →
   copy the `firebaseConfig` values it shows you.
5. Deploy the Security Rules and indexes from this repo (one-time, from your own machine):
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase deploy --only firestore:rules,firestore:indexes
   ```
   (`firebase.json` has no `functions` or `storage` target, so this never asks about
   Blaze.)
6. Seed the starter category tree + AI-assistant status doc:
   ```bash
   cd scripts
   npm install
   # Get a service account key: Firebase Console -> Project settings -> Service accounts
   # -> Generate new private key. Keep it out of git.
   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json npm run seed
   ```

## 2. Create your Cloudinary account (free, no card) — for image uploads

1. Sign up at [cloudinary.com](https://cloudinary.com) (free plan, no card).
2. Note your **Cloud name**, shown on the dashboard home.
3. **Settings → Upload → Upload presets → Add upload preset**:
   - Signing mode: **Unsigned**
   - Folder: leave blank (the app sets a per-product folder itself) or set a base folder
   - Optionally cap file size / restrict formats to images only
   - Save, and note the **preset name**.

## 3. Configure and run the frontend

```bash
cd frontend
cp .env.example .env   # fill in the Firebase config values + Cloudinary cloud name/preset
npm install
npm run dev
```

Runs at http://localhost:5173.

## 4. Try it out

1. Click **Create my free store**, sign up (email + password).
2. Complete the 4-step onboarding wizard (pick a category, name your business, add a
   product with a photo, done).
3. From the dashboard, set your WhatsApp number under **Store**.
4. Open your storefront link (shown on the "Your store is ready!" screen) in a new tab.
5. Add the product to cart or tap **Buy / Order on WhatsApp** — this creates a real order
   directly in Firestore (no backend involved) and generates a `wa.me` deep link pre-filled
   with the order details.
6. Back in the dashboard, the order appears under **Orders** in real time; move it through
   the fulfillment stages.
7. Try **Mark as Sold** on a product — the storefront immediately shows "SOLD OUT" and
   disables ordering; **Reactivate** brings it back.
8. Create a voucher under **Vouchers** and apply its code at checkout.
9. Create a gift card under **Gift Cards**, or visit `/store/<slug>/gift-card` as a
   customer to send one.

### Becoming a platform admin

There's no public sign-up path to the admin role (by design). Promote an existing account
directly in the Firebase console: **Firestore Database → `users` collection → your
document → set `role` to `"platform_admin"`.** Then visit http://localhost:5173/admin.

## Project layout

```
hercommerce/
├── ARCHITECTURE.md            # full system design — read this first
├── firebase.json / firestore.rules / firestore.indexes.json
├── functions/                  # AI Assistant only — real code, NOT deployed (needs Blaze)
├── scripts/seed.ts             # one-off category-tree seeder (plain Node script)
├── legacy-postgres-backend/    # the original FastAPI/Postgres backend — reference only
└── frontend/                   # React + TypeScript app (see frontend/src/)
```

See `ARCHITECTURE.md` → **Folder Structure** for the full breakdown.

## Notes on what's intentionally simplified for the MVP

- **Payments**: Cash on Delivery and seller-configured manual payment instructions only.
  A `payments` collection already exists for when a real gateway is added.
- **WhatsApp**: uses standard `wa.me` deep links (no API keys or business account
  approval required). The order message format already carries every field a WhatsApp
  Business Cloud API template message would need, so upgrading later changes *how* the
  message is sent, not the data model.
- **AI Assistant**: architecture is real (`functions/src/services/aiProvider.ts`, a
  frontend page with a proper "needs configuration" state) but intentionally not
  deployed, since deploying it requires the Blaze plan this build otherwise avoids
  entirely. Revisit only if a $0-bill Blaze plan is ever acceptable for that one feature —
  see `functions/README.md`.
- **Product editor**: add/edit is a modal rather than a separate page, and variants are
  added inline — this keeps the "add a product" flow to a handful of taps.
- **Order numbers**: generated client-side from a timestamp + random suffix rather than a
  strict server-arbitrated sequence, since a shared counter document writable by anonymous
  customers would itself be a race/abuse surface. See ARCHITECTURE.md section 2.
- **Image deletion**: removing a photo from a product removes it from that product's data,
  but the underlying Cloudinary asset isn't deleted (that requires a signed request this
  card-free build has no server to make). See ARCHITECTURE.md section 3.4.
