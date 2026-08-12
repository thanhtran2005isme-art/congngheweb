/**
 * API Services Index
 */

export { authApi } from './authApi';
export { productApi, type GetProductsParams } from './productApi';
export { adminApi } from './adminApi';
export { orderApi } from './orderApi';
export { categoryApi, type CategoryDTO } from './categoryApi';
export { attributeApi, type AttributeDTO } from './attributeApi';
export { inventoryApi, type InventoryAdjustPayload, type InventoryAdjustmentType, type InventoryHistoryDTO } from './inventoryApi';
export { couponApi, type CouponDTO, type CouponValidateRequest, type CouponValidateResult } from './couponApi';
export { promotionApi, type PromotionDTO } from './promotionApi';
export { flashSaleApi, type FlashSaleDTO, type FlashSaleItemDTO, type PublicFlashSale, type PublicFlashSaleItem } from './flashSaleApi';
export { reviewApi, type ReviewDTO, type ReviewListResponse, type FeaturedReviewDTO } from './reviewApi';
export { reportApi, type RevenueDataPoint, type TopProductItem, type OrderStatItem, type DashboardData } from './reportApi';
export { homepageApi, type HomepageSectionDTO } from './homepageApi';
export { bannerApi, type BannerDTO } from './bannerApi';
export { pageApi, type PageDTO } from './pageApi';
export { menuApi, type MenuDTO } from './menuApi';
export { collectionApi, type CollectionDTO, type PublicCollectionDTO } from './collectionApi';
export { lookbookApi, type LookbookDTO, type PublicLookbookDTO, type LookbookHotspotDTO } from './lookbookApi';
export { settingsApi, type SettingDTO, type UpsertSettingDTO } from './settingsApi';
export { cartApi, type CartItemDTO as CartItemBackendDTO, type AddToCartPayload, type ComboDiscountResult, type ReorderResult } from './cartApi';
export { customerOrderApi, customerReviewApi, type CustomerOrderDTO, type CustomerOrderItemDTO, type CreateReviewPayload, type ReviewDTO as CustomerReviewDTO } from './customerOrderApi';
export { accountApi, type AccountDTO, type UpdateAccountPayload, type ChangePasswordPayload, type PointsHistoryDTO, type RedeemResultDTO, type PersonalVoucher } from './accountApi';
export { addressApi, type AddressDTO, type CreateAddressPayload } from './addressApi';
export { adminProductsApi } from './adminProductsApi';
export { customerApi } from './customerApi';
export { wishlistApi, type WishlistItemDTO } from './wishlistApi';
export { locationApi, type Province, type District, type Ward } from './locationApi';
export { supplierApi, type SupplierDTO, type CreateSupplierPayload } from './supplierApi';
export { stockReceiptApi, type StockReceiptDTO, type StockReceiptItemDTO, type StockReceiptListItem, type CreateStockReceiptPayload, type CreateStockReceiptItemPayload } from './stockReceiptApi';
export { variantStockApi, type VariantStockDTO, type ProductVariantSummary } from './variantStockApi';

export { shippingApi, type ShippingProvider, type ShippingQuoteRequest, type ShippingQuoteOption, type ShippingQuoteResponse, type ShippingTracking, type ShippingHistoryItem } from './shippingApi';
export { adminShippingApi, type ShippingConfig as AdminShippingConfig, type ShippingTestResult, type ShippingHistoryItem as AdminShippingHistoryItem, type ShippingHistoryResponse as AdminShippingHistoryResponse, type ShippingOverview as AdminShippingOverview, type GhnProvinceItem, type GhnDistrictItem, type KaitoKidBranch } from './adminShippingApi';

export { ghnLocationApi, type GhnProvince as GhnProvinceItem2, type GhnDistrict as GhnDistrictItem2, type GhnWard as GhnWardItem } from './ghnLocationApi';

export { paymentApi, type PaymentStatus, type PaymentConfig } from './paymentApi';

export { searchApi, type SearchRequest, type SearchResult, type SearchFacets, type SuggestionResponse, type ImageSearchItem, type ImageSearchResult } from './searchApi';

export { newsletterApi, type NewsletterSubscribeResult } from './newsletterApi';

export { publicBannerApi, type PublicBannerDTO } from './publicBannerApi';

export { productExtrasApi, type VariantStockItem, type SizeChartItem, type SizeChartResponse, type QAItem } from './productExtrasApi';

export { homepageBlocksApi, adminHomepageBlocksApi, type HomepageBlock, type HomepageBlockType, type HomepageBlocksByType, type HomepageBlockAdminDTO } from './homepageBlocksApi';

export { notificationApi, type NotificationDTO, type NotificationListResponse } from './notificationApi';

export { referralApi, type ReferralCodeResponse, type ClaimReferralResponse } from './referralApi';

export {
  staffManagementApi,
  type StaffListItem,
  type StaffDetail,
  type CreateStaffPayload,
  type UpdateStaffPayload,
  type StaffListParams,
  type Role as StaffRole,
  type CreateRolePayload,
  type Permission as StaffPermission,
  type PermissionGroupKey,
} from './staffManagementApi';
