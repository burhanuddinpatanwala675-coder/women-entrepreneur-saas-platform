import { doc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore'
import { db } from './client'
import { generateCode } from './slugify'

/**
 * Creates a gift card. The document ID IS the code (deterministic, see ARCHITECTURE.md
 * decision 4) — on the astronomically rare collision, Firestore sees this as an
 * unauthorized "update" instead of a "create" and firestore.rules denies it, so we just
 * retry with a freshly generated code. Used both by a seller creating a gift card from
 * the dashboard and by a customer buying one to send as a gift on the public storefront —
 * firestore.rules' create rule doesn't distinguish between the two (see its comment).
 */
export async function createGiftCard(input: {
  businessId: string
  initialBalance: number
  senderName: string | null
  recipientName: string
  recipientContact: string
  message: string | null
  deliveryDate: Date | null
  expiresAt: Date | null
}): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode('GIFT')
    try {
      await setDoc(doc(db, 'giftCards', code), {
        businessId: input.businessId,
        code,
        initialBalance: input.initialBalance,
        currentBalance: input.initialBalance,
        senderName: input.senderName,
        recipientName: input.recipientName,
        recipientContact: input.recipientContact,
        message: input.message,
        deliveryDate: input.deliveryDate ? Timestamp.fromDate(input.deliveryDate) : null,
        status: 'active',
        expiresAt: input.expiresAt ? Timestamp.fromDate(input.expiresAt) : null,
        createdAt: serverTimestamp(),
      })
      return code
    } catch (err) {
      // A collision surfaces as a permission-denied "update" rejection, not a distinct
      // error code — if this was the last attempt, surface it instead of retrying forever.
      if (attempt === 4) throw err
      continue
    }
  }
  throw new Error('Could not generate a gift card code — please try again.')
}
