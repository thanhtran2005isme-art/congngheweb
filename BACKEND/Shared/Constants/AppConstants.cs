namespace Shared.Constants;

public static class AppConstants
{
    public const string AppName = "KaitoKid";

    // Roles
    public const string RoleAdmin = "admin";
    public const string RoleUser = "user";

    // Order statuses
    public const string OrderPending = "pending";
    public const string OrderConfirmed = "confirmed";
    public const string OrderShipping = "shipping";
    public const string OrderCompleted = "completed";
    public const string OrderCancelled = "cancelled";

    // Product statuses
    public const string ProductActive = "active";
    public const string ProductOutOfStock = "out-of-stock";
    public const string ProductDraft = "draft";

    // Review statuses
    public const string ReviewPending = "pending";
    public const string ReviewApproved = "approved";
    public const string ReviewRejected = "rejected";

    // Coupon types
    public const string CouponPercent = "percent";
    public const string CouponFixed = "fixed";

    // JWT defaults
    public const string DefaultJwtIssuer = "KaitoKid.API.Auth";
    public const string DefaultJwtAudience = "KaitoKid.Client";
    public const int DefaultJwtExpiryMinutes = 60;
    public const int DefaultRefreshTokenDays = 7;

    // Pagination defaults
    public const int DefaultPage = 1;
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;
}
// v1.1: Bo sung constants cho san pham, danh gia, coupon, JWT, phan trang
