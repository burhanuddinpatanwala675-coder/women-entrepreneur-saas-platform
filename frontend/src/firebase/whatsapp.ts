import type { OrderItem, OrderStatus } from './types'

/**
 * Normalizes a phone number into the digits-only, full-country-code format wa.me links
 * require (e.g. "923001234567"). A bare local number like "03001234567" — the format
 * people type without thinking, and the format both the customer-phone field and (until
 * this fix) sellers' own WhatsApp number field accepted with no warning — silently fails
 * to open a real chat: WhatsApp just shows an "invalid phone number" screen or nothing at
 * all, with no error surfaced back to this app since it's a plain link, not an API call.
 * This is the actual root cause behind "the order shows up but WhatsApp never opens/sends"
 * on both the customer-facing "Confirm on WhatsApp" link and the seller-facing "Message
 * customer" links. Defaults a leading-0 local number, or a bare 10-digit mobile number
 * with the leading 0 dropped, to Pakistan's country code (92) — this deployment's market
 * (see the Rs. currency and the "03xxxxxxxxx" phone placeholders elsewhere in the app). A
 * number that already carries a (different) country code is left alone.
 */
export function toWhatsappDigits(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '')
  if (digits.startsWith('92')) return digits
  if (digits.startsWith('0')) return `92${digits.slice(1)}`
  if (digits.length === 10) return `92${digits}`
  return digits
}

/**
 * Builds a wa.me deep link pre-filled with the order details, run client-side the moment
 * an order is created (there's no server to do this anymore — see ARCHITECTURE.md section
 * 1). Same message shape as the original design: no WhatsApp Business API keys needed,
 * and the message already carries everything a Business Cloud API template would need if
 * that's ever wired in later.
 */
export function buildWhatsappOrderLink(
  sellerWhatsappNumber: string | null | undefined,
  order: { orderNumber: string; items: OrderItem[]; subtotal?: number; deliveryFee?: number; total: number },
  customerName: string,
): string | null {
  if (!sellerWhatsappNumber) return null

  const lines = order.items.map((item) => {
    const variant = item.variantNameSnapshot ? ` (${item.variantNameSnapshot})` : ''
    return `• ${item.productNameSnapshot}${variant} x${item.quantity} — Rs. ${item.lineTotal.toLocaleString()}`
  })

  const totalLines = [
    order.subtotal != null ? `Subtotal: Rs. ${order.subtotal.toLocaleString()}` : null,
    order.deliveryFee ? `Delivery: Rs. ${order.deliveryFee.toLocaleString()}` : null,
    `Total: Rs. ${order.total.toLocaleString()}`,
  ].filter((l): l is string => l != null)

  const message = [
    `Hi! I'd like to order (${order.orderNumber}):`,
    '',
    ...lines,
    '',
    ...totalLines,
    `Name: ${customerName}`,
  ].join('\n')

  const number = toWhatsappDigits(sellerWhatsappNumber)
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

/**
 * One customer-facing line per order status, used to pre-fill the "notify the customer"
 * WhatsApp message a seller sends when moving an order forward. There's no WhatsApp
 * Business API here (that needs a verified, billing-enabled Meta account — off the table
 * for this card-free build), so this can't send itself silently: it just gives the seller
 * a ready-to-go message so telling the customer is one tap instead of typing it out fresh
 * every time. `cancelled` isn't in the forward FLOW that triggers this, but is included so
 * a cancellation can use the same helper if that's ever wired up too.
 */
const STATUS_MESSAGES: Partial<Record<OrderStatus, (orderNumber: string, businessName?: string | null) => string>> = {
  confirmed: (orderNumber) => `Hi! Your order ${orderNumber} has been confirmed and we'll start preparing it soon. 🎉`,
  preparing: (orderNumber) => `Hi! Your order ${orderNumber} is being prepared right now.`,
  ready: (orderNumber) => `Hi! Your order ${orderNumber} is ready! We'll let you know once it's on its way.`,
  dispatched: (orderNumber) => `Hi! Your order ${orderNumber} is on its way to you now. 🚚`,
  delivered: (orderNumber, businessName) =>
    `Hi! Your order ${orderNumber} has been delivered. Thank you for shopping with ${businessName ?? 'us'}! 💕`,
  cancelled: (orderNumber) => `Hi, your order ${orderNumber} has been cancelled. Please reach out if you have any questions.`,
}

/**
 * Builds a wa.me link pre-filled with a status-update message for the customer, or null
 * when there's no phone to message or no canned message for that status.
 */
export function buildWhatsappStatusUpdateLink(
  customerPhone: string | null | undefined,
  orderNumber: string,
  status: OrderStatus,
  businessName?: string | null,
): string | null {
  if (!customerPhone) return null
  const build = STATUS_MESSAGES[status]
  if (!build) return null
  const number = toWhatsappDigits(customerPhone)
  return `https://wa.me/${number}?text=${encodeURIComponent(build(orderNumber, businessName))}`
}
