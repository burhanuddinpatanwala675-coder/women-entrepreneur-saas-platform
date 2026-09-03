// Ported from the (now removed) Cloud Functions version — this now runs client-side
// since business/voucher/gift-card creation happens directly from the browser. See
// ARCHITECTURE.md section 3 for why there's no server to do this instead.

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'store'
  )
}

/** Appends a short random suffix — used when a slug is already taken. */
export function withUniqueSuffix(base: string): string {
  const suffix = Math.random().toString(36).slice(2, 7)
  return `${base}-${suffix}`
}

/** Random human-friendly code, e.g. "GIFT-7K2QXH9P". No 0/O/1/I to avoid ambiguity. */
export function generateCode(prefix: string, length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < length; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return `${prefix}-${code}`
}

/** Client-generated order number: not a server-arbitrated sequence (see ARCHITECTURE.md
 *  section 2 — a shared counter writable by anonymous customers would itself be a race/
 *  abuse surface). Still unique enough in practice and sorts roughly by time. */
export function generateOrderNumber(): string {
  const time = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase()
  return `ORD-${time}-${rand}`
}
