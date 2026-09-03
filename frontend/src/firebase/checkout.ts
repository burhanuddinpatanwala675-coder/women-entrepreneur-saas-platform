import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from './client'
import { generateOrderNumber } from './slugify'
import { calculateDiscount, checkVoucherEligibility, VoucherIneligibleError } from './vouchers'
import type { BusinessDoc, CustomerDoc, GiftCardDoc, OrderItem, ProductDoc, ProductVariant, VoucherDoc } from './types'

/**
 * Client-side order creation — this used to be a trusted Cloud Function; there is no
 * server anywhere in this build, so it's a plain Firestore transaction run directly from
 * a customer's browser (often signed out entirely). Firestore's transaction guarantees
 * (atomic, all-or-nothing) come from Firestore itself, not from who initiates it — the
 * actual trust boundary is firestore.rules, which independently re-validates every
 * document this transaction touches. See ARCHITECTURE.md section 3.3.
 */
export class CheckoutError extends Error {}

export interface CartLineInput {
  productId: string
  variantId?: string | null
  quantity: number
}

export interface PlaceOrderInput {
  businessId: string
  items: CartLineInput[]
  customerName: string
  customerPhone: string
  channel: 'whatsapp' | 'storefront_cart'
  voucherCode?: string | null
  giftCardCode?: string | null
}

export interface PlaceOrderResult {
  orderId: string
  orderNumber: string
  total: number
  items: OrderItem[]
}

