import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'

// No Cloud Functions client, and no Firebase Storage — this build uses neither. Cloud
// Functions require the Blaze plan; so, as of late 2024, does enabling Firebase Storage
// on a new project (confirmed directly against this project's console — Storage now
// shows "To use Storage, upgrade your project's pricing plan" even on Spark). Image
// uploads go straight to Cloudinary's free tier instead — see frontend/src/cloudinary/
// and ARCHITECTURE.md's migration note for why.

// Fill these in from Firebase Console -> Project settings -> General -> "Your apps" ->
// Web app, and put them in frontend/.env (see .env.example). Every value here is public
// by design (it identifies the project, it does not authorize anything by itself) —
// actual access control lives entirely in firestore.rules.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

if (import.meta.env.DEV && !firebaseConfig.apiKey) {
  // eslint-disable-next-line no-console
  console.warn(
    '[firebase] VITE_FIREBASE_API_KEY is missing — copy frontend/.env.example to frontend/.env ' +
      'and fill in your Firebase project config (Project settings -> General -> Your apps).',
  )
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'
if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  // eslint-disable-next-line no-console
  console.info('[firebase] connected to local emulators')
}
