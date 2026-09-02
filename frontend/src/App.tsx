import { Route, Routes } from 'react-router-dom'
import { RequireAdmin, RequireAuth, RequireBusiness, RequireNoBusiness } from '@/auth/guards'
import { SellerLayout } from '@/components/SellerLayout'
import { CartProvider } from '@/cart/CartContext'

import Landing from '@/pages/marketing/Landing'
import Login from '@/pages/marketing/Login'
import Signup from '@/pages/marketing/Signup'
import OnboardingWizard from '@/pages/onboarding/OnboardingWizard'

import DashboardHome from '@/pages/dashboard/DashboardHome'
import ProductsPage from '@/pages/dashboard/ProductsPage'
import OrdersPage from '@/pages/dashboard/OrdersPage'
import OrderDetailPage from '@/pages/dashboard/OrderDetailPage'
import CustomersPage from '@/pages/dashboard/CustomersPage'
import CustomerDetailPage from '@/pages/dashboard/CustomerDetailPage'
import VouchersPage from '@/pages/dashboard/VouchersPage'
import GiftCardsPage from '@/pages/dashboard/GiftCardsPage'
import StoreSettingsPage from '@/pages/dashboard/StoreSettingsPage'
import AIAssistantPage from '@/pages/dashboard/AIAssistantPage'
import SettingsPage from '@/pages/dashboard/SettingsPage'

import StorefrontLayout from '@/pages/storefront/StorefrontLayout'
import StoreHome from '@/pages/storefront/StoreHome'
import ProductDetailPage from '@/pages/storefront/ProductDetailPage'
import GiftCardStorePage from '@/pages/storefront/GiftCardStorePage'

import AdminDashboard from '@/pages/admin/AdminDashboard'

import NotFound from '@/pages/NotFound'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <RequireNoBusiness>
              <OnboardingWizard />
            </RequireNoBusiness>
          </RequireAuth>
        }
      />

      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <RequireBusiness>
              <SellerLayout />
            </RequireBusiness>
          </RequireAuth>
        }
      >
        <Route index element={<DashboardHome />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:orderId" element={<OrderDetailPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/:customerId" element={<CustomerDetailPage />} />
        <Route path="vouchers" element={<VouchersPage />} />
        <Route path="gift-cards" element={<GiftCardsPage />} />
        <Route path="store" element={<StoreSettingsPage />} />
        <Route path="ai-assistant" element={<AIAssistantPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route
        path="/store/:slug"
        element={
          <CartProvider>
            <StorefrontLayout />
          </CartProvider>
        }
      >
        <Route index element={<StoreHome />} />
        <Route path="product/:productId" element={<ProductDetailPage />} />
        <Route path="gift-card" element={<GiftCardStorePage />} />
      </Route>

      <Route
        path="/admin/*"
        element={
          <RequireAuth>
            <RequireAdmin>
              <AdminDashboard />
            </RequireAdmin>
          </RequireAuth>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
