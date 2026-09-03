import type { VoucherDoc } from './types'

/**
 * Client-side eligibility check + discount math — used for the instant cart preview.
 * This is NOT the authoritative check anymore (there's no server to trust it from); the
 * actual order-creation transaction is what Firestore Security Rules validate (see
 * ARCHITECTURE.md section 3.3). Kept as a small pure-function module so the preview and
 * the transaction-building code both compute the same numbers the same way.
 */
export class VoucherIneligibleError extends Error {}

export function checkVoucherEligibility(
  voucher: VoucherDoc,
  opts: { subtotal: number; productIds: string[]; customerPriorUsageCount: number; now: Date },
): void {
  if (!voucher.isActive) throw new VoucherIneligibleError('This voucher is no longer active.')
  if (voucher.startsAt && voucher.startsAt.toDate() > opts.now) {
    throw new VoucherIneligibleError("This voucher isn't active yet.")
  }
  if (voucher.expiresAt && voucher.expiresAt.toDate() < opts.now) {
    throw new VoucherIneligibleError('This voucher has expired.')
  }
  if (voucher.minPurchaseAmount && opts.subtotal < voucher.minPurchaseAmount) {
    throw new VoucherIneligibleError(
      `This voucher needs a minimum order of Rs. ${voucher.minPurchaseAmount.toLocaleString()}.`,
    )
  }
  if (voucher.usageLimit != null && voucher.timesUsed >= voucher.usageLimit) {
    throw new VoucherIneligibleError('This voucher has already been fully redeemed.')
  }
  if (opts.customerPriorUsageCount >= voucher.usageLimitPerCustomer) {
    throw new VoucherIneligibleError("You've already used this voucher.")
  }
  if (voucher.applicableProductIds && voucher.applicableProductIds.length > 0) {
    const applies = opts.productIds.some((id) => voucher.applicableProductIds!.includes(id))
    if (!applies) throw new VoucherIneligibleError("This voucher doesn't apply to the items in your cart.")
  }
}

export function calculateDiscount(voucher: VoucherDoc, subtotal: number): number {
  let discount =
    voucher.discountType === 'percentage' ? (subtotal * voucher.discountValue) / 100 : voucher.discountValue
  if (voucher.maxDiscountAmount != null) discount = Math.min(discount, voucher.maxDiscountAmount)
  return Math.min(discount, subtotal)
}