function normalizePhone(raw: string): string {
  return raw.replace(/[^\d]/g, '')
}

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const { businessId } = input
  if (input.items.length === 0) throw new CheckoutError('Your cart is empty.')

  const normalizedPhone = normalizePhone(input.customerPhone)
  if (!normalizedPhone) throw new CheckoutError('Please enter a valid phone number.')

  const customerId = `${businessId}_${normalizedPhone}`
  const orderRef = doc(collection(db, 'orders'))
  const orderNumber = generateOrderNumber()

  return runTransaction(db, async (tx) => {
    // ---------------- READS (all reads must happen before any writes) ----------------
    const businessSnap = await tx.get(doc(db, 'businesses', businessId))
    if (!businessSnap.exists()) throw new CheckoutError('This store is not available.')
    const business = businessSnap.data() as BusinessDoc
    if (business.status !== 'active') throw new CheckoutError('This store is not currently accepting orders.')

    const productRefs = input.items.map((l) => doc(db, 'products', l.productId))
    const productSnaps = await Promise.all(productRefs.map((r) => tx.get(r)))

    const customerRef = doc(db, 'customers', customerId)
    const customerSnap = await tx.get(customerRef)

    const voucherRef = input.voucherCode ? doc(db, 'vouchers', `${businessId}_${input.voucherCode.toUpperCase()}`) : null
    const voucherSnap = voucherRef ? await tx.get(voucherRef) : null
    if (voucherRef && !voucherSnap!.exists()) throw new CheckoutError('This voucher code is invalid.')
    const voucher = voucherSnap?.exists() ? (voucherSnap.data() as VoucherDoc) : null

    const giftCardRef = input.giftCardCode ? doc(db, 'giftCards', input.giftCardCode.toUpperCase()) : null
    const giftCardSnap = giftCardRef ? await tx.get(giftCardRef) : null
    if (giftCardRef && !giftCardSnap!.exists()) throw new CheckoutError('This gift card code is invalid.')
    const giftCard = giftCardSnap?.exists() ? (giftCardSnap.data() as GiftCardDoc) : null
    if (giftCard && giftCard.status !== 'active') throw new CheckoutError('This gift card is no longer active.')

    // ---------------- BUILD ITEMS, CHECK STOCK ----------------
    const items: OrderItem[] = []
    const productUpdates: { ref: (typeof productRefs)[number]; data: Record<string, unknown> }[] = []
    let subtotal = 0

    input.items.forEach((line, i) => {
      const snap = productSnaps[i]
      if (!snap.exists()) throw new CheckoutError('One of the items in your cart is no longer available.')
      const product = snap.data() as ProductDoc
      if (product.businessId !== businessId) throw new CheckoutError('One of the items in your cart is no longer available.')
      if (product.status === 'hidden') throw new CheckoutError(`"${product.name}" is no longer available.`)

      let unitPrice: number
      let variantName: string | null = null
      const updateData: Record<string, unknown> = { updatedAt: serverTimestamp() }

      if (line.variantId) {
        const variants = product.variants || []
        const idx = variants.findIndex((v) => v.id === line.variantId)
        if (idx === -1) throw new CheckoutError(`"${product.name}" — the selected option is no longer available.`)
        const v = variants[idx]
        if (v.stockQuantity < line.quantity) throw new CheckoutError(`"${product.name}" (${v.name}) doesn't have enough stock left.`)
        unitPrice = v.price ?? product.salePrice ?? product.price
        variantName = v.name
        const newVariants: ProductVariant[] = variants.map((x, xi) =>
          xi === idx ? { ...x, stockQuantity: x.stockQuantity - line.quantity } : x,
        )
        updateData.variants = newVariants
      } else {
        if (product.status === 'sold') throw new CheckoutError(`"${product.name}" is no longer available.`)
        if (product.stockQuantity < line.quantity) throw new CheckoutError(`"${product.name}" doesn't have enough stock left.`)
        unitPrice = product.salePrice ?? product.price
        const newStock = product.stockQuantity - line.quantity
        updateData.stockQuantity = newStock
        updateData.status = newStock <= 0 ? 'out_of_stock' : newStock <= product.lowStockThreshold ? 'low_stock' : 'available'
      }

      const lineTotal = unitPrice * line.quantity
      subtotal += lineTotal
      items.push({
        productId: line.productId,
        productVariantId: line.variantId ?? null,
        productNameSnapshot: product.name,
        variantNameSnapshot: variantName,
        unitPrice,
        quantity: line.quantity,
        lineTotal,
      })
      productUpdates.push({ ref: productRefs[i], data: updateData })
    })

    // ---------------- VOUCHER DISCOUNT ----------------
    let discountTotal = 0
    if (voucher) {
      // Note: per-customer usage-limit checking would need to read the voucher's `usage`
      // subcollection, which is owner/admin-read-only (it's not exposed publicly, unlike
      // the voucher doc itself) — so it can't be verified from an anonymous customer's
      // browser. This is the same documented trade-off as ARCHITECTURE.md section 3.3:
      // firestore.rules independently caps timesUsed to +1 per checkout, so a voucher can
      // never be over-redeemed past its overall usageLimit, but usageLimitPerCustomer is
      // preview-only here, not authoritatively enforced.
      try {
        checkVoucherEligibility(voucher, {
          subtotal,
          productIds: items.map((it) => it.productId),
          customerPriorUsageCount: 0,
          now: new Date(),
        })
      } catch (err) {
        if (err instanceof VoucherIneligibleError) throw new CheckoutError(err.message)
        throw err
      }
      discountTotal += calculateDiscount(voucher, subtotal)
    }

    // ---------------- GIFT CARD (applied after voucher, capped at what's left) ----------------
    let giftCardApplied = 0
    if (giftCard) {
      const remaining = Math.max(subtotal - discountTotal, 0)
      giftCardApplied = Math.min(giftCard.currentBalance, remaining)
      discountTotal += giftCardApplied
    }

    const total = subtotal - discountTotal

    // ---------------- WRITES ----------------
    const now = serverTimestamp()

    tx.set(orderRef, {
      businessId,
      customerId,
      orderNumber,
      status: 'new',
      channel: input.channel,
      items,
      subtotal,
      discountTotal,
      total,
      voucherId: voucherRef ? voucherRef.id : null,
      giftCardId: giftCardRef ? giftCardRef.id : null,
      paymentMethod: business.storeSettings?.codEnabled ? 'cod' : 'unpaid',
      whatsappMessageSent: false,
      notes: null,
      createdAt: now,
      updatedAt: now,
    })

    for (const u of productUpdates) tx.update(u.ref, u.data)

    if (customerSnap.exists()) {
      const existing = customerSnap.data() as CustomerDoc
      tx.update(customerRef, {
        name: input.customerName,
        orderCount: existing.orderCount + 1,
        totalSpent: existing.totalSpent + total,
        lastOrderAt: now,
        updatedAt: now,
      })
    } else {
      tx.set(customerRef, {
        businessId,
        name: input.customerName,
        phone: normalizedPhone,
        email: null,
        notes: null,
        orderCount: 1,
        totalSpent: total,
        lastOrderAt: now,
        createdAt: now,
        updatedAt: now,
      })
    }

    if (voucher && voucherRef) {
      // firestore.rules' redemption path for vouchers allows ONLY the `timesUsed` field to
      // change (no updatedAt) — see firestore.rules' vouchers/{voucherKey} update rule.
      tx.update(voucherRef, { timesUsed: voucher.timesUsed + 1 })
      const usageRef = doc(db, 'vouchers', voucherRef.id, 'usage', `${customerId}_${orderRef.id}`)
      tx.set(usageRef, { customerId, orderId: orderRef.id, createdAt: now })
    }

    if (giftCard && giftCardRef) {
      const newBalance = giftCard.currentBalance - giftCardApplied
      // Same restriction as vouchers above: only currentBalance/status may change here.
      tx.update(giftCardRef, { currentBalance: newBalance, status: newBalance <= 0 ? 'redeemed' : 'active' })
      const txnRef = doc(db, 'giftCards', giftCardRef.id, 'transactions', orderRef.id)
      tx.set(txnRef, { orderId: orderRef.id, amount: giftCardApplied, createdAt: now })
    }

    return { orderId: orderRef.id, orderNumber, total, items }
  })
}
