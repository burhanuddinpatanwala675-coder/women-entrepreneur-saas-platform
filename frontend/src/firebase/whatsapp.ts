import type { OrderItem } from './types'

function normalizeWhatsappNumber(raw: string): string {
  return raw.replace(/[^\d]/g, '')
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
  order: { orderNumber: string; items: OrderItem[]; total: number },
  customerName: string,
): string | null {
  if (!sellerWhatsappNumber) return null

  const lines = order.items.map((item) => {
    const variant = item.variantNameSnapshot ? ` (${item.variantNameSnapshot})` : ''
    return `• ${item.productNameSnapshot}${variant} x${item.quantity} — Rs. ${item.lineTotal.toLocaleString()}`
  })

  const message = [
    `Hi! I'd like to order (${order.orderNumber}):`,
    '',
    ...lines,
    '',
    `Total: Rs. ${order.total.toLocaleString()}`,
    `Name: ${customerName}`,
  ].join('\n')

  const number = normalizeWhatsappNumber(sellerWhatsappNumber)
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}
