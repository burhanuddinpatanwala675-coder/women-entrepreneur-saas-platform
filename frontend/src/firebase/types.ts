import type { Timestamp } from 'firebase/firestore'

// Firestore document shapes for the frontend. Mirrors functions/src/types.ts and
// ARCHITECTURE.md section 2 — keep all three in sync. Task #26 wires these into the
// Firestore data layer that replaces the old REST client (frontend/src/api/*); this file
// exists now so the auth layer (task #25) has a typed `AppUser` to build on.

export type UserRole = 'seller' | 'platform_admin'

export interface UserDoc {
  fullName: string
  email: string | null
  phone: string | null
  role: UserRole
  businessId: string | null
  isActive: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** The shape exposed by useAuth() — derived from Firebase Auth + the users/{uid} doc + ID token claims. */
export interface AppUser {
  uid: string
  fullName: string
  email: string | null
  phone: string | null
  role: UserRole
  businessId: string | null
  isActive: boolean
  /** Convenience flag mirroring the old REST User.has_business, kept so existing guards/pages don't need to change shape. */
  has_business: boolean
}

export type BusinessTemplate = 'fashion' | 'beauty' | 'food' | 'handmade' | 'minimal'
export type BusinessStatus = 'active' | 'suspended' | 'pending'

export interface StoreSettings {
  accentColor: string
  showSearch: boolean
  showFilters: boolean
  codEnabled: boolean
  manualPaymentInstructions: string | null
  announcementBanner: string | null
}

export interface BusinessDoc {
  ownerUserId: string
  name: string
  slug: string
  shortDescription: string | null
  categoryId: string | null
  logoUrl: string | null
  coverImageUrl: string | null
  whatsappNumber: string | null
  contactEmail: string | null
  contactPhone: string | null
  socialLinks: Record<string, string>
  template: BusinessTemplate
  status: BusinessStatus
  onboardingStep: number
  storeSettings: StoreSettings
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type ProductStatus = 'available' | 'low_stock' | 'out_of_stock' | 'sold' | 'hidden'

export interface ProductImage {
  url: string
  /** Cloudinary's asset ID (not a Firebase Storage path — see frontend/src/cloudinary/upload.ts). */
  cloudinaryPublicId: string
  sortOrder: number
  isPrimary: boolean
}

export interface ProductVariant {
  id: string
  name: string
  optionValues: Record<string, string>
  price: number | null
  stockQuantity: number
  sku: string | null
}

export interface ProductDoc {
  businessId: string
  categoryId: string | null
  name: string
  slug: string
  description: string | null
  price: number
  salePrice: number | null
  sku: string | null
  stockQuantity: number
  status: ProductStatus
  lowStockThreshold: number
  tags: string[]
  images: ProductImage[]
  variants: ProductVariant[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type OrderStatus =
  | 'new'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'dispatched'
  | 'delivered'
  | 'cancelled'

export interface OrderItem {
  productId: string
  productVariantId: string | null
  productNameSnapshot: string
  variantNameSnapshot: string | null
  unitPrice: number
  quantity: number
  lineTotal: number
}

export interface OrderDoc {
  businessId: string
  customerId: string
  orderNumber: string
  status: OrderStatus
  channel: 'whatsapp' | 'storefront_cart'
  items: OrderItem[]
  subtotal: number
  discountTotal: number
  total: number
  voucherId: string | null
  giftCardId: string | null
  paymentMethod: 'cod' | 'manual' | 'unpaid'
  whatsappMessageSent: boolean
  notes: string | null
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface CustomerDoc {
  businessId: string
  name: string
  phone: string
  email: string | null
  notes: string | null
  orderCount: number
  totalSpent: number
  lastOrderAt: Timestamp | null
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface VoucherDoc {
  businessId: string
  code: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  minPurchaseAmount: number | null
  maxDiscountAmount: number | null
  usageLimit: number | null
  usageLimitPerCustomer: number
  applicableProductIds: string[] | null
  applicableCategoryIds: string[] | null
  startsAt: Timestamp | null
  expiresAt: Timestamp | null
  isActive: boolean
  timesUsed: number
  createdAt: Timestamp
}

export type GiftCardStatus = 'active' | 'redeemed' | 'expired' | 'cancelled'

export interface GiftCardDoc {
  businessId: string
  code: string
  initialBalance: number
  currentBalance: number
  senderName: string | null
  recipientName: string | null
  recipientContact: string | null
  message: string | null
  deliveryDate: Timestamp | null
  status: GiftCardStatus
  expiresAt: Timestamp | null
  createdAt: Timestamp
}

export interface CategoryDoc {
  name: string
  slug: string
  parentId: string | null
  icon: string | null
  isActive: boolean
  sortOrder: number
}
