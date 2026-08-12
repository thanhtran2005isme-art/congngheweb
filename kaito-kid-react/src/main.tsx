import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// CSS gốc từ project cũ
import './styles/style.css'
import './styles/modern-fashion.css'
import './styles/responsive-index.css'
import './styles/login.css'
import './styles/cart-page.css'
import './styles/checkout-page.css'
import './styles/order-tracking.css'
import './styles/account.css'
import './styles/address.css'
import './styles/wishlist.css'
import './styles/products-page.css'
import './styles/product-detail.css'
import './styles/product-detail-pro.css'
import './styles/collection-page.css'
import './styles/lookbook-page.css'
import './styles/GioHang.css'
import './styles/SanPhamMoi.css'
import './styles/SanPhamSale.css'
import './styles/SanPhamBanChay.css'
import './styles/GoiYDanhChoBan.css'
import './styles/chitiet.css'

// Admin CSS
import './styles/admin/admin-common.css'
import './styles/admin/admin-layout.css'
import './styles/admin/admin-dashboard.css'
import './styles/admin/admin-profile.css'
import './styles/admin/admin-products.css'
import './styles/admin/admin-orders.css'
import './styles/admin/admin-customers.css'
import './styles/admin/admin-categories.css'
import './styles/admin/admin-collections.css'
import './styles/admin/admin-attributes.css'
import './styles/admin/admin-inventory.css'
import './styles/admin/admin-alerts.css'
import './styles/admin/admin-lookbook.css'
import './styles/admin/admin-flash-sales.css'
import './styles/admin/admin-reviews.css'
import './styles/admin/admin-reports.css'
import './styles/admin/admin-banners.css'
import './styles/admin/admin-homepage.css'
import './styles/admin/admin-settings.css'
import './styles/admin/admin-product-add.css'
import './styles/admin/admin-promotions.css'
import './styles/admin/admin-pages.css'
import './styles/admin/admin-menus.css'

// Footer mới
import './styles/footer-new.css'

// CSS bổ sung cho React
import './App.css'

// UI Enhancements - animations, transitions, depth
import './styles/enhancements.css'

// Product Card IVY moda style
import './styles/product-card-ivy.css'

// Footer IVY moda style
import './styles/footer-ivy.css'

// Cart page IVY moda style
import './styles/cart-ivy.css'

// Checkout page IVY moda style
import './styles/checkout-ivy.css'

// Admin page scene variants
import './styles/admin/admin-page-variants.css'

import App from './App.tsx'
import { registerServiceWorker } from './registerSW';

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
