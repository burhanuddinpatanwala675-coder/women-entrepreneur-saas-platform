export type UserRole = 'seller' | 'customer' | 'platform_admin'

export interface User {
  id: string
  full_name: string
  email?: string | null
  phone?: string | null
  role: UserRole
  is_active: boolean
  has_business: boolean
}

export interface Category {
  id: string
  name: string
  slug: string
  icon?: string | null
  parent_id?: string | null
  sort_order: number
}

export interface CategoryTree extends Category {
  children: Category[]
}

export type BusinessTemplate = 'fashion' | 'beauty' | 'food' | 'handmade' | 'minimal'
export type BusinessStatus = 'active' | 'suspended' | 'pending'

export interface Business {
  id: string
  name: string
  slug: string
  short_description?: string | null
  category_id?: string | null
  logo_url?: string | null
  cover_image_url?: string | null
  whatsapp_number?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  social_links: Record<string, string>
  template: BusinessTemplate
  status: BusinessStatus
  onboarding_step: number
  storefront_path: string
}

export interface StoreSettings {
  template: string
  accent_color: string
  show_search: boolean
  show_filters: boolean
  cod_enabled: boolean
  manual_payment_instructions?: string | null
  announcement_banner?: string | null
}

export type ProductStatus = 'available' | 'low_stock' | 'out_of_stock' | 'sold' | 'hidden'

export interface ProductImage {
  id: string
  url: string
  sort_order: number
  is_primary: boolean
}

export interface ProductVariant {
  id: string
  name: string
  option_values: Record<string, string>
  price?: number | null
  stock_quantity: number
  sku?: string | null
}

export interface Product {
  id: string
  name: string
  slug: string
  description?: string | null
  price: number
  sale_price?: number | null
  sku?: string | null
  stock_quantity: number
  status: ProductStatus
  category_id?: string | null
  tags: string[]
  images: ProductImage[]
  variants: ProductVariant[]
}

export interface PublicProduct extends Product {
  is_orderable: boolean
}

export interface PublicProductDetail extends PublicProduct {
  related_products: PublicProduct[]
}

export interface PublicBusiness {
  name: string
  slug: string
  short_description?: string | null
  logo_url?: string | null
  cover_image_url?: string | null
  whatsapp_number?: string | null
  social_links: Record<string, string>
  template: string
  category_name?: string | null
  accent_color: string
  show_search: boolean
  show_filters: boolean
  announcement_banner?: string | null
}

export type OrderStatus = 'new' | 'confirmed' | 'preparing' | 'ready' | 'dispatched' | 'delivered' | 'cancelled'

export interface OrderItem {
  id: string
  product_id?: string | null
  product_variant_id?: string | null
  product_name_snapshot: string
  variant_name_snapshot?: string | null
  unit_price: number
  quantity: number
  line_total: number
}

export interface Order {
  id: string
  order_number: string
  status: OrderStatus
  channel: 'whatsapp' | 'storefront_cart'
  subtotal: number
  discount_total: number
  total: number
  payment_method: string
  notes?: string | null
  created_at: string
  items: OrderItem[]
  customer_name?: string | null
  customer_phone?: string | null
}

export interface Customer {
  id: string
  name: string
  phone: string
  email?: string | null
  notes?: string | null
  created_at: string
  order_count: number
  total_spent: number
  last_order_at?: string | null
}

export interface CustomerDetail extends Customer {
  orders: { id: string; order_number: string; status: string; total: number; created_at: string }[]
}

export interface Voucher {
  id: string
  code: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  min_purchase_amount?: number | null
  max_discount_amount?: number | null
  usage_limit?: number | null
  usage_limit_per_customer: number
  starts_at?: string | null
  expires_at?: string | null
  is_active: boolean
  times_used: number
}

export interface GiftCard {
  id: string
  code: string
  initial_balance: number
  current_balance: number
  sender_name?: string | null
  recipient_name?: string | null
  recipient_contact?: string | null
  message?: string | null
  delivery_date?: string | null
  status: 'active' | 'redeemed' | 'expired' | 'cancelled'
  expires_at?: string | null
  created_at: string
}

export interface AdminSeller {
  id: string
  name: string
  slug: string
  status: BusinessStatus
  owner_name: string
  owner_email?: string | null
  owner_phone?: string | null
  product_count: number
  order_count: number
  created_at: string
}

export interface AdminAnalytics {
  total_sellers: number
  active_sellers: number
  suspended_sellers: number
  total_products: number
  total_orders: number
  orders_last_30_days: number
  total_customers: number
  gmv_total: number
  gmv_last_30_days: number
}

export interface AIStatus {
  configured: boolean
  provider: string
  message: string
}
