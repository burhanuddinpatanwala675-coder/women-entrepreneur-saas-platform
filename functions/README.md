# functions/ — AI Assistant only, not deployed by default

This package exists for exactly one feature: the AI Assistant's `AIProvider` interface
(`src/services/aiProvider.ts`) and its callable wrapper (`src/callable/aiGenerateProductContent.ts`).

**It is intentionally excluded from `firebase.json`** — a plain `firebase deploy` from the
repo root never touches this folder, never asks for anything, and never requires the
Blaze plan.

## Why

Every generation of Cloud Functions requires upgrading a Firebase project to the "Blaze"
pay-as-you-go plan, which requires a billing card on file — even if the actual bill stays
$0 at low traffic. This build's owner made a deliberate call: never enter a card anywhere,
even for a feature that would cost nothing to run. So the rest of the app (Firestore
transactions + Security Rules, see `ARCHITECTURE.md` section 3) was redesigned specifically
to not need a server at all. The one feature that *cannot* be done safely without either a
server or exposing a secret API key in the browser is calling a real AI provider — so it
stays here, unused, rather than being faked or done insecurely.

## If you ever want to turn this on

1. Upgrade the Firebase project to the Blaze plan (Firebase Console → upgrade). You will
   need to add a billing card; at the usage this platform expects, the bill should stay
   $0, but Google requires the card regardless.
2. Implement a real provider in `src/services/aiProvider.ts` (see the `TODO` there).
3. Bind the secret: `firebase functions:secrets:set AI_API_KEY`.
4. Add a `"functions"` block back to `../firebase.json` (see git history for the shape
   used before this feature was parked, or the Firebase docs for the current syntax).
5. `npm install && npm run build && firebase deploy --only functions`.
6. Update the public `config/ai` Firestore document to `{ configured: true, provider: "..." }`
   so the frontend's AI Assistant page reflects the change (see `scripts/seed.ts` at the
   repo root for how that document is seeded).

Until then, this stays exactly what it is: real, honest, unused architecture.
