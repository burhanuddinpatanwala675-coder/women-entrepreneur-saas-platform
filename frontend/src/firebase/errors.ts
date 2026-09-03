import { FirebaseError } from 'firebase/app'

const AUTH_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'An account with this email already exists — try logging in instead.',
  'auth/invalid-email': 'That doesn’t look like a valid email address.',
  'auth/weak-password': 'Please use a password with at least 6 characters.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/user-not-found': 'No account found with that email.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Network error — please check your connection and try again.',
}

const CALLABLE_MESSAGES: Record<string, string> = {
  'already-exists': 'This account already has a business.',
  'failed-precondition': 'That action can’t be completed right now.',
  'permission-denied': 'You don’t have permission to do that.',
  unauthenticated: 'Please log in and try again.',
}

/** Extracts a human-friendly message from any error thrown by the Firebase SDKs. */
export function getFirebaseErrorMessage(err: unknown): string {
  if (err instanceof FirebaseError) {
    if (AUTH_MESSAGES[err.code]) return AUTH_MESSAGES[err.code]
    // Cloud Functions callable errors arrive as FirebaseError with code "functions/<httpsErrorCode>"
    // and the HttpsError's own `message` already carries our own copy (see functions/src/callable/*).
    const callableCode = err.code.replace(/^functions\//, '')
    if (CALLABLE_MESSAGES[callableCode] && err.message) return err.message
    return err.message || 'Something went wrong. Please try again.'
  }
  if (err instanceof Error) return err.message
  return 'Something went wrong. Please try again.'
}
