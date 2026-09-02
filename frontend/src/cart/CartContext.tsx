import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { PublicProduct, ProductVariant } from '@/api/types'

export interface CartLine {
  product: PublicProduct
  variant?: ProductVariant
  quantity: number
}

interface CartContextValue {
  lines: CartLine[]
  addToCart: (product: PublicProduct, variant: ProductVariant | undefined, quantity: number) => void
  updateQuantity: (key: string, quantity: number) => void
  removeLine: (key: string) => void
  clear: () => void
  subtotal: number
  count: number
}

const CartContext = createContext<CartContextValue | null>(null)

export function lineKey(productId: string, variantId?: string) {
  return variantId ? `${productId}::${variantId}` : productId
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])

  function addToCart(product: PublicProduct, variant: ProductVariant | undefined, quantity: number) {
    const key = lineKey(product.id, variant?.id)
    setLines((prev) => {
      const existing = prev.find((l) => lineKey(l.product.id, l.variant?.id) === key)
      if (existing) {
        return prev.map((l) => (lineKey(l.product.id, l.variant?.id) === key ? { ...l, quantity: l.quantity + quantity } : l))
      }
      return [...prev, { product, variant, quantity }]
    })
  }

  function updateQuantity(key: string, quantity: number) {
    setLines((prev) => prev.map((l) => (lineKey(l.product.id, l.variant?.id) === key ? { ...l, quantity } : l)).filter((l) => l.quantity > 0))
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => lineKey(l.product.id, l.variant?.id) !== key))
  }

  function clear() {
    setLines([])
  }

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + (l.variant?.price ?? l.product.sale_price ?? l.product.price) * l.quantity, 0),
    [lines],
  )
  const count = useMemo(() => lines.reduce((sum, l) => sum + l.quantity, 0), [lines])

  return (
    <CartContext.Provider value={{ lines, addToCart, updateQuantity, removeLine, clear, subtotal, count }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
